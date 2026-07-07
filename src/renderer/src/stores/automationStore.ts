// 自动化任务状态切片
import { create } from 'zustand'
import type { AutomationTask } from '@shared/types'

interface AutomationState {
  automations: AutomationTask[]
  setAutomations: (tasks: AutomationTask[]) => void
}

export const useAutomationStore = create<AutomationState>((set) => ({
  automations: [],
  setAutomations: (tasks) => set({ automations: tasks }),
}))