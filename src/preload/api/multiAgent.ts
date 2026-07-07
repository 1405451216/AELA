import { invoke, IPC_CHANNELS } from './_shared'
import type {
  MultiAgentTask as Task,
  MultiAgentTaskFilter as TaskFilter,
  AgentMessage,
  WorkerAgent,
  WorkerRole,
  SupervisorSession,
  ConflictResolution,
} from '@shared/types'

export const taskBoardApi = {
  create: (params: { description: string; assignedAgent?: string; dependencies?: string[] }): Promise<Task> =>
    invoke(IPC_CHANNELS.TASKBOARD_CREATE, params),
  update: (params: { taskId: string; updates: Record<string, unknown> }): Promise<Task | null> =>
    invoke(IPC_CHANNELS.TASKBOARD_UPDATE, params),
  list: (filter?: TaskFilter): Promise<Task[]> =>
    invoke(IPC_CHANNELS.TASKBOARD_LIST, filter),
  get: (taskId: string): Promise<Task | null> =>
    invoke(IPC_CHANNELS.TASKBOARD_GET, taskId),
  delete: (taskId: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.TASKBOARD_DELETE, taskId),
  validateDAG: (): Promise<{ valid: boolean; cycles: string[][] }> =>
    invoke(IPC_CHANNELS.TASKBOARD_VALIDATE_DAG),
}

export const agentBusApi = {
  send: (params: { from: string; to: string; payload: unknown; type?: 'request' | 'response' | 'notify' | 'escalate' }): Promise<AgentMessage> =>
    invoke(IPC_CHANNELS.AGENTBUS_SEND, params),
  broadcast: (params: { from: string; payload: unknown; role?: WorkerRole; type?: 'request' | 'response' | 'notify' | 'escalate' }): Promise<AgentMessage[]> =>
    invoke(IPC_CHANNELS.AGENTBUS_BROADCAST, params),
  receive: (agentId: string): Promise<AgentMessage | null> =>
    invoke(IPC_CHANNELS.AGENTBUS_RECEIVE, agentId),
  listMessages: (agentId: string): Promise<AgentMessage[]> =>
    invoke(IPC_CHANNELS.AGENTBUS_LIST_MESSAGES, agentId),
  clear: (agentId?: string): Promise<number> =>
    invoke(IPC_CHANNELS.AGENTBUS_CLEAR, agentId),
}

export const supervisorSessionApi = {
  start: (params: { goal: string; workers: WorkerAgent[]; budget?: { maxTokens: number; maxDurationMs: number } }): Promise<SupervisorSession> =>
    invoke(IPC_CHANNELS.SUPERVISOR_SESSION_START, params),
  status: (sessionId: string): Promise<SupervisorSession | null> =>
    invoke(IPC_CHANNELS.SUPERVISOR_SESSION_STATUS, sessionId),
  stop: (sessionId: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.SUPERVISOR_SESSION_STOP, sessionId),
  delegate: (params: { taskDescription: string; workerAgents: WorkerAgent[]; sessionId?: string }): Promise<{ taskId: string; assignedTo: string }[]> =>
    invoke(IPC_CHANNELS.SUPERVISOR_DELEGATE, params),
  collect: (results: Array<{ taskId: string; workerId: string; output: string; tokensUsed: number }>): Promise<{ aggregated: string; totalTokens: number }> =>
    invoke(IPC_CHANNELS.SUPERVISOR_COLLECT, results),
  resolveConflict: (params: { taskId: string; options: string[]; strategy: ConflictResolution['strategy']; selectedOption?: number }): Promise<string> =>
    invoke(IPC_CHANNELS.SUPERVISOR_RESOLVE_CONFLICT, params),
}
