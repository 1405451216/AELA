// HITL 人机协作 API
import { invoke, ipcRenderer, IPC_CHANNELS } from './_shared'
import type { IpcRendererEvent } from './_shared'
import type {
  HITLConfig,
  HITLInterruptPoint,
  HITLInterruptRequest,
  HITLResponse,
} from '@shared/types'

export const hitlApi = {
  getConfig: (): Promise<HITLConfig> => invoke(IPC_CHANNELS.HITL_GET_CONFIG),
  setConfig: (config: Partial<HITLConfig>): Promise<boolean> => invoke(IPC_CHANNELS.HITL_SET_CONFIG, config),
  getPending: (): Promise<HITLInterruptPoint | null> => invoke(IPC_CHANNELS.HITL_GET_PENDING),
  resume: (response: HITLResponse): Promise<boolean> => invoke(IPC_CHANNELS.HITL_RESUME, response),
  addInterruptPoint: (point: HITLInterruptPoint): Promise<boolean> => invoke(IPC_CHANNELS.HITL_ADD_INTERRUPT_POINT, point),
  removeInterruptPoint: (type: HITLInterruptPoint['type'], toolName?: string): Promise<boolean> => invoke(IPC_CHANNELS.HITL_REMOVE_INTERRUPT_POINT, type, toolName),
  addAutoApprove: (toolName: string): Promise<boolean> => invoke(IPC_CHANNELS.HITL_ADD_AUTO_APPROVE, toolName),
  removeAutoApprove: (toolName: string): Promise<boolean> => invoke(IPC_CHANNELS.HITL_REMOVE_AUTO_APPROVE, toolName),
  /** 监听主进程推送的 HITL pending-added 事件，返回取消监听函数 */
  onPendingAdded: (callback: (req: HITLInterruptRequest) => void): (() => void) => {
    const channel = 'hitl:pending-added'
    const handler = (_event: IpcRendererEvent, data: HITLInterruptRequest) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}
