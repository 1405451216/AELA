import { useEffect, useState, useCallback } from 'react'
import { useT } from '../i18n'
import { dialog } from '../stores/dialog'
import type { RAGSearchResult } from '@shared/types'

const inputCls = 'w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none'
const btnCls = 'px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors'

export default function RAGView() {
  const t = useT()
  const [stats, setStats] = useState<{ documents: number; chunks: number; vectorDim: number } | null>(null)
  const [ingestMode, setIngestMode] = useState<'text' | 'file'>('text')
  const [source, setSource] = useState('')
  const [content, setContent] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestMsg, setIngestMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RAGSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const loadStats = useCallback(async () => {
    try {
      setStats(await window.aela.rag.stats())
    } catch (err) {
      console.error('Failed to load RAG stats:', err)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const handleIngest = async () => {
    if (!content.trim()) return
    setIngesting(true)
    setIngestMsg('')
    try {
      const result = await window.aela.rag.ingest(
        source.trim() || `text-${Date.now()}`,
        content.trim()
      )
      setIngestMsg(t('rag.ingested', { chunks: result.chunkCount }))
      setContent('')
      setSource('')
      loadStats()
    } catch (err: unknown) {
      setIngestMsg(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIngesting(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const results = await window.aela.rag.search(searchQuery.trim())
      setSearchResults(results)
    } catch (err: unknown) {
      console.error('RAG search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleClear = async () => {
    if (!(await dialog.confirm(t('rag.confirmClear'), { variant: 'danger' }))) return
    try {
      await window.aela.rag.clear()
      setSearchResults([])
      setIngestMsg(t('rag.cleared'))
      loadStats()
    } catch (err: unknown) {
      console.error('Failed to clear RAG:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* 标题 */}
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('rag.title')}</h2>
          <p className="text-xs text-text-muted mt-1">{t('rag.desc')}</p>
        </div>

        {/* 统计 */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.documents}</div>
              <div className="text-xs text-text-muted mt-0.5">{t('rag.documents')}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.chunks}</div>
              <div className="text-xs text-text-muted mt-0.5">{t('rag.chunks')}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-text-primary">{stats.vectorDim}</div>
              <div className="text-xs text-text-muted mt-0.5">{t('rag.vectorDim')}</div>
            </div>
          </div>
        )}

        {/* 摄入文档 */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">{t('rag.ingest')}</label>
            <div className="flex gap-1">
              <button
                onClick={() => setIngestMode('text')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${ingestMode === 'text' ? 'bg-accent/15 text-accent-light' : 'text-text-muted hover:text-text-primary'}`}
              >
                {t('rag.ingestText')}
              </button>
              <button
                onClick={() => setIngestMode('file')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${ingestMode === 'file' ? 'bg-accent/15 text-accent-light' : 'text-text-muted hover:text-text-primary'}`}
              >
                {t('rag.ingestFile')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">{t('rag.source')}</label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={ingestMode === 'file' ? '/path/to/file.md' : 'my-doc-name'}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">{t('rag.content')}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder={t('rag.contentPlaceholder')}
              className={inputCls + ' resize-none font-mono'}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleIngest}
              disabled={!content.trim() || ingesting}
              className={btnCls}
            >
              {ingesting ? t('rag.ingesting') : t('rag.ingestBtn')}
            </button>
            {ingestMsg && (
              <span className={`text-xs ${ingestMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {ingestMsg}
              </span>
            )}
          </div>
        </div>

        {/* 检索测试 */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <label className="text-sm font-medium text-text-primary">{t('rag.search')}</label>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch() } }}
              placeholder={t('rag.searchPlaceholder')}
              className={inputCls}
            />
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim() || searching}
              className={btnCls + ' whitespace-nowrap'}
            >
              {searching ? '...' : t('rag.searchBtn')}
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map((r, i) => (
                <div key={r.chunkId} className="bg-bg-primary/50 border border-border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent-light font-mono">#{i + 1}</span>
                    <span className="text-text-muted">{t('rag.score')}: {r.score.toFixed(3)}</span>
                    {r.sources.map(s => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-surface text-text-muted font-mono">{s}</span>
                    ))}
                    {r.metadata?.source && (
                      <span className="text-text-muted truncate ml-auto">{r.metadata.source}</span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary whitespace-pre-wrap line-clamp-4">{r.content}</p>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <div className="text-center text-text-muted text-sm py-4">{t('rag.noResults')}</div>
          )}
        </div>

        {/* 清空 */}
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {t('rag.clear')}
        </button>
      </div>
    </div>
  )
}
