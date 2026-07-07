import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import type { CodeReviewResult, ReviewIssue } from '@shared/types'

const SEVERITY_COLORS: Record<ReviewIssue['severity'], string> = {
  critical: 'text-red-400 bg-red-900/30 border-red-700/50',
  error: 'text-orange-400 bg-orange-900/30 border-orange-700/50',
  warning: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',
  info: 'text-blue-400 bg-blue-900/30 border-blue-700/50',
}

const SEVERITY_ICONS: Record<ReviewIssue['severity'], string> = {
  critical: '🔴',
  error: '🟠',
  warning: '🟡',
  info: '🔵',
}

const CATEGORY_LABELS: Record<string, string> = {
  security: '安全',
  performance: '性能',
  style: '风格',
  bug: 'Bug',
}

export default function CodeReviewView() {
  const { currentWorkspace, modelList } = useAppStore()
  const [files, setFiles] = useState('')
  const [result, setResult] = useState<CodeReviewResult | null>(null)
  const [history, setHistory] = useState<CodeReviewResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | ReviewIssue['severity']>('all')

  const modelId = modelList[0]?.id || ''

  const loadHistory = useCallback(async () => {
    try {
      const list = await window.aela.codeReview.list()
      setHistory(list)
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleReview = useCallback(async () => {
    const fileList = files.split('\n').map(f => f.trim()).filter(Boolean)
    if (fileList.length === 0) return
    setLoading(true)
    setError('')
    try {
      const r = await window.aela.codeReview.review(fileList, modelId)
      setResult(r)
      await loadHistory()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '审查失败')
    } finally {
      setLoading(false)
    }
  }, [files, modelId, loadHistory])

  const filteredIssues = result?.issues.filter(i => filter === 'all' || i.severity === filter) || []

  // 按文件分组
  const issuesByFile = filteredIssues.reduce<Record<string, ReviewIssue[]>>((acc, issue) => {
    if (!acc[issue.filePath]) acc[issue.filePath] = []
    acc[issue.filePath].push(issue)
    return acc
  }, {})

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/30">
        <span className="text-sm font-medium text-text-primary">🔍 代码审查</span>
        {currentWorkspace && (
          <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{currentWorkspace.name}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleReview}
          disabled={!files.trim() || loading}
          className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
        >
          {loading ? '审查中...' : '开始审查'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-700/30 text-red-400 text-xs">
          ⚠ {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：文件输入 + 历史记录 */}
        <div className="w-64 border-r border-border bg-bg-secondary/20 flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">审查文件</div>
            <textarea
              value={files}
              onChange={e => setFiles(e.target.value)}
              placeholder="每行一个文件路径，如:&#10;src/main.ts&#10;src/utils.ts"
              className="w-full h-32 bg-bg-primary border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:border-blue-500 outline-none font-mono resize-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">审查历史</div>
            {history.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-4">暂无记录</div>
            ) : (
              <div className="space-y-0.5">
                {history.slice(0, 20).map(h => (
                  <div
                    key={h.id}
                    onClick={() => setResult(h)}
                    className={`px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      result?.id === h.id ? 'bg-surface-active' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-primary">{h.score}/100</span>
                      <span className={`text-[10px] ${h.approved ? 'text-green-400' : 'text-red-400'}`}>
                        {h.approved ? '✓' : '✕'}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-muted truncate">
                      {h.files.length} 文件 · {h.issues.length} 问题
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：审查结果 */}
        <div className="flex-1 overflow-y-auto">
          {result ? (
            <div className="p-4">
              {/* 概览卡片 */}
              <div className="flex items-center gap-4 mb-4">
                <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 ${
                  result.score >= 80 ? 'border-green-500 text-green-400' :
                  result.score >= 60 ? 'border-yellow-500 text-yellow-400' :
                  'border-red-500 text-red-400'
                }`}>
                  <span className="text-2xl font-bold">{result.score}</span>
                  <span className="text-[10px]">/ 100</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium ${result.approved ? 'text-green-400' : 'text-red-400'}`}>
                      {result.approved ? '✓ 审查通过' : '✕ 需要修复'}
                    </span>
                    <span className="text-xs text-text-muted">
                      {new Date(result.reviewedAt).toLocaleString()}
                    </span>
                  </div>
                  <pre className="text-xs text-text-secondary whitespace-pre-wrap">{result.summary}</pre>
                </div>
              </div>

              {/* 过滤器 */}
              <div className="flex items-center gap-1.5 mb-3">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2 py-0.5 rounded text-xs ${
                    filter === 'all' ? 'bg-blue-600 text-white' : 'bg-surface text-text-muted hover:bg-surface-hover'
                  }`}
                >
                  全部 ({result.issues.length})
                </button>
                {(['critical', 'error', 'warning', 'info'] as const).map(sev => {
                  const count = result.issues.filter(i => i.severity === sev).length
                  if (count === 0) return null
                  return (
                    <button
                      key={sev}
                      onClick={() => setFilter(sev)}
                      className={`px-2 py-0.5 rounded text-xs border ${
                        filter === sev ? SEVERITY_COLORS[sev] : 'bg-surface text-text-muted border-border hover:bg-surface-hover'
                      }`}
                    >
                      {SEVERITY_ICONS[sev]} {sev} ({count})
                    </button>
                  )
                })}
              </div>

              {/* 问题列表（按文件分组） */}
              <div className="space-y-3">
                {Object.entries(issuesByFile).map(([filePath, fileIssues]) => (
                  <div key={filePath} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-1.5 bg-bg-secondary/50 border-b border-border">
                      <span className="text-xs font-mono text-text-primary">{filePath}</span>
                      <span className="text-[10px] text-text-muted ml-2">{fileIssues.length} 个问题</span>
                    </div>
                    <div className="divide-y divide-border">
                      {fileIssues.map(issue => (
                        <div key={issue.id} className="px-3 py-2 hover:bg-surface-hover/30">
                          <div className="flex items-start gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${SEVERITY_COLORS[issue.severity]}`}>
                              {issue.severity}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] text-text-muted">
                                  L{issue.lineStart}{issue.lineEnd !== issue.lineStart ? `-${issue.lineEnd}` : ''}
                                </span>
                                <span className="text-[10px] text-text-muted bg-surface px-1 rounded">
                                  {CATEGORY_LABELS[issue.category] || issue.category}
                                </span>
                                {issue.rule && (
                                  <span className="text-[10px] text-text-muted font-mono">{issue.rule}</span>
                                )}
                              </div>
                              <p className="text-xs text-text-primary">{issue.message}</p>
                              {issue.suggestion && (
                                <p className="text-xs text-green-400 mt-0.5">💡 {issue.suggestion}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {filteredIssues.length === 0 && (
                <div className="text-center py-8 text-text-muted text-sm">
                  {filter === 'all' ? '🎉 没有发现问题' : `没有 ${filter} 级别的问题`}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-sm">输入文件路径后开始审查</p>
                <p className="text-xs mt-1 text-text-muted">静态规则扫描 + AI 增强审查</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
