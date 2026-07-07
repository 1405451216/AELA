import { logError } from '../lib/logger'
import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 浏览器预览组件
 * 通过 IPC 控制主进程的 BrowserView，实现内嵌网页预览
 */
export default function PreviewView() {
  const [url, setUrl] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [title, setTitle] = useState('')
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 监听 URL 变化
  useEffect(() => {
    const unmountUrl = window.aela.preview.onUrlChanged((newUrl) => {
      setUrl(newUrl)
      setInputUrl(newUrl)
      setLoading(false)
    })
    const unmountTitle = window.aela.preview.onTitleChanged((newTitle) => {
      setTitle(newTitle)
    })

    return () => {
      unmountUrl()
      unmountTitle()
    }
  }, [])

  // 更新 BrowserView bounds
  const updateBounds = useCallback(() => {
    if (!active || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    // BrowserView 的坐标是相对于主窗口的
    // 需要加上 Sidebar 宽度 (256px)
    window.aela.preview?.updateBounds?.({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }).catch((err) => logError('preview.updateBounds', err))
  }, [active])

  // 监听容器大小变化
  useEffect(() => {
    if (!active) return
    updateBounds()
    const observer = new ResizeObserver(() => updateBounds())
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    return () => observer.disconnect()
  }, [active, updateBounds])

  const handleOpen = useCallback(async () => {
    if (!inputUrl.trim()) return
    setLoading(true)
    try {
      await window.aela.preview.open(inputUrl.trim())
      setActive(true)
      // 延迟更新 bounds 等待 BrowserView 创建
      setTimeout(() => updateBounds(), 200)
    } catch (err) {
      console.error('Failed to open preview:', err)
      setLoading(false)
    }
  }, [inputUrl, updateBounds])

  const handleClose = useCallback(async () => {
    await window.aela.preview.close()
    setActive(false)
    setUrl('')
    setTitle('')
  }, [])

  const handleReload = useCallback(() => {
    window.aela.preview.reload()
    setLoading(true)
  }, [])

  const handleGoBack = useCallback(() => {
    window.aela.preview.goBack()
  }, [])

  const handleGoForward = useCallback(() => {
    window.aela.preview.goForward()
  }, [])

  const handleDevTools = useCallback(() => {
    window.aela.preview.devtools()
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOpen()
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/30">
        <button
          onClick={handleGoBack}
          disabled={!active}
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary disabled:opacity-30 text-sm"
          title="后退"
        >
          ←
        </button>
        <button
          onClick={handleGoForward}
          disabled={!active}
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary disabled:opacity-30 text-sm"
          title="前进"
        >
          →
        </button>
        <button
          onClick={handleReload}
          disabled={!active}
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary disabled:opacity-30 text-sm"
          title="刷新"
        >
          ↻
        </button>

        {/* URL 输入框 */}
        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入 URL，如 localhost:3000"
          className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-blue-500 outline-none"
        />

        {active ? (
          <button
            onClick={handleClose}
            className="px-3 py-1.5 rounded-lg text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-700/50 transition-colors"
          >
            关闭预览
          </button>
        ) : (
          <button
            onClick={handleOpen}
            disabled={!inputUrl.trim() || loading}
            className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
          >
            {loading ? '加载中...' : '预览'}
          </button>
        )}

        <button
          onClick={handleDevTools}
          disabled={!active}
          className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary disabled:opacity-30 text-sm"
          title="开发者工具"
        >
          🔧
        </button>
      </div>

      {/* 预览区域 */}
      <div ref={containerRef} className="flex-1 relative bg-white">
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-secondary">
            <div className="text-5xl mb-4">🌐</div>
            <p className="text-text-muted text-sm">输入 URL 开始预览</p>
            <div className="mt-4 flex flex-col gap-2 text-xs text-text-muted">
              <button
                onClick={() => { setInputUrl('http://localhost:3000'); }}
                className="px-3 py-1.5 rounded border border-border hover:bg-surface-hover transition-colors text-left"
              >
                🚀 localhost:3000
              </button>
              <button
                onClick={() => { setInputUrl('http://localhost:5173'); }}
                className="px-3 py-1.5 rounded border border-border hover:bg-surface-hover transition-colors text-left"
              >
                ⚡ localhost:5173 (Vite)
              </button>
              <button
                onClick={() => { setInputUrl('http://localhost:8080'); }}
                className="px-3 py-1.5 rounded border border-border hover:bg-surface-hover transition-colors text-left"
              >
                📦 localhost:8080
              </button>
            </div>
          </div>
        )}
        {loading && active && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-bg-secondary/80 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-text-muted z-10">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            加载中...
          </div>
        )}
        {/* BrowserView 由主进程管理，这里只需要占位 */}
        {active && (
          <div className="absolute bottom-2 left-2 bg-bg-secondary/80 backdrop-blur rounded px-2 py-1 text-[10px] text-text-muted z-10 max-w-md truncate">
            {title || url}
          </div>
        )}
      </div>
    </div>
  )
}
