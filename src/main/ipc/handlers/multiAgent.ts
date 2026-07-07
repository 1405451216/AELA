import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { TaskBoard } from '../../services/TaskBoard'
import type { AgentBus } from '../../services/AgentBus'
import type { SupervisorService } from '../../services/SupervisorService'
import type { MultiAgentTaskFilter as TaskFilter, WorkerAgent, WorkerRole, ConflictResolution } from '@shared/types'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericIdOptionalSchema, genericObjectSchema, genericObjectOptionalSchema, genericArraySchema } from '../schemas'

export function registerMultiAgentHandlers(params: {
  taskBoard: TaskBoard
  agentBus: AgentBus
  supervisorService: SupervisorService
}): void {
  const { taskBoard, agentBus, supervisorService } = params

  // ===== TaskBoard =====

  ipcMain.handle(IPC_CHANNELS.TASKBOARD_CREATE, async (_, params: { description: string; assignedAgent?: string; dependencies?: string[] }) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => taskBoard.createTask(
      params.description,
      params.assignedAgent,
      params.dependencies ?? []
    ))
  })

  ipcMain.handle(IPC_CHANNELS.TASKBOARD_UPDATE, async (_, params: { taskId: string; updates: Record<string, unknown> }) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => taskBoard.updateTask(params.taskId, params.updates))
  })

  ipcMain.handle(IPC_CHANNELS.TASKBOARD_LIST, async (_, filter?: TaskFilter) => {
    const v = validateInput(genericObjectOptionalSchema, filter)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => taskBoard.getTasks(filter))
  })

  ipcMain.handle(IPC_CHANNELS.TASKBOARD_GET, async (_, taskId: string) => {
    const v = validateInput(genericIdSchema, taskId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => taskBoard.getTask(taskId))
  })

  ipcMain.handle(IPC_CHANNELS.TASKBOARD_DELETE, async (_, taskId: string) => {
    const v = validateInput(genericIdSchema, taskId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => taskBoard.deleteTask(taskId))
  })

  ipcMain.handle(IPC_CHANNELS.TASKBOARD_VALIDATE_DAG, async () => {
    return wrap(() => taskBoard.validateDAG())
  })

  // ===== AgentBus =====

  ipcMain.handle(IPC_CHANNELS.AGENTBUS_SEND, async (_, params: { from: string; to: string; payload: unknown; type?: 'request' | 'response' | 'notify' | 'escalate' }) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => agentBus.sendMessage(
      params.from,
      params.to,
      params.payload,
      params.type ?? 'request'
    ))
  })

  ipcMain.handle(IPC_CHANNELS.AGENTBUS_BROADCAST, async (_, params: { from: string; payload: unknown; role?: WorkerRole; type?: 'request' | 'response' | 'notify' | 'escalate' }) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => agentBus.broadcast(
      params.from,
      params.payload,
      params.role,
      params.type ?? 'notify'
    ))
  })

  ipcMain.handle(IPC_CHANNELS.AGENTBUS_RECEIVE, async (_, agentId: string) => {
    const v = validateInput(genericIdSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => agentBus.receiveMessage(agentId))
  })

  ipcMain.handle(IPC_CHANNELS.AGENTBUS_LIST_MESSAGES, async (_, agentId: string) => {
    const v = validateInput(genericIdSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => agentBus.getMessages(agentId))
  })

  ipcMain.handle(IPC_CHANNELS.AGENTBUS_CLEAR, async (_, agentId?: string) => {
    const v = validateInput(genericIdOptionalSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      if (agentId) {
        return agentBus.clearAgentMessages(agentId)
      }
      agentBus.clearAll()
      return 0
    })
  })

  // ===== Supervisor Session =====

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_SESSION_START, async (_, params: { goal: string; workers: WorkerAgent[]; budget?: { maxTokens: number; maxDurationMs: number } }) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => supervisorService.startSession(params.goal, params.workers, params.budget))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_SESSION_STATUS, async (_, sessionId: string) => {
    const v = validateInput(genericIdSchema, sessionId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => supervisorService.getSession(sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_SESSION_STOP, async (_, sessionId: string) => {
    const v = validateInput(genericIdSchema, sessionId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => supervisorService.stopSession(sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_DELEGATE, async (_, params: { taskDescription: string; workerAgents: WorkerAgent[]; sessionId?: string }) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => supervisorService.delegate(params.taskDescription, params.workerAgents, params.sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_COLLECT, async (_, results: Array<{ taskId: string; workerId: string; output: string; tokensUsed: number }>) => {
    const v = validateInput(genericArraySchema, results)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => supervisorService.collect(results))
  })

  ipcMain.handle(IPC_CHANNELS.SUPERVISOR_RESOLVE_CONFLICT, async (_, params: { taskId: string; options: string[]; strategy: ConflictResolution['strategy']; selectedOption?: number }) => {
    const v = validateInput(genericObjectSchema, params)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => supervisorService.resolveConflict(params.taskId, params.options, params.strategy, params.selectedOption))
  })
}
