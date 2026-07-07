// Orchestration IPC handlers
// ORCHESTRATION_RUN, ORCHESTRATION_STOP, ORCHESTRATION_STATUS,
// ORCHESTRATION_LIST_TEMPLATES, ORCHESTRATION_GET_TEMPLATE,
// ORCHESTRATION_SAVE_TEMPLATE, ORCHESTRATION_DELETE_TEMPLATE,
// ORCHESTRATION_HISTORY, ORCHESTRATION_PERFORMANCE_REPORT,
// DAG_RUN, DAG_STATUS, DAG_STOP, DAG_GET_GRAPH, DAG_GET_HISTORY,
// COLLABORATION_RUN, COLLABORATION_STOP, COLLABORATION_STATUS,
// SUPERVISOR_RUN, SUPERVISOR_STOP, SUPERVISOR_STATUS,
// DYNAMIC_DAG_CONFIG, DYNAMIC_DAG_RUN, DYNAMIC_DAG_STOP, DYNAMIC_DAG_STATUS

import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { OrchestrationConfig, OrchestrationEvent, DAGConfig, DynamicDAGConfig, CollaborationConfig, AssignmentStrategy } from '@shared/types'
import type { OrchestrationService } from '../../services/OrchestrationService'
import type { DAGSchedulerService } from '../../services/DAGSchedulerService'
import type { CollaborationService } from '../../services/CollaborationService'
import type { SupervisorService } from '../../services/SupervisorService'
import type { DynamicDAGService } from '../../services/DynamicDAGService'
import { validateInput } from '../schemas'
import { wrap } from '../../utils/ipcHelpers'

export function registerOrchestrationHandlers(params: {
  orchestrationService: OrchestrationService
  dagSchedulerService: DAGSchedulerService
  collaborationService: CollaborationService
  supervisorService: SupervisorService
  dynamicDAGService: DynamicDAGService
}): void {
  const { orchestrationService, dagSchedulerService, collaborationService, supervisorService, dynamicDAGService } = params

  // ===== 多 Agent 编排 =====

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_RUN, async (event, config: OrchestrationConfig) => {
    const validation = validateInput(orchestrationRunSchema, config)
    if (!validation.success) return { success: false, error: validation.error }
    const win = BrowserWindow.fromWebContents(event.sender)
    const channel = `orchestration:event:${config.id}`

    try {
      const stream = orchestrationService.run(config)
      for await (const evt of stream) {
        if (win) {
          win.webContents.send(channel, evt as OrchestrationEvent)
        }
      }
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_STOP, async (_, runId: string) => {
    const validation = validateInput(orchestrationControlSchema, { runId })
    if (!validation.success) return { success: false, error: validation.error }
    orchestrationService.stop(runId)
    return { success: true }
  })

  // ===== DAG 编排 =====

  ipcMain.handle(IPC_CHANNELS.DAG_RUN, async (event, config: DAGConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const channel = `orchestration:event:${config.id}`
    try {
      const stream = dagSchedulerService.run(config)
      for await (const evt of stream) {
        if (win) win.webContents.send(channel, evt as OrchestrationEvent)
      }
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DAG_STOP, async (_, runId: string) => {
    dagSchedulerService.stop(runId)
    return { success: true }
  })

  // ===== 协作模式 =====

  ipcMain.handle(IPC_CHANNELS.COLLABORATION_RUN, async (event, config: CollaborationConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const channel = `collaboration:event:${config.id}`
    try {
      const stream = collaborationService.run(config)
      for await (const evt of stream) {
        if (win) win.webContents.send(channel, evt)
      }
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.COLLABORATION_STOP, async (_, runId: string) => {
    collaborationService.stop(runId)
    return { success: true }
  })

  // ===== Supervisor 监督者 =====

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_ADD_WORKER, async (_, worker: { id?: string; name: string; skills?: string[]; maxConcurrency?: number; modelConfigId: string; systemPrompt?: string }) => {
    return wrap(() => supervisorService.addWorker(worker))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_REMOVE_WORKER, async (_, id: string) => {
    return wrap(() => supervisorService.removeWorker(id))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_SUBMIT_TASK, async (_, task: { name: string; type: string; payload: Record<string, unknown>; requiredSkills?: string[]; priority?: number; timeout?: number }) => {
    return wrap(() => supervisorService.submitTask({ ...task, priority: task.priority ?? 0 }))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_STATS, async () => {
    return wrap(() => supervisorService.getStats())
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_LIST_WORKERS, async () => {
    return wrap(() => supervisorService.listWorkers())
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_SET_STRATEGY, async (_, strategy: AssignmentStrategy) => {
    supervisorService.setStrategy(strategy)
    return wrap(() => supervisorService.getStrategy())
  })

  // ===== DynamicDAG 动态拓扑 =====

  ipcMain.handle(IPC_CHANNELS.DYNAMIC_DAG_RUN, async (event, config: DynamicDAGConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const channel = `dynamic-dag:event:${config.id}`
    try {
      const stream = dynamicDAGService.run(config)
      for await (const evt of stream) {
        if (win) win.webContents.send(channel, evt as OrchestrationEvent)
      }
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC_CHANNELS.DYNAMIC_DAG_STOP, async (_, runId: string) => {
    dynamicDAGService.stop(runId)
    return { success: true }
  })

  // ===== [升级 2] 编排模板库 + 回放 + 性能 =====

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_TEMPLATES_LIST, async () => {
    return wrap(() => orchestrationService.listTemplates())
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_TEMPLATES_GET, async (_, id: string) => {
    return wrap(() => orchestrationService.getTemplate(id))
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_RUNS_LIST, async (_, limit?: number) => {
    return wrap(() => orchestrationService.listRuns(limit))
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_RUNS_GET, async (_, id: string) => {
    return wrap(() => orchestrationService.getRun(id))
  })

  ipcMain.handle(IPC_CHANNELS.ORCHESTRATION_PERFORMANCE, async () => {
    return wrap(() => orchestrationService.getPerformanceReport())
  })
}

// Need to import schemas
import { orchestrationRunSchema, orchestrationControlSchema } from '../schemas'
