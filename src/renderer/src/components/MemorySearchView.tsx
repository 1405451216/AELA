// [升级 1] 记忆系统 — FTS5 全文搜索视图
// 提供带 TF-IDF 评分的记忆搜索、索引统计和重建功能
import { useState, useEffect, useCallback } from 'react'
import type { MemoryFTSResult, MemoryFTSStats, MemoryEpisode } from '@shared/types'

export default function MemorySearchView() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemoryFTSResult[]>([])
  const [stats, setStats] = useState<MemoryFTSStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState<MemoryEpisode | null>(null)
  const [sessionId, setSessionId] = useState('')
  const [limit, setLimit] = useState(20)

  const loadStats = useCallback(async () => {
    try {
      const s = await window.aela.memoryFTS.stats()
      setStats(s)
    } catch (err) {
      console.error('Failed to load FTS stats:', err)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const opts: { sessionId?: string; limit?: number } = { limit }
      if (sessionId.trim()) opts.sessionId = sessionId.trim()
      const res = await window.aela.memoryFTS.search(query, opts)
      setResults(res)
    } catch (err) {
      console.error('FTS search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRebuild = async () => {
    setRebuilding(true)
    try {
      await window.aela.memoryFTS.rebuild()
      await loadStats()
    } catch (err) {
      console.error('Rebuild failed:', err)
    } finally {
      setRebuilding(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.aela.memory.delete(id)
      setResults(prev => prev.filter(r => r.episode.id !== id))
      await loadStats()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 标题区 */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🔍</span>
          <h1 className="text-xl font-bold text-text-primary">记忆全文搜索</h1>
          <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">FTS5</span>
        </div>
        <p className="text-sm text-text-muted">
          基于 TF-IDF 评分的倒排索引，支持中英文混合分词和 CJK bigram
        </p>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl">
        {/* 索引统计 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="文档总数" value={stats.totalDocuments} icon="📄" />
            <StatCard label="索引词条" value={stats.uniqueTokens} icon="🔤" />
            <StatCard label="平均文档长度" value={Math.round(stats.avgDocumentLength)} icon="📏" />
            <StatCard label="索引大小" value={`${(stats.indexSizeKB / 1024).toFixed(2)} MB`} icon="💾" />
          </div>
        )}

        {/* 搜索栏 */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="输入搜索关键词..."
              className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
            >
              {loading ? '搜索中...' : '搜索'}
            </button>
            <button
              onClick={handleRebuild}
              disabled={rebuilding}
              className="px-4 py-2 rounded-lg border border-border hover:bg-surface-hover text-text-secondary text-sm transition-colors"
            >
              {rebuilding ? '重建中...' : '🔄 重建索引'}
            </button>
          </div>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <label className="flex items-center gap-1.5">
              <span>会话 ID 过滤:</span>
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="可选"
                className="bg-bg-primary text-text-primary rounded px-2 py-1 border border-border w-40 text-xs"
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span>结果上限:</span>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) || 20)}
                className="bg-bg-primary text-text-primary rounded px-2 py-1 border border-border w-16 text-xs"
              />
            </label>
          </div>
        </div>

        {/* 搜索结果 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-secondary">
              搜索结果 {results.length > 0 && `(${results.length})`}
            </h2>
          </div>

          {results.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-12 bg-surface border border-border rounded-lg">
              {query ? '未找到匹配的记忆' : '输入关键词开始搜索'}
            </div>
          ) : (
            results.map((result) => (
              <div
                key={result.id}
                className="bg-surface border border-border rounded-lg p-4 hover:border-blue-500/50 transition-colors cursor-pointer"
                onClick={() => setSelectedEpisode(result.episode)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                        result.episode.role === 'user' ? 'bg-blue-500/20 text-blue-400' :
                        result.episode.role === 'assistant' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {result.episode.role}
                      </span>
                      {result.episode.importance !== undefined && (
                        <span className="text-[10px] text-text-muted">
                          重要度: {result.episode.importance}
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted">
                        {new Date(result.episode.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary line-clamp-2">
                      {result.episode.content}
                    </p>
                    {result.episode.topics && (
                      <div className="flex items-center gap-1 mt-2">
                        {result.episode.topics.split(',').slice(0, 5).map((tag, i) => (
                          <span key={i} className="text-[10px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-lg font-bold text-blue-400">
                      {result.score.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-text-muted">TF-IDF</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(result.episode.id)
                      }}
                      className="text-[10px] text-text-muted hover:text-red-400 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
                {result.matchedTokens.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                    {result.matchedTokens.slice(0, 10).map((token, i) => (
                      <span key={i} className="text-[9px] text-yellow-400 bg-yellow-500/10 px-1 py-0.5 rounded">
                        {token}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      {selectedEpisode && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setSelectedEpisode(null)}
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">记忆详情</h3>
              <button
                onClick={() => setSelectedEpisode(null)}
                className="text-text-muted hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-text-muted">角色:</span>
                <span className="ml-2 text-text-primary">{selectedEpisode.role}</span>
              </div>
              <div>
                <span className="text-text-muted">时间:</span>
                <span className="ml-2 text-text-primary">{new Date(selectedEpisode.createdAt).toLocaleString()}</span>
              </div>
              {selectedEpisode.topics && (
                <div>
                  <span className="text-text-muted">主题:</span>
                  <span className="ml-2 text-text-primary">{selectedEpisode.topics}</span>
                </div>
              )}
              {selectedEpisode.summary && (
                <div>
                  <span className="text-text-muted">摘要:</span>
                  <p className="mt-1 text-text-secondary">{selectedEpisode.summary}</p>
                </div>
              )}
              <div>
                <span className="text-text-muted">完整内容:</span>
                <pre className="mt-1 text-text-primary whitespace-pre-wrap bg-bg-primary rounded-lg p-3 text-xs">
                  {selectedEpisode.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="text-xl font-bold text-text-primary mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}
