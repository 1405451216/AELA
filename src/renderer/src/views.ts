// 视图注册表：所有顶层视图的单一来源
// 新增视图只需在此处追加：key、加载器、label、icon、group。
// SettingsView / Sidebar / OrchestrationView 等继续独立维护各自的子集（不影响）。

import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { ViewType } from './stores/viewStore'

export interface ViewEntry {
  /** 视图 key，需与 ViewType 联合类型对齐 */
  key: ViewType
  /** i18n 字典键（用于侧边栏 / Tab 标签） */
  i18nKey: string
  /** 视图分组（影响 Sidebar 顺序 / Tab 分类） */
  group: 'chat' | 'core' | 'tools' | 'advanced'
  /** 默认是否在侧边栏显示（部分高级视图仅通过 Tab 入口） */
  showInSidebar: boolean
  /** 懒加载组件 */
  Component: LazyExoticComponent<ComponentType>
}

// 集中懒加载，便于代码分割
const loaders: Record<ViewType, () => Promise<{ default: ComponentType }>> = {
  chat: () => import('./components/ChatView'),
  models: () => import('./components/ModelConfigView'),
  mcp: () => import('./components/MCPManagerView'),
  settings: () => import('./components/SettingsView'),
  workspaces: () => import('./components/WorkspaceView'),
  skills: () => import('./components/SkillsView'),
  automation: () => import('./components/AutomationView'),
  orchestration: () => import('./components/OrchestrationView'),
  rag: () => import('./components/RAGView'),
  planning: () => import('./components/PlanningView'),
  terminal: () => import('./components/TerminalEnhancedView'),
  dashboard: () => import('./components/DashboardView'),
  hooks: () => import('./components/HooksView'),
  preview: () => import('./components/PreviewView'),
  multifile: () => import('./components/MultiFileEditor'),
  testgen: () => import('./components/TestGenView'),
  wiki: () => import('./components/WikiView'),
  agentconfig: () => import('./components/AgentConfigView'),
  codereview: () => import('./components/CodeReviewView'),
  subagent: () => import('./components/SubAgentView'),
  img2code: () => import('./components/ImageToCodeView'),
  memorySearch: () => import('./components/MemorySearchView'),
  orchTemplates: () => import('./components/OrchestrationTemplatesView'),
  observability: () => import('./components/ObservabilityDashboardView'),
  fewShotWeight: () => import('./components/FewShotWeightView'),
  toolLearning: () => import('./components/ToolLearningView'),
  securityPreset: () => import('./components/SecurityPresetView'),
  sessionManager: () => import('./components/SessionManagerView'),
  adaptiveLearning: () => import('./components/AdaptiveLearningView'),
  screenshotAnalysis: () => import('./components/ScreenshotAnalysisView'),
  resilience: () => import('./components/ResilienceView'),
  checkpoints: () => import('./components/CheckpointTimeline'),
  plugins: () => import('./components/PluginManagerView'),
  diagnostics: () => import('./components/LSPDiagnosticsView'),
  taskBoard: () => import('./components/TaskBoardView'),
  multiAgent: () => import('./components/MultiAgentView'),
}

