import { logError } from '../lib/logger'
/**
 * 工作台面板 — 右侧侧拉面板
 * 顶部三个 Tab：浏览器预览 / 终端 / 变更文件
 * 切换 Tab 时自动隐藏 BrowserView 原生覆盖层
 */
import { useState, useEffect, useCallback } from 'react'
import PreviewView from './PreviewView'
import TerminalEnhancedView from './TerminalEnhancedView'
import { useConfigStore } from '../stores/configStore'
import type { FileChangeRecord } from '@shared/types'
import { DiffList } from './DiffView'

type WorkbenchTab = 'browser' | 'terminal' | 'files'

export interface WorkbenchPanelProps {
  /** 关闭面板回调 */
  onClose: () => void
}

export default function WorkbenchPanel({ onClose }: WorkbenchPanelProps) {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('browser')
  const currentSession = useConfigStore(s => s.currentSession)
  const [fileChanges, setFileChanges] = useState<FileChangeRecord[]>([])

  // 切换 Tab 时隐藏 BrowserView（原生覆盖层不会被 DOM 遮挡）
  const hideBrowserView = useCallback(() => {
    window.aela.preview?.updateBounds?.({ x: 0, y: 0, width: 0, height: 0 }).catch((err) => logError('workbench.updateBounds', err))
  }, [])

  // 离开浏览器 Tab 时隐藏 BrowserView
  useEffect(() => {
    if (activeTab !== 'browser') {
      hideBrowserView()
    }
  }, [activeTab, hideBrowserView])

  // 面板卸载时关闭预览，防止 BrowserView 残留
  useEffect(() => {
    return () => {
      window.aela.preview?.close?.().catch((err) => logError('workbench.close', err))
    }
  }, [])

  // 加载文件变更列表
  const loadFileChanges = useCallback(async () => {
    if (!currentSession) {
      setFileChanges([])
      return
    }
    try {
      const list = await window.aela.fileChange.list(currentSession.id)
      setFileChanges(list)
    } catch {
      setFileChanges([])
    }
  }, [currentSession])

  // 切换到 files tab 或会话变化时加载
  useEffect(() => {
    if (activeTab === 'files') {
      loadFileChanges()
    }
  }, [activeTab, loadFileChanges])

  // 监听刷新事件
  useEffect(() => {
    const handler = () => {
      if (activeTab === 'files') loadFileChanges()
    }
    window.addEventListener('aela-refresh-sessions', handler)
    return () => window.removeEventListener('aela-refresh-sessions', handler)
  }, [activeTab, loadFileChanges])

  const handleAcceptChange = async (id: string) => {
    try {
      await window.aela.fileChange.accept(id)
      setFileChanges(prev => prev.map(c => c.id === id ? { ...c, accepted: true, rejected: false } : c))
    } catch (err) {
      console.error('Failed to accept change:', err)
    }
  }

  const handleRejectChange = async (id: string) => {
    try {
      await window.aela.fileChange.reject(id)
      setFileChanges(prev => prev.map(c => c.id === id ? { ...c, rejected: true, accepted: false } : c))
    } catch (err) {
      console.error('Failed to reject change:', err)
    }
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary border-l border-border">
      {/* 顶部工具栏：Tab 切换 + 关闭按钮 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-bg-secondary/50 shrink-0">
        <button
          onClick={() => setActiveTab('browser')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'browser'
              ? 'bg-surface-active text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          🌐 浏览器
        </button>
        <button
          onClick={() => setActiveTab('terminal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'terminal'
              ? 'bg-surface-active text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          ▣ 终端
        </button>
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'files'
              ? 'bg-surface-active text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
          title="对话过程变更的文件"
        >
          📁 变更
          {fileChanges.length > 0 && (
            <span className="text-[9px] bg-accent text-white rounded-full px-1.5 min-w-[14px] text-center">
              {fileChanges.length}
            </span>
          )}
        </button>

        {/* 拖拽区域 */}
        <div className="flex-1" />

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors text-sm"
          title="关闭工作台"
        >
          ✕
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden relative min-h-0">
        {/* 浏览器 Tab */}
        <div className={`absolute inset-0 ${activeTab === 'browser' ? 'flex' : 'hidden'}`}>
          <PreviewView />
        </div>
        {/* 终端 Tab — 保持挂载以保留终端会话 */}
        <div className={`absolute inset-0 ${activeTab === 'terminal' ? 'flex' : 'hidden'}`}>
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <TerminalEnhancedView />
          </div>
        </div>
        {/* 变更文件 Tab */}
        <div className={`absolute inset-0 ${activeTab === 'files' ? 'flex' : 'hidden'}`}>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* 文件列表 */}
            <div className="flex-1 overflow-y-auto p-3">
              {fileChanges.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-muted">
                  <div className="text-4xl mb-3">📁</div>
                  <p className="text-sm">暂无文件变更</p>
                  <p className="text-xs mt-1">对话中 AI 修改的文件将显示在这里</p>
                </div>
              ) : (
                <DiffList
                  changes={fileChanges}
                  onAccept={handleAcceptChange}
                  onReject={handleRejectChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
