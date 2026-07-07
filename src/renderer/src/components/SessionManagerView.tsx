// [升级 7] 会话管理增强
// 全文搜索、导出（Markdown/JSON）、上下文窗口分析
import { useState } from 'react'
import { useAppStore } from '../stores/app'
import type { SessionSearchResult, SessionExportOptions, SessionContextInfo, Session } from '@shared/types'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlightSnippet(snippet: string, query: string): string {
  const safeSnippet = escapeHtml(snippet)
  const safeQuery = escapeHtml(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return safeSnippet.replace(
    new RegExp(`(${safeQuery})`, 'gi'),
    '<mark style="background:rgba(250,204,21,0.3);color:#facc15;padding:0 2px;border-radius:2px">$1</mark>'
  )
}

export default function SessionManagerView() {
  const { setCurrentSession, setView, currentWorkspace } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SessionSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [contextInfo, setContextInfo] = useState<SessionContextInfo | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const opts: { workspaceId?: string; limit?: number } = { limit: 20 }
      if (currentWorkspace?.id) opts.workspaceId = currentWorkspace.id
      const res = await window.aela.sessionExt.search(query, opts)
      setResults(res)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSession = async (session: Session) => {
    setSelectedSession(session)
    try {
      const info = await window.aela.sessionExt.contextInfo(session.id)
      setContextInfo(info)
    } catch (err) {
      console.error('Failed to get context info:', err)
    }
  }

  const handleExport = async (sessionId: string, format: 'markdown' | 'json') => {
    const options: SessionExportOptions = {
      format,
      includeMetrics: true,
      includeToolCalls: true,
      includeSystemMessages: false,
    }
    try {
      const result = await window.aela.sessionExt.export(sessionId, options)
      // 创建下载链接
      const blob = new Blob([result.content], {
        type: format === 'json' ? 'application/json' : 'text/markdown'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleOpenSession = (session: Session) => {
    setCurrentSession(session)
    setView('chat')
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🗂️</span>
          <h1 className="text-xl font-bold text-text-primary">会话管理</h1>
        </div>
        <p className="text-sm text-text-muted">
          全文搜索历史会话 · 导出对话记录 · 上下文窗口分析
        </p>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl">
        {/* 搜索栏 */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索会话内容..."
              className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
          </div>
        </div>

        {/* 搜索结果 */}
        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-secondary">
              搜索结果 ({results.length})
            </h3>
            {results.map((result) => (
              <div
                key={result.session.id}
                className="bg-surface border border-border rounded-lg p-3 hover:border-blue-500/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="flex items-center gap-2 cursor-pointer flex-1"
                    onClick={() => handleSelectSession(result.session)}
                  >
                    <span className="text-sm font-medium text-text-primary">{result.session.title}</span>
                    <span className="text-[10px] text-text-muted">
                      {result.matchCount} 条匹配
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenSession(result.session)}
                      className="text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    >
                      打开
                    </button>
                    <button
                      onClick={() => handleExport(result.session.id, 'markdown')}
                      className="text-[10px] px-2 py-1 rounded bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                    >
                      MD
                    </button>
                    <button
                      onClick={() => handleExport(result.session.id, 'json')}
                      className="text-[10px] px-2 py-1 rounded bg-surface border border-border text-text-secondary hover:bg-surface-hover"
                    >
                      JSON
                    </button>
                  </div>
                </div>
                {/* 匹配的消息片段 */}
                <div className="space-y-1">
                  {result.matchedMessages.slice(0, 3).map((match, i) => (
                    <div key={i} className="text-xs text-text-muted bg-bg-primary rounded px-2 py-1">
                      <span className={`text-[10px] mr-2 ${
                        match.message.role === 'user' ? 'text-blue-400' :
                        match.message.role === 'assistant' ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {match.message.role}
                      </span>
                      {/* 安全说明：highlightSnippet 内部调用 escapeHtml 完全转义，
                          <mark> 标签硬编码，无用户可控 HTML 注入风险 */}
                      <span dangerouslySetInnerHTML={{
                        __html: highlightSnippet(match.snippet, query)
                      }} />
                    </div>
                  ))}
                  {result.matchedMessages.length > 3 && (
                    <span className="text-[10px] text-text-muted">
                      +{result.matchedMessages.length - 3} 更多匹配...
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 上下文窗口分析 */}
        {selectedSession && contextInfo && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-text-primary">
                上下文窗口分析 — {selectedSession.title}
              </h3>
              <button
                onClick={() => {
                  setSelectedSession(null)
                  setContextInfo(null)
                }}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-bg-primary rounded-lg p-3">
                <div className="text-[10px] text-text-muted">消息总数</div>
                <div className="text-lg font-bold text-text-primary">{contextInfo.totalMessages}</div>
              </div>
              <div className="bg-bg-primary rounded-lg p-3">
                <div className="text-[10px] text-text-muted">估算 Token</div>
                <div className="text-lg font-bold text-text-primary">{contextInfo.estimatedTokens.toLocaleString()}</div>
              </div>
              <div className="bg-bg-primary rounded-lg p-3">
                <div className="text-[10px] text-text-muted">最旧消息</div>
                <div className="text-sm font-bold text-text-primary">
                  {contextInfo.oldestMessageAge || '—'}
                </div>
              </div>
            </div>
            {/* 按角色统计 */}
            <div className="mb-3">
              <span className="text-[10px] text-text-muted">按角色统计:</span>
              <div className="flex gap-2 mt-1">
                {Object.entries(contextInfo.messagesByRole).map(([role, count]) => (
                  <span key={role} className={`text-xs px-2 py-0.5 rounded ${
                    role === 'user' ? 'bg-blue-500/20 text-blue-400' :
                    role === 'assistant' ? 'bg-green-500/20 text-green-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {role}: {count}
                  </span>
                ))}
              </div>
            </div>
            {/* 压缩预警 */}
            {contextInfo.wouldTriggerCompression ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 flex items-center gap-2">
                <span className="text-yellow-400">⚠️</span>
                <span className="text-xs text-yellow-400">
                  当前消息数已超过上下文窗口上限，下次调用将触发压缩
                </span>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-xs text-green-400">
                  上下文窗口状态正常，无需压缩
                </span>
              </div>
            )}
            {/* 上下文配置 */}
            <div className="mt-3 text-[10px] text-text-muted">
              策略: {contextInfo.contextWindowConfig.strategy} ·
              最大消息: {contextInfo.contextWindowConfig.maxMessages} ·
              保留最近: {contextInfo.contextWindowConfig.keepLast}
            </div>
          </div>
        )}

        {/* 无结果提示 */}
        {results.length === 0 && query && !loading && (
          <div className="text-center text-text-muted py-12 bg-surface border border-border rounded-lg">
            未找到匹配的会话
          </div>
        )}
      </div>
    </div>
  )
}