// 视图元数据（顺序即 Sidebar 显示顺序）
const meta: Array<Pick<ViewEntry, 'key' | 'i18nKey' | 'group' | 'showInSidebar'>> = [
  { key: 'chat', i18nKey: 'sidebar.newTask', group: 'chat', showInSidebar: true },
  { key: 'models', i18nKey: 'sidebar.models', group: 'core', showInSidebar: true },
  { key: 'mcp', i18nKey: 'sidebar.mcp', group: 'core', showInSidebar: true },
  { key: 'workspaces', i18nKey: 'sidebar.workspace', group: 'core', showInSidebar: true },
  { key: 'skills', i18nKey: 'sidebar.skills', group: 'core', showInSidebar: true },
  { key: 'automation', i18nKey: 'sidebar.automation', group: 'core', showInSidebar: true },
  { key: 'orchestration', i18nKey: 'sidebar.orchestration', group: 'core', showInSidebar: true },
  { key: 'rag', i18nKey: 'sidebar.rag', group: 'tools', showInSidebar: false },
  { key: 'planning', i18nKey: 'sidebar.planning', group: 'tools', showInSidebar: false },
  { key: 'terminal', i18nKey: 'sidebar.terminal', group: 'tools', showInSidebar: false },
  { key: 'dashboard', i18nKey: 'sidebar.dashboard', group: 'tools', showInSidebar: false },
  { key: 'hooks', i18nKey: 'sidebar.hooks', group: 'tools', showInSidebar: false },
  { key: 'preview', i18nKey: 'sidebar.preview', group: 'tools', showInSidebar: false },
  { key: 'multifile', i18nKey: 'sidebar.multifile', group: 'tools', showInSidebar: false },
  { key: 'testgen', i18nKey: 'sidebar.testgen', group: 'advanced', showInSidebar: false },
  { key: 'wiki', i18nKey: 'sidebar.wiki', group: 'advanced', showInSidebar: false },
  { key: 'agentconfig', i18nKey: 'sidebar.agentconfig', group: 'advanced', showInSidebar: false },
  { key: 'codereview', i18nKey: 'sidebar.codereview', group: 'advanced', showInSidebar: false },
  { key: 'subagent', i18nKey: 'sidebar.subagent', group: 'advanced', showInSidebar: false },
  { key: 'img2code', i18nKey: 'sidebar.img2code', group: 'advanced', showInSidebar: false },
  { key: 'memorySearch', i18nKey: 'sidebar.memorySearch', group: 'advanced', showInSidebar: false },
  { key: 'orchTemplates', i18nKey: 'sidebar.orchTemplates', group: 'advanced', showInSidebar: false },
  { key: 'observability', i18nKey: 'sidebar.observability', group: 'advanced', showInSidebar: false },
  { key: 'fewShotWeight', i18nKey: 'sidebar.fewShotWeight', group: 'advanced', showInSidebar: false },
  { key: 'toolLearning', i18nKey: 'sidebar.toolLearning', group: 'advanced', showInSidebar: false },
  { key: 'securityPreset', i18nKey: 'sidebar.securityPreset', group: 'advanced', showInSidebar: false },
  { key: 'sessionManager', i18nKey: 'sidebar.sessionManager', group: 'advanced', showInSidebar: false },
  { key: 'adaptiveLearning', i18nKey: 'sidebar.adaptiveLearning', group: 'advanced', showInSidebar: false },
  { key: 'screenshotAnalysis', i18nKey: 'sidebar.screenshotAnalysis', group: 'advanced', showInSidebar: false },
  { key: 'resilience', i18nKey: 'sidebar.resilience', group: 'advanced', showInSidebar: false },
  { key: 'taskBoard', i18nKey: 'sidebar.taskBoard', group: 'advanced', showInSidebar: false },
  { key: 'multiAgent', i18nKey: 'sidebar.multiAgent', group: 'advanced', showInSidebar: false },
  { key: 'settings', i18nKey: 'sidebar.settings', group: 'core', showInSidebar: true },
]

// 组合为完整注册表
export const VIEW_REGISTRY: ReadonlyArray<ViewEntry> = meta.map((m) => ({
  ...m,
  Component: lazy(loaders[m.key]),
}))

// 快速查找组件（O(1)）
const COMPONENT_MAP: Map<ViewType, LazyExoticComponent<ComponentType>> = new Map(
  VIEW_REGISTRY.map((v) => [v.key, v.Component])
)

/** 通过 view key 获取懒加载组件 */
export function getViewComponent(key: ViewType): LazyExoticComponent<ComponentType> | null {
  return COMPONENT_MAP.get(key) ?? null
}

/** 通过 group 获取视图列表（按注册顺序） */
export function getViewsByGroup(group: ViewEntry['group']): ReadonlyArray<ViewEntry> {
  return VIEW_REGISTRY.filter((v) => v.group === group)
}

/** 侧边栏可见视图（按注册顺序） */
export const SIDEBAR_VIEWS: ReadonlyArray<ViewEntry> = VIEW_REGISTRY.filter((v) => v.showInSidebar)