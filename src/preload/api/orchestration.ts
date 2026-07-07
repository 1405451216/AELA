// 编排相关 API（orchestration, dag, collaboration, dynamicDag）
import { invoke, ipcRenderer, IPC_CHANNELS } from './_shared'
import type { IpcRendererEvent } from './_shared'
import type {
  OrchestrationConfig,
  OrchestrationEvent,
  DAGConfig,
  CollaborationConfig,
  DynamicDAGConfig,
} from '@shared/types'

export const orchestrationApi = {
  run: (config: OrchestrationConfig): Promise<void> => invoke(IPC_CHANNELS.ORCHESTRATION_RUN, config),
  stop: (runId: string): Promise<boolean> => invoke(IPC_CHANNELS.ORCHESTRATION_STOP, runId),
  onEvent: (runId: string, callback: (event: OrchestrationEvent) => void): (() => void) => {
    const channel = `orchestration:event:${runId}`
    const handler = (_event: IpcRendererEvent, data: OrchestrationEvent) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

export const dagApi = {
  run: (config: DAGConfig): Promise<void> => invoke(IPC_CHANNELS.DAG_RUN, config),
  stop: (runId: string): Promise<boolean> => invoke(IPC_CHANNELS.DAG_STOP, runId),
  onEvent: (runId: string, callback: (event: OrchestrationEvent) => void): (() => void) => {
    const channel = `dag:event:${runId}`
    const handler = (_event: IpcRendererEvent, data: OrchestrationEvent) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

export const collaborationApi = {
  run: (config: CollaborationConfig): Promise<void> => invoke(IPC_CHANNELS.COLLABORATION_RUN, config),
  stop: (runId: string): Promise<boolean> => invoke(IPC_CHANNELS.COLLABORATION_STOP, runId),
  onEvent: (runId: string, callback: (event: OrchestrationEvent) => void): (() => void) => {
    const channel = `collaboration:event:${runId}`
    const handler = (_event: IpcRendererEvent, data: OrchestrationEvent) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

export const dynamicDagApi = {
  run: (config: DynamicDAGConfig): Promise<void> => invoke(IPC_CHANNELS.DYNAMIC_DAG_RUN, config),
  stop: (runId: string): Promise<boolean> => invoke(IPC_CHANNELS.DYNAMIC_DAG_STOP, runId),
  onEvent: (runId: string, callback: (event: OrchestrationEvent) => void): (() => void) => {
    const channel = `dynamic-dag:event:${runId}`
    const handler = (_event: IpcRendererEvent, data: OrchestrationEvent) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}
