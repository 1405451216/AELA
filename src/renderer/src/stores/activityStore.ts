import { create } from 'zustand'
import type { ActivityEvent } from '@shared/types'

interface ActivityState {
  activities: ActivityEvent[]
  addActivity: (event: ActivityEvent) => void
  updateActivity: (id: string, partial: Partial<ActivityEvent>) => void
  clear: () => void
  isExpanded: boolean
  toggleExpanded: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  addActivity: (event) => set((s) => ({ activities: [...s.activities, event] })),
  updateActivity: (id, partial) => set((s) => ({
    activities: s.activities.map(a => a.id === id ? { ...a, ...partial } : a)
  })),
  clear: () => set({ activities: [] }),
  isExpanded: true,
  toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
}))
