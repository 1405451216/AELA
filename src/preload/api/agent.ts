// Agent API
import { invoke, ipcRenderer, IPC_CHANNELS } from './_shared'
import type { IpcRendererEvent } from './_shared'
import type { StreamEvent } from '@shared/types'

export const agentApi = {
  runStream: (params: {
    sessionId: string
    input: string
    modelConfigId: string
    systemPrompt?: string
    mode?: 'code' | 'office'
    permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'
  }): Promise<void> => invoke(IPC_CHANNELS.AGENT_STREAM, params),
  stop: (sessionId: string): Promise<boolean> => invoke(IPC_CHANNELS.AGENT_STOP, sessionId),
  pause: (sessionId: string): Promise<boolean> => invoke(IPC_CHANNELS.AGENT_PAUSE, sessionId),
  resume: (sessionId: string): Promise<boolean> => invoke(IPC_CHANNELS.AGENT_RESUME, sessionId),
  status: (sessionId: string): Promise<string> => invoke(IPC_CHANNELS.AGENT_STATUS, sessionId),
  onStreamEvent: (sessionId: string, callback: (event: StreamEvent) => void): (() => void) => {
    const channel = `agent:stream-event:${sessionId}`
    const handler = (_event: IpcRendererEvent, data: StreamEvent) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}
