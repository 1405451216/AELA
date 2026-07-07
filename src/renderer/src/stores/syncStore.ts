import { create } from 'zustand'
import type { SyncState, SyncPeer, SyncConflict, SyncConfig } from '@shared/types/sync'

interface SyncStore extends SyncState {
  config: SyncConfig | null
  conflicts: SyncConflict[]
  setConfig: (config: SyncConfig | null) => void
  setState: (state: Partial<SyncState>) => void
  setPeers: (peers: SyncPeer[]) => void
  addConflict: (conflict: SyncConflict) => void
  removeConflict: (filePath: string) => void
  reset: () => void
}

const initialState: SyncState = {
  status: 'disconnected',
  lastSyncAt: null,
  pendingChanges: 0,
  peers: [],
}

export const useSyncStore = create<SyncStore>((set) => ({
  ...initialState,
  config: null,
  conflicts: [],
  setConfig: (config) => set({ config }),
  setState: (state) => set(state),
  setPeers: (peers) => set({ peers }),
  addConflict: (conflict) =>
    set((s) => ({
      conflicts: [...s.conflicts.filter(c => c.filePath !== conflict.filePath), conflict],
    })),
  removeConflict: (filePath) =>
    set((s) => ({
      conflicts: s.conflicts.filter(c => c.filePath !== filePath),
    })),
  reset: () => set({ ...initialState, config: null, conflicts: [] }),
}))
