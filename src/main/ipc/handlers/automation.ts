// Automation IPC handlers
// AUTOMATION_LIST, AUTOMATION_GET, AUTOMATION_CREATE, AUTOMATION_UPDATE,
// AUTOMATION_DELETE, AUTOMATION_RUN, AUTOMATION_RUN_RECORD, AUTOMATION_TOGGLE, AUTOMATION_RUNS

import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '@shared/types'
import type { AutomationTask, AutomationRunRecord } from '@shared/types'
import type { ConfigStore } from '../../services/ConfigStore'
import type { SessionStore } from '../../services/SessionStore'
import type { AgentService } from '../../services/AgentService'
import type { AutomationStore } from '../../services/AutomationStore'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericObjectSchema, genericObjectOptionalSchema, genericNumberOptionalSchema } from '../schemas'

export function registerAutomationHandlers(params: {
  configStore: ConfigStore
  sessionStore: SessionStore
  agentService: AgentService
  automationStore: AutomationStore
}): void {
  const { configStore, sessionStore, agentService, automationStore } = params

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_LIST, async () => {
    return wrap(() => automationStore.listTasks())
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_GET, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => automationStore.getTask(id))
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_CREATE, async (_, params) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => automationStore.createTask(params))
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_UPDATE, async (_, id: string, partial: Partial<AutomationTask>) => {
    const vId = validateInput(genericIdSchema, id)
    if (!vId.success) return { success: false, error: vId.error }
    const vPartial = validateInput(genericObjectOptionalSchema, partial)
    if (!vPartial.success) return { success: false, error: vPartial.error }
    return wrap(() => automationStore.updateTask(id, partial))
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_DELETE, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => automationStore.deleteTask(id))
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_TOGGLE, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      const task = automationStore.getTask(id)
      if (!task) throw new Error('Task not found')
      const newStatus = task.status === 'paused' ? 'idle' : 'paused'
      return automationStore.updateTask(id, { status: newStatus })
    })
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_RUN, async (event, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    const win = BrowserWindow.fromWebContents(event.sender)
    const task = automationStore.getTask(id)
    if (!task) return { success: false, error: 'Task not found' }

    const runId = randomUUID()
    const startedAt = new Date().toISOString()
    const startTime = Date.now()
    automationStore.updateTask(id, { status: 'running' })

    try {
      // 通过流式 Agent 执行任务 prompt
      const modelConfigId = configStore.getDefaultModelId() || configStore.getModels()[0]?.id
      if (!modelConfigId) throw new Error('No model configured')

      // 为自动化任务创建一个临时 session
      const session = sessionStore.createSession({
        title: `[自动] ${task.name}`,
        systemPrompt: task.prompt
      })

      const stream = agentService.runStream({
        sessionId: session.id,
        input: task.prompt,
        modelConfigId,
        systemPrompt: task.prompt
      })

      let output = ''
      for await (const evt of stream) {
        if (win) {
          win.webContents.send('automation:run-event:' + runId, evt)
        }
        if (evt.type === 'token') {
          output += evt.content
        }
      }

      const duration = Date.now() - startTime
      const record: AutomationRunRecord = {
        id: runId,
        taskId: id,
        startedAt,
        finishedAt: new Date().toISOString(),
        duration,
        success: true,
        output
      }
      automationStore.recordRun(record)
      automationStore.updateTask(id, {
        status: 'success',
        lastRunAt: record.finishedAt,
        lastRunDuration: duration,
        lastError: null,
        runCount: task.runCount + 1
      })

      return { success: true, data: record }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const duration = Date.now() - startTime
      const record: AutomationRunRecord = {
        id: runId,
        taskId: id,
        startedAt,
        finishedAt: new Date().toISOString(),
        duration,
        success: false,
        output: '',
        error: errMsg
      }
      automationStore.recordRun(record)
      automationStore.updateTask(id, {
        status: 'failed',
        lastRunAt: record.finishedAt,
        lastRunDuration: duration,
        lastError: errMsg,
        runCount: task.runCount + 1
      })
      return { success: false, error: errMsg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTOMATION_RUNS, async (_, id: string, limit?: number) => {
    const vId = validateInput(genericIdSchema, id)
    if (!vId.success) return { success: false, error: vId.error }
    const vLimit = validateInput(genericNumberOptionalSchema, limit)
    if (!vLimit.success) return { success: false, error: vLimit.error }
    return wrap(() => automationStore.getRuns(id, limit))
  })
}
