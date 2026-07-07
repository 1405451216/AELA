import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import type { MultiFileEdit, MultiFileEditResult, FileChangeRecord } from '@shared/types'
import { DiffList } from './DiffView'

interface FileTab {
  id: string
  path: string
  content: string
  originalContent: string
  modified: boolean
}

/**
 * 多文件协同编辑器
 * 支持同时编辑多个文件，批量写入，变更树导航
 */
export default function MultiFileEditor() {
  const { currentWorkspace } = useAppStore()
  const [tabs, setTabs] = useState<FileTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [changes, setChanges] = useState<FileChangeRecord[]>([])
  const [writeResults, setWriteResults] = useState<MultiFileEditResult[] | null>(null)
  const [newFilePath, setNewFilePath] = useState('')

  // 拉取文件变更记录
  const loadChanges = useCallback(async () => {
    try {
      const list = await window.aela.fileChange.list()
      setChanges(list)
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    loadChanges()
  }, [loadChanges])

  const activeTab = tabs.find(t => t.id === activeTabId)

  const handleAddFile = useCallback(async () => {
    if (!newFilePath.trim()) return
    const path = newFilePath.trim()
    try {
      const content = await window.aela.multiFile.read(path)
      const tab: FileTab = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        path,
        content,
        originalContent: content,
        modified: false,
      }
      setTabs(prev => [...prev, tab])
      setActiveTabId(tab.id)
      setNewFilePath('')
    } catch (err: unknown) {
      // 文件不存在 → 创建空文件
      const tab: FileTab = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        path,
        content: '',
        originalContent: '',
        modified: false,
      }
      setTabs(prev => [...prev, tab])
      setActiveTabId(tab.id)
      setNewFilePath('')
    }
  }, [newFilePath])

  const handleCloseTab = useCallback((id: string) => {
    setTabs(prev => prev.filter(t => t.id !== id))
    if (activeTabId === id) {
      setActiveTabId(null)
    }
  }, [activeTabId])

  const handleContentChange = useCallback((id: string, content: string) => {
    setTabs(prev => prev.map(t =>
      t.id === id
        ? { ...t, content, modified: content !== t.originalContent }
        : t
    ))
  }, [])

  const handleSaveAll = useCallback(async () => {
    const modifiedTabs = tabs.filter(t => t.modified)
    if (modifiedTabs.length === 0) return

    const edits: MultiFileEdit[] = modifiedTabs.map(t => ({
      filePath: t.path,
      content: t.content,
    }))

    try {
      const results = await window.aela.multiFile.writeBatch(edits)
      setWriteResults(results)

      // 标记为已保存
      setTabs(prev => prev.map(t =>
        t.modified ? { ...t, originalContent: t.content, modified: false } : t
      ))

      // 刷新变更列表
      loadChanges()
    } catch (err: unknown) {
      console.error('Batch write failed:', err)
    }
  }, [tabs, loadChanges])

  const handleRevert = useCallback((id: string) => {
    setTabs(prev => prev.map(t =>
      t.id === id ? { ...t, content: t.originalContent, modified: false } : t
    ))
  }, [])

  const modifiedCount = tabs.filter(t => t.modified).length
  const totalBytes = tabs.reduce((sum, t) => sum + t.content.length, 0)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/30">
        <span className="text-sm font-medium text-text-primary">多文件编辑</span>
        {currentWorkspace && (
          <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">
            {currentWorkspace.name}
          </span>
        )}
        <div className="flex-1" />
        <input
          value={newFilePath}
          onChange={e => setNewFilePath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddFile()}
          placeholder="文件路径（如 src/index.ts）"
          className="w-64 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-blue-500 outline-none"
        />
        <button
          onClick={handleAddFile}
          disabled={!newFilePath.trim()}
          className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border hover:bg-surface-hover text-text-secondary disabled:opacity-50 transition-colors"
        >
          ＋ 添加文件
        </button>
        <button
          onClick={handleSaveAll}
          disabled={modifiedCount === 0}
          className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
        >
          保存全部 ({modifiedCount})
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：文件标签 + 变更树 */}
        <div className="w-56 border-r border-border bg-bg-secondary/20 flex flex-col overflow-hidden">
          {/* 文件标签 */}
          <div className="p-2 border-b border-border">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">打开的文件</div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {tabs.length === 0 ? (
                <div className="text-xs text-text-muted text-center py-2">无文件</div>
              ) : (
                tabs.map(tab => (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`group flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                      activeTabId === tab.id
                        ? 'bg-surface-active text-text-primary'
                        : 'text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {tab.modified && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />}
                    <span className="truncate flex-1" title={tab.path}>{tab.path}</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleCloseTab(tab.id) }}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 变更树 */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">文件变更记录</div>
            {changes.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-4">暂无变更</div>
            ) : (
              <div className="space-y-0.5">
                {changes.slice(0, 30).map(c => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                      c.accepted ? 'opacity-50' : c.rejected ? 'opacity-30 line-through' : ''
                    }`}
                  >
                    <span className={`text-[10px] ${
                      c.changeType === 'created' ? 'text-green-400' :
                      c.changeType === 'deleted' ? 'text-red-400' : 'text-blue-400'
                    }`}>
                      {c.changeType === 'created' ? '＋' : c.changeType === 'deleted' ? '－' : 'Ｍ'}
                    </span>
                    <span className="truncate text-text-secondary" title={c.filePath}>{c.filePath}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 底部统计 */}
          <div className="p-2 border-t border-border text-[10px] text-text-muted">
            <div>{tabs.length} 个文件 · {totalBytes} 字节</div>
            {modifiedCount > 0 && <div className="text-orange-400">{modifiedCount} 个未保存</div>}
          </div>
        </div>

        {/* 右侧：编辑器 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab ? (
            <>
              {/* 文件路径栏 */}
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-bg-secondary/20">
                <span className="text-xs font-mono text-text-secondary">{activeTab.path}</span>
                {activeTab.modified && (
                  <span className="text-[10px] text-orange-400">● 未保存</span>
                )}
                <div className="flex-1" />
                <span className="text-[10px] text-text-muted">{activeTab.content.length} 字节</span>
                {activeTab.modified && (
                  <button
                    onClick={() => handleRevert(activeTab.id)}
                    className="text-[10px] text-text-muted hover:text-text-primary px-2 py-0.5 rounded hover:bg-surface-hover"
                  >
                    还原
                  </button>
                )}
              </div>
              {/* 文本编辑区 */}
              <textarea
                value={activeTab.content}
                onChange={e => handleContentChange(activeTab.id, e.target.value)}
                className="flex-1 bg-bg-primary text-text-primary font-mono text-sm p-4 outline-none resize-none border-0"
                spellCheck={false}
                placeholder="在此编辑文件内容..."
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <div className="text-center">
                <div className="text-4xl mb-3">📝</div>
                <p className="text-sm">选择或添加文件开始编辑</p>
                <p className="text-xs mt-1 text-text-muted">支持同时编辑多个文件，批量保存</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 写入结果 */}
      {writeResults && (
        <div className="border-t border-border bg-bg-secondary/20 px-4 py-2 max-h-32 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-secondary">写入结果</span>
            <button
              onClick={() => setWriteResults(null)}
              className="text-text-muted hover:text-text-primary text-xs"
            >
              ✕
            </button>
          </div>
          <div className="space-y-0.5">
            {writeResults.map((r, i) => (
              <div key={i} className={`text-xs ${r.success ? 'text-green-400' : 'text-red-400'}`}>
                {r.success ? '✓' : '✕'} {r.filePath} — {r.success ? `${r.bytesWritten} bytes` : r.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 变更 Diff 预览 */}
      {changes.length > 0 && (
        <div className="border-t border-border max-h-[30vh] overflow-y-auto px-4 py-2">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">变更预览</div>
          <DiffList changes={changes.slice(0, 5)} />
        </div>
      )}
    </div>
  )
}
