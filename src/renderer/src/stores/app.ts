// 全局应用状态 - 门面（向后兼容层）
//
// 此文件保留作为旧 API 的兼容入口：
//   - `useAppStore` (来自 zustand 旧的全量 store)
//   - `ViewType`, `ThemeMode`
//   - `loadInitialData`
//
// 新代码请直接使用 `./viewStore` / `./configStore` / `./skillStore` /
// `./automationStore` / `./messagesStore` 的细分 slice store 以获得
// 更好的重渲染隔离。
//
// 性能优化: 此 facade 不再订阅 useStreamingStore —
// 流式状态由 ChatView 直接订阅 useStreamingStore, 避免每个 token
// 通过 facade 级联重渲染所有 useAppStore 订阅者.

import { create } from 'zustand'
import { useViewStore, type ViewType } from './viewStore'
import { useConfigStore, type ThemeMode } from './configStore'
import { useSkillStore } from './skillStore'
import { useAutomationStore } from './automationStore'
import { useMessagesStore } from './messagesStore'
import type {
  Session,
  ModelConfig,
  Workspace,
  AppConfig,
  ChatMessage,
  Skill,
  AutomationTask,
} from '@shared/types'
import type { SkillScanPath, SkillScanLogEntry, SkillDedupConflict } from '@shared/types'

export type { ViewType, ThemeMode }

// 合并所有 slice 的状态为统一视图（向后兼容）
type AppState = {
  // view
  currentView: ViewType
  setView: (view: ViewType) => void
  error: string | null
  setError: (error: string | null) => void
  loading: boolean
  setLoading: (loading: boolean) => void

  // config
  appConfig: AppConfig | null
  setAppConfig: (config: AppConfig) => void
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  language: 'zh' | 'en'
  setLanguage: (lang: 'zh' | 'en') => void
  fontSize: number
  setFontSize: (size: number) => void
  currentSession: Session | null
  setCurrentSession: (session: Session | null) => void
  currentWorkspace: Workspace | null
  setCurrentWorkspace: (workspace: Workspace | null) => void
  currentModelConfig: ModelConfig | null
  setCurrentModelConfig: (config: ModelConfig | null) => void
  modelList: ModelConfig[]
  setModelList: (models: ModelConfig[]) => void

  // skills
  skills: Skill[]
  skillScanPaths: SkillScanPath[]
  skillScanLog: SkillScanLogEntry[]
  skillDedupConflicts: SkillDedupConflict[]
  setSkills: (data: {
    skills: Skill[]
    scanPaths: SkillScanPath[]
    scanLog?: SkillScanLogEntry[]
    dedupConflicts?: SkillDedupConflict[]
  }) => void

  // automation
  automations: AutomationTask[]
  setAutomations: (tasks: AutomationTask[]) => void

  // messages
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  updateLastAssistantMessage: (content: string) => void
}

// 通过 zustand 的 combine + subscribe 把多个 slice 合成单个兼容 store
// 注意：这只是过渡层的 facade，每个 setter 内部委托给对应的 slice。
export const useAppStore = create<AppState>((set, _get) => {
  // 转发 setter 实现 — 当任一 slice 变化时同步更新 facade 视图
  const syncFromSlices = () => {
    const v = useViewStore.getState()
    const c = useConfigStore.getState()
    const s = useSkillStore.getState()
    const a = useAutomationStore.getState()
    const m = useMessagesStore.getState()
    set({
      currentView: v.currentView,
      error: v.error,
      loading: v.loading,
      appConfig: c.appConfig,
      theme: c.theme,
      language: c.language,
      fontSize: c.fontSize,
      currentSession: c.currentSession,
      currentWorkspace: c.currentWorkspace,
      currentModelConfig: c.currentModelConfig,
      modelList: c.modelList,
      skills: s.skills,
      skillScanPaths: s.scanPaths,
      skillScanLog: s.scanLog,
      skillDedupConflicts: s.dedupConflicts,
      automations: a.automations,
      messages: m.messages,
    })
  }

  // 订阅非流式 slice 的变化以同步 facade 状态
  // 注意: 不订阅 useStreamingStore — 流式状态由 ChatView 直接订阅,
  // 避免每个 token 通过 facade 级联重渲染所有 useAppStore 订阅者.
  useViewStore.subscribe(syncFromSlices)
  useConfigStore.subscribe(syncFromSlices)
  useSkillStore.subscribe(syncFromSlices)
  useAutomationStore.subscribe(syncFromSlices)
  useMessagesStore.subscribe(syncFromSlices)

  // 初始同步
  syncFromSlices()

  return {
    // view
    currentView: useViewStore.getState().currentView,
    setView: (view) => useViewStore.getState().setView(view),
    error: useViewStore.getState().error,
    setError: (error) => useViewStore.getState().setError(error),
    loading: useViewStore.getState().loading,
    setLoading: (loading) => useViewStore.getState().setLoading(loading),

    // config
    appConfig: useConfigStore.getState().appConfig,
    setAppConfig: (config) => useConfigStore.getState().setAppConfig(config),
    theme: useConfigStore.getState().theme,
    setTheme: (theme) => useConfigStore.getState().setTheme(theme),
    toggleTheme: () => useConfigStore.getState().toggleTheme(),
    language: useConfigStore.getState().language,
    setLanguage: (lang) => useConfigStore.getState().setLanguage(lang),
    fontSize: useConfigStore.getState().fontSize,
    setFontSize: (size) => useConfigStore.getState().setFontSize(size),
    currentSession: useConfigStore.getState().currentSession,
    setCurrentSession: (session) => useConfigStore.getState().setCurrentSession(session),
    currentWorkspace: useConfigStore.getState().currentWorkspace,
    setCurrentWorkspace: (workspace) => useConfigStore.getState().setCurrentWorkspace(workspace),
    currentModelConfig: useConfigStore.getState().currentModelConfig,
    setCurrentModelConfig: (config) => useConfigStore.getState().setCurrentModelConfig(config),
    modelList: useConfigStore.getState().modelList,
    setModelList: (models) => useConfigStore.getState().setModelList(models),

    // skills（桥接到 skillStore 对象签名）
    skills: useSkillStore.getState().skills,
    skillScanPaths: useSkillStore.getState().scanPaths,
    skillScanLog: useSkillStore.getState().scanLog,
    skillDedupConflicts: useSkillStore.getState().dedupConflicts,
    setSkills: (data) => useSkillStore.getState().setSkills(data),

    // automation
    automations: useAutomationStore.getState().automations,
    setAutomations: (tasks) => useAutomationStore.getState().setAutomations(tasks),

    // messages
    messages: useMessagesStore.getState().messages,
    setMessages: (messages) => useMessagesStore.getState().setMessages(messages),
    addMessage: (msg) => useMessagesStore.getState().addMessage(msg),
    updateLastAssistantMessage: (content) =>
      useMessagesStore.getState().updateLastAssistantMessage(content),
  }
})

// 重新导出 loadInitialData 以兼容旧 import
export { loadInitialData } from './loadInitial'
