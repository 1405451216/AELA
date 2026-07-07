// 视图状态切片：当前视图路由、错误条、加载标志
import { create } from 'zustand'

export type ViewType =
  | 'chat' | 'models' | 'mcp' | 'settings' | 'workspaces' | 'skills'
  | 'automation' | 'orchestration' | 'rag' | 'planning' | 'terminal'
  | 'dashboard' | 'hooks' | 'preview' | 'multifile' | 'testgen' | 'wiki'
  | 'agentconfig' | 'codereview' | 'subagent' | 'img2code' | 'memorySearch'
  | 'orchTemplates' | 'observability' | 'fewShotWeight' | 'toolLearning'
  | 'securityPreset' | 'sessionManager' | 'adaptiveLearning'
  | 'screenshotAnalysis' | 'resilience'
  | 'checkpoints' | 'plugins' | 'diagnostics'
  | 'taskBoard' | 'multiAgent' | 'skillMarket'

interface ViewState {
  currentView: ViewType
  setView: (view: ViewType) => void

  error: string | null
  setError: (error: string | null) => void

  loading: boolean
  setLoading: (loading: boolean) => void
}

export const useViewStore = create<ViewState>((set) => ({
  currentView: 'chat',
  setView: (view) => set({ currentView: view }),

  error: null,
  setError: (error) => set({ error }),

  loading: false,
  setLoading: (loading) => set({ loading }),
}))