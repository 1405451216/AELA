import { invoke, ipcRenderer, IPC_CHANNELS } from './_shared'
import type { SyncConfig, SyncState, SyncConflict, ConflictResolution } from '@shared/types/sync'

export const syncApi = {
  connect: (config: SyncConfig): Promise<void> =>
    invoke(IPC_CHANNELS.SYNC_CONNECT, config),

  disconnect: (): Promise<void> =>
    invoke(IPC_CHANNELS.SYNC_DISCONNECT),

  getStatus: (): Promise<SyncState> =>
    invoke(IPC_CHANNELS.SYNC_STATUS),

  syncFile: (filePath: string): Promise<void> =>
    invoke(IPC_CHANNELS.SYNC_FILE_CHANGE, { filePath }),

  resolve: (filePath: string, resolution: ConflictResolution): Promise<void> =>
    invoke(IPC_CHANNELS.SYNC_RESOLVE, { filePath, resolution }),

  getConflicts: (): Promise<SyncConflict[]> =>
    invoke(IPC_CHANNELS.SYNC_CONFLICT),

  onStatus: (listener: (state: SyncState) => void) => {
    const handler = (_e: unknown, data: SyncState) => listener(data)
    ipcRenderer.on(IPC_CHANNELS.SYNC_STATUS, handler)
    return () => ipcRenderer.off(IPC_CHANNELS.SYNC_STATUS, handler)
  },

  onConflict: (listener: (conflict: SyncConflict) => void) => {
    const handler = (_e: unknown, data: SyncConflict) => listener(data)
    ipcRenderer.on(IPC_CHANNELS.SYNC_CONFLICT, handler)
    return () => ipcRenderer.off(IPC_CHANNELS.SYNC_CONFLICT, handler)
  },

  offStatus: (listener: (state: SyncState) => void) => {
    ipcRenderer.off(IPC_CHANNELS.SYNC_STATUS, listener as (...args: unknown[]) => void)
  },

  offConflict: (listener: (conflict: SyncConflict) => void) => {
    ipcRenderer.off(IPC_CHANNELS.SYNC_CONFLICT, listener as (...args: unknown[]) => void)
  },
}
