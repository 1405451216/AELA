// IPC 监控 API（开发者面板用）
import { ipcRenderer } from 'electron'
import type { IpcLogEntry } from '../../main/services/IpcMonitorService'

export const ipcMonitorApi = {
  getEntries: (): Promise<IpcLogEntry[]> => ipcRenderer.invoke('ipc-monitor:get-entries'),
  clear: (): Promise<boolean> => ipcRenderer.invoke('ipc-monitor:clear'),
  onLog: (listener: (entry: IpcLogEntry) => void) => {
    const cb = (_e: unknown, entry: IpcLogEntry) => listener(entry)
    ipcRenderer.on('ipc:log', cb)
    return () => ipcRenderer.removeListener('ipc:log', cb)
  },
}
