// Agent IPC handlers
// AGENT_RUN_STREAM, AGENT_STOP, AGENT_PAUSE, AGENT_RESUME, AGENT_STATUS,
// AGENT_TEST_MODEL, AGENT_SHELL_CONFIRM callback, FILE_CHANGE_*, MULTIFILE_*

import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { ShellConfirmRequest } from '@shared/types'
import type { AgentService } from '../../services/AgentService'
import {
  validateInput,
  agentRunStreamSchema,
  agentControlSchema,
  fileChangeIdSchema,
  shellConfirmRequestSchema,
  agentStatusSchema,
} from '../schemas'
import { wrap } from '../../utils/ipcHelpers'
import { showShellConfirmDialog } from '../../utils/shellConfirm'

export function registerAgentHandlers(params: {
  agentService: AgentService
  getMainWindow: () => BrowserWindow | null
}): void {
  const { agentService, getMainWindow } = params

  // ===== Agent 运行（流式）=====
ipcMain.handle(IPC_CHANNELS.AGENT_STREAM, async (event, p: {
  sessionId: string
  input: string
  modelConfigId: string
  systemPrompt?: string
  mode?: 'code' | 'office'
  permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'
}) => {
    const validation = validateInput(agentRunStreamSchema, p)
    if (!validation.success) return { success: false, error: validation.error }
    const validatedParams = validation.data

    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { success: false, error: 'No window' }

    try {
const stream = agentService.runStream({
      sessionId: validatedParams.sessionId,
      input: validatedParams.input,
      modelConfigId: validatedParams.modelConfigId,
      systemPrompt: validatedParams.systemPrompt,
      mode: validatedParams.mode,
      permissionLevel: validatedParams.permissionLevel
    })

      // 监听窗口关闭事件，及时终止 Agent 避免僵尸进程
      let windowClosed = false
      const onClose = () => {
        windowClosed = true
        agentService.stopAgent(validatedParams.sessionId)
      }
      win.on('closed', onClose)

      try {
        for await (const evt of stream) {
          // 窗口已关闭则终止流式传输
          if (windowClosed) break
          // 安全检查：窗口可能在中途被销毁
          if (win.isDestroyed()) break
          win.webContents.send('agent:stream-event:' + validatedParams.sessionId, evt)
        }
      } finally {
        win.off('closed', onClose)
      }

      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ===== Agent 停止 =====
  ipcMain.handle(IPC_CHANNELS.AGENT_STOP, async (_, sessionId: string) => {
    const validation = validateInput(agentControlSchema, { sessionId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      agentService.stopAgent(sessionId)
      return true
    })
  })

  // ===== Agent 控制（暂停/恢复） =====
  ipcMain.handle(IPC_CHANNELS.AGENT_PAUSE, async (_, sessionId: string) => {
    const validation = validateInput(agentControlSchema, { sessionId })
    if (!validation.success) return { success: false, error: validation.error }
    agentService.pause(sessionId)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_RESUME, async (_, sessionId: string) => {
    const validation = validateInput(agentControlSchema, { sessionId })
    if (!validation.success) return { success: false, error: validation.error }
    agentService.resume(sessionId)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_STATUS, async (_, sessionId: string) => {
    const validation = validateInput(agentStatusSchema, { sessionId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => agentService.getStatus(sessionId))
  })

  // ===== Shell 命令确认弹窗 =====
  ipcMain.handle(IPC_CHANNELS.SHELL_CONFIRM_COMMAND, async (_, request: ShellConfirmRequest) => {
    const validation = validateInput(shellConfirmRequestSchema, request)
    if (!validation.success) return { success: false, error: validation.error }
    return showShellConfirmDialog(request, getMainWindow())
  })

  // ===== 文件变更追踪（Diff 视图） =====
  ipcMain.handle(IPC_CHANNELS.FILE_CHANGE_LIST, async (_, sessionId?: string) => {
    return wrap(() => agentService.getToolManager()?.getFileChanges(sessionId) || [])
  })

  ipcMain.handle(IPC_CHANNELS.FILE_CHANGE_GET, async (_, id: string) => {
    const validation = validateInput(fileChangeIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      const tm = agentService.getToolManager()
      if (!tm) return null
      const change = tm.getFileChange(id)
      if (!change) return null
      const diff = tm.getFileDiff(id)
      return { change, diff }
    })
  })

  ipcMain.handle(IPC_CHANNELS.FILE_CHANGE_CLEAR, async (_, sessionId?: string) => {
    return wrap(() => {
      agentService.getToolManager()?.clearFileChanges(sessionId)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.FILE_CHANGE_ACCEPT, async (_, id: string) => {
    const validation = validateInput(fileChangeIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => agentService.getToolManager()?.acceptFileChange(id))
  })

  ipcMain.handle(IPC_CHANNELS.FILE_CHANGE_REJECT, async (_, id: string) => {
    const validation = validateInput(fileChangeIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => agentService.getToolManager()?.rejectFileChange(id))
  })

}
