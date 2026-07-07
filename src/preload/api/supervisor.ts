// Supervisor 监督者 API
import { invoke, IPC_CHANNELS } from './_shared'
import type { SupervisorWorker, SupervisorStats, SupervisorTaskResult, AssignmentStrategy } from '@shared/types'

export const supervisorApi = {
  addWorker: (worker: { id?: string; name: string; skills?: string[]; maxConcurrency?: number; modelConfigId: string; systemPrompt?: string }): Promise<SupervisorWorker> =>
    invoke(IPC_CHANNELS.SUPERVISOR_ADD_WORKER, worker),
  removeWorker: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.SUPERVISOR_REMOVE_WORKER, id),
  submitTask: (task: { name: string; type: string; payload: Record<string, unknown>; requiredSkills?: string[]; priority?: number; timeout?: number }): Promise<SupervisorTaskResult> =>
    invoke(IPC_CHANNELS.SUPERVISOR_SUBMIT_TASK, task),
  stats: (): Promise<SupervisorStats> => invoke(IPC_CHANNELS.SUPERVISOR_STATS),
  listWorkers: (): Promise<SupervisorWorker[]> => invoke(IPC_CHANNELS.SUPERVISOR_LIST_WORKERS),
  setStrategy: (strategy: AssignmentStrategy): Promise<AssignmentStrategy> => invoke(IPC_CHANNELS.SUPERVISOR_SET_STRATEGY, strategy),
}
