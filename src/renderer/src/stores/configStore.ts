import { logError } from '../lib/logger'
// 配置状态切片：appConfig + 主题/语言/字体 + 当前会话/工作区/模型
import { create } from 'zustand'
import type { Session, ModelConfig, Workspace, AppConfig, PermissionLevel } from '@shared/types'
import { setLang, type Lang } from '../i18n'

export type ThemeMode = 'dark' | 'light'

interface ConfigState {
  // 应用配置（从主进程加载的完整 AppConfig）
  appConfig: AppConfig | null
  setAppConfig: (config: AppConfig) => void

  // 主题/语言/字体（持久化 + 即时应用）
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void

  language: Lang
  setLanguage: (lang: Lang) => void

  fontSize: number
  setFontSize: (size: number) => void

  // 当前会话
  currentSession: Session | null
  setCurrentSession: (session: Session | null) => void

  // 当前工作区
  currentWorkspace: Workspace | null
  setCurrentWorkspace: (workspace: Workspace | null) => void

  // 当前模型 + 模型列表
  currentModelConfig: ModelConfig | null
  setCurrentModelConfig: (config: ModelConfig | null) => void

  modelList: ModelConfig[]
  setModelList: (models: ModelConfig[]) => void

  // 执行权限等级
  permissionLevel: PermissionLevel
  setPermissionLevel: (level: PermissionLevel) => void
}

// ===== 主题应用 =====
function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(theme)
}

// ===== 字体大小应用 =====
function applyFontSize(size: number) {
  document.documentElement.style.fontSize = `${size}px`
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  appConfig: null,
  setAppConfig: (config) => set({ appConfig: config }),

  theme: 'dark',
  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    set({ theme: next })
    applyTheme(next)
    // 持久化（异步不阻塞）
    window.aela?.config?.set({ theme: next }).catch((err) => logError('config.set.theme', err))
  },

  language: 'zh',
  setLanguage: (lang) => {
    set({ language: lang })
    setLang(lang)
    window.aela?.config?.set({ language: lang }).catch((err) => logError('config.set.language', err))
  },

  fontSize: 14,
  setFontSize: (size) => {
    set({ fontSize: size })
    applyFontSize(size)
    window.aela?.config?.set({ fontSize: size }).catch((err) => logError('config.set.fontSize', err))
  },

  currentSession: null,
  setCurrentSession: (session) => set({ currentSession: session }),

  currentWorkspace: null,
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),

  currentModelConfig: null,
  setCurrentModelConfig: (config) => set({ currentModelConfig: config }),

  modelList: [],
  setModelList: (models) => set({ modelList: models }),

  permissionLevel: 'ask',
  setPermissionLevel: (level) => set({ permissionLevel: level }),
}))