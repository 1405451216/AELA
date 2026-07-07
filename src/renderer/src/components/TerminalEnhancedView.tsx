// [升级 8] 终端增强 — 多标签管理 + 命令历史
import { useState, useEffect, useCallback, useRef } from 'react'
import TerminalView from './TerminalView'
import type { TerminalCommandHistoryEntry } from '@shared/types'

interface TabState {
  id: string
  title: string
  active: boolean
}

export default function TerminalEnhancedView() {
  const [tabs, setTabs] = useState<TabState[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<TerminalCommandHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const tabCounter = useRef(0)

  // 初始加载已有标签
  const loadTabs = useCallback(async () => {
    try {
      const list = await window.aela.terminalExt.listTabs()
      if (list.length > 0) {
        const mapped: TabState[] = list.map(t => ({
          id: t.id,
          title: t.title,
          active: t.isActive,
        }))
        setTabs(mapped)
        const active = list.find(t => t.isActive)
        setActiveTabId(active?.id || list[0]?.id || null)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    loadTabs()
  }, [loadTabs])

  // 如果没有标签，自动创建一个
  useEffect(() => {
    if (tabs.length === 0) {
      handleNewTab()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewTab = async () => {
    tabCounter.current += 1
    const id = `tab-${Date.now()}-${tabCounter.current}`
    const title = `Terminal ${tabCounter.current}`
    const newTab: TabState = { id, title, active: true }
    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
  }

  const handleCloseTab = (tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId)
      if (activeTabId === tabId) {
        setActiveTabId(filtered[filtered.length - 1]?.id || null)
      }
      return filtered
    })
  }

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const list = await window.aela.terminalExt.commandHistory(undefined, 100)
      setHistory(list)
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showHistory) {
      loadHistory()
    }
  }, [showHistory, loadHistory])

  const handleRerunCommand = async (command: string) => {
    try {
      const _result = await window.aela.terminalExt.runCommand(command)
      // 结果可在终端历史中查看，无需额外处理
    } catch (err) {
      console.error('Rerun failed:', err)
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary min-h-0">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">🖥️ 终端</span>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              showHistory
                ? 'bg-blue-600 text-white'
                : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            📜 命令历史
          </button>
        </div>
        <button
          onClick={handleNewTab}
          className="text-xs px-2 py-0.5 rounded bg-surface border border-border hover:bg-surface-hover text-text-secondary"
          title="新建终端标签"
        >
          + 新标签
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* 终端区域 */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* 标签栏 */}
          {tabs.length > 0 && (
            <div className="flex items-center gap-0.5 px-2 py-1 bg-bg-primary border-b border-border overflow-x-auto">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group flex items-center gap-1.5 px-3 py-1 rounded-t-md cursor-pointer text-xs transition-colors whitespace-nowrap ${
                    activeTabId === tab.id
                      ? 'bg-[#1e1e2e] text-text-primary border-t border-l border-r border-border'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  <span>{tab.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloseTab(tab.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 终端内容 */}
          <div className="flex-1 relative">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={`absolute inset-0 ${activeTabId === tab.id ? 'block' : 'hidden'}`}
              >
                <TerminalView embedded />
              </div>
            ))}
          </div>
        </div>

        {/* 命令历史侧边栏 */}
        {showHistory && (
          <div className="w-72 border-l border-border bg-surface flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-text-primary">命令历史</span>
              <button
                onClick={() => setShowHistory(false)}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {historyLoading ? (
                <div className="text-center text-text-muted text-xs py-4">加载中...</div>
              ) : history.length === 0 ? (
                <div className="text-center text-text-muted text-xs py-4">暂无命令历史</div>
              ) : (
                history.map((entry, i) => (
                  <div
                    key={entry.id || i}
                    className="bg-bg-primary border border-border rounded-lg p-2 hover:border-blue-500/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <code className="text-xs text-text-primary flex-1 break-all">
                        {entry.command}
                      </code>
                      <button
                        onClick={() => handleRerunCommand(entry.command)}
                        className="text-[9px] text-text-muted hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="重新执行"
                      >
                        ↻
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[9px] text-text-muted">
                      <span className={entry.exitCode === 0 ? 'text-green-400' : 'text-red-400'}>
                        {entry.exitCode !== null ? `退出 ${entry.exitCode}` : '运行中'}
                      </span>
                      <span>{(entry.duration / 1000).toFixed(2)}s</span>
                      <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
