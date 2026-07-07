import { create } from 'zustand'

export interface DiffEntry {
  id: string
  filePath: string
  description: string
  originalContent: string
  fixedContent: string
  checkpointId: string
  timestamp: string
  triggerSource: 'terminal' | 'fileWatcher' | 'lspDiagnostic'
  status: 'pending' | 'accepted' | 'rejected'
}

interface DiffState {
  diffs: DiffEntry[]
  addDiff: (diff: Omit<DiffEntry, 'status'>) => void
  acceptDiff: (id: string) => void
  rejectDiff: (id: string) => void
  clearDiffs: () => void
  getPending: () => DiffEntry | null
}

export const useDiffStore = create<DiffState>((set, get) => ({
  diffs: [],
  addDiff: (diff) =>
    set((s) => ({
      diffs: [...s.diffs, { ...diff, status: 'pending' }],
    })),
  acceptDiff: (id) =>
    set((s) => ({
      diffs: s.diffs.map((d) =>
        d.id === id ? { ...d, status: 'accepted' as const } : d,
      ),
    })),
  rejectDiff: (id) =>
    set((s) => ({
      diffs: s.diffs.map((d) =>
        d.id === id ? { ...d, status: 'rejected' as const } : d,
      ),
    })),
  clearDiffs: () => set({ diffs: [] }),
  getPending: () => {
    const state = get()
    return state.diffs.find((d) => d.status === 'pending') ?? null
  },
}))
