import { useEffect, Suspense, useState, lazy, useCallback, useRef } from 'react'
import { useViewStore } from './stores'
import { useConfigStore } from './stores/configStore'
import { loadInitialData } from './stores/loadInitial'
import { getViewComponent } from './views'
import ErrorBoundary from './components/ErrorBoundary'
import Dialog from './components/Dialog'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import CommandPalette from './components/CommandPalette'
import OnboardingWizard from './components/OnboardingWizard'
import DeveloperPanel from './components/DeveloperPanel'
import { useKeyboardShortcuts } from './commands/useKeyboardShortcuts'

// 工作台面板懒加载（含 PreviewView + TerminalEnhancedView）
const WorkbenchPanel = lazy(() => import('./components/WorkbenchPanel'))

const viewLoadingFallback = (
  <div className="flex flex-col items-center justify-center h-full gap-3">
    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    <span className="text-xs text-text-muted">加载中...</span>
  </div>
)

/** 工作台面板宽度限制 */
const WORKBENCH_MIN_WIDTH = 300
const WORKBENCH_MAX_WIDTH = 900
const WORKBENCH_DEFAULT_WIDTH = 440

export default function App() {
  const currentView = useViewStore((s) => s.currentView)
  const error = useViewStore((s) => s.error)
  const setError = useViewStore((s) => s.setError)
  const appConfig = useConfigStore((s) => s.appConfig)
  const setAppConfig = useConfigStore((s) => s.setAppConfig)
  const [workbenchOpen, setWorkbenchOpen] = useState(false)
  const [workbenchWidth, setWorkbenchWidth] = useState(WORKBENCH_DEFAULT_WIDTH)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 键盘快捷键 + 命令面板
  const { paletteOpen, setPaletteOpen } = useKeyboardShortcuts()
  const [devPanelOpen, setDevPanelOpen] = useState(false)

  // Ctrl+Shift+D — 开发者面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setDevPanelOpen(p => !p)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 拖拽分割条逻辑
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startX = e.clientX
    const startWidth = workbenchWidth

    const onMouseMove = (moveEvent: MouseEvent) => {
      // 向左拖 = 面板变宽，向右拖 = 面板变窄
      const delta = startX - moveEvent.clientX
      const newWidth = Math.min(WORKBENCH_MAX_WIDTH, Math.max(WORKBENCH_MIN_WIDTH, startWidth + delta))
      setWorkbenchWidth(newWidth)
    }

    const onMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      // 拖拽结束恢复默认 body 样式
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    // 拖拽期间禁用文本选中、设置光标
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [workbenchWidth])

  useEffect(() => {
    loadInitialData()
  }, [])

  // 完成 Onboarding 引导
  const handleOnboardingComplete = useCallback(async () => {
    try {
      const updated = await window.aela.config.set({ completedOnboarding: true })
      setAppConfig(updated)
    } catch {
      // 静默处理
    }
  }, [setAppConfig])

  // 未走完引导流程时渲染 Onboarding Wizard
  if (appConfig && !appConfig.completedOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />
  }

  return (
    <>
    <ErrorBoundary>
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary">
      {/* 侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* 顶部标题栏 — 拖拽区域 + 工作台按钮 */}
        <div
          className="app-drag flex items-center justify-end pr-[140px] h-9 shrink-0 bg-bg-secondary border-b border-border"
        >
          <button
            onClick={() => setWorkbenchOpen(!workbenchOpen)}
            className={`app-no-drag flex items-center gap-1.5 mr-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              workbenchOpen
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
            title={workbenchOpen ? '关闭工作台' : '打开工作台'}
          >
            <span className="text-sm">🔧</span>
            工作台
          </button>
        </div>

        {/* 错误提示条 */}
        {error && (
          <div className="px-4 py-2 text-sm flex items-center justify-between animate-fade-in" style={{ background: 'var(--error-bg)', color: 'var(--error-text)' }}>
            <span>{typeof error === 'string' ? error : String(error)}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 hover:opacity-70"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* 内容区 + 工作台面板 */}
        <div className="flex-1 flex overflow-hidden" ref={containerRef}>
          {/* 视图切换：chat 不走 Suspense 以保留其内部状态；其他视图从注册表懒加载 */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {currentView === 'chat' ? (
              <ChatView />
            ) : (
              <Suspense fallback={viewLoadingFallback}>
                {(() => {
                  const Comp = getViewComponent(currentView)
                  return Comp ? (
                    <div className="flex-1 overflow-y-auto animate-fade-in-up" key={currentView}>
                      <Comp />
                    </div>
                  ) : null
                })()}
              </Suspense>
            )}
          </div>

          {/* 工作台面板（右侧） */}
          {workbenchOpen && (
            <>
              {/* 可拖拽分割条 */}
              <div
                onMouseDown={handleDragStart}
                className={`w-1 shrink-0 cursor-col-resize transition-colors ${
                  isDragging
                    ? 'bg-accent'
                    : 'bg-border hover:bg-accent/60'
                }`}
                title="拖拽调整宽度"
              />

              {/* 工作台内容 */}
              <div style={{ width: workbenchWidth }} className="shrink-0">
                <Suspense fallback={viewLoadingFallback}>
                  <WorkbenchPanel onClose={() => setWorkbenchOpen(false)} />
                </Suspense>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
    </ErrorBoundary>
    <Dialog />
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    <DeveloperPanel open={devPanelOpen} onClose={() => setDevPanelOpen(false)} />
    </>
  )
}
