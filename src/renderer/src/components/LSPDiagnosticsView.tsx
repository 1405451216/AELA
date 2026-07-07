// AELA — LSP 诊断信息面板
// 显示当前工作区的 TypeScript 编译错误和警告

import { useState, useEffect, useCallback } from 'react'

interface Diagnostic {
  filePath: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  code?: string
  source: string
}

export default function LSPDiagnosticsView() {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([])
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(false)

  const _loadDiagnostics = useCallback(async () => {
    setLoading(true)
    try {
      const allDiags = await window.aela?.lsp?.allDiagnostics?.() ?? []
      const flat: Diagnostic[] = []
      for (const [_, diags] of allDiags) {
        if (Array.isArray(diags)) {
          for (const d of diags) {
            flat.push({ ...d, severity: d.severity as Diagnostic['severity'] })
          }
        }
      }
      setDiagnostics(flat)
    } catch (err) {
      console.error('[LSP] Failed to load diagnostics:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const runQuickCheck = useCallback(async () => {
    setLoading(true)
    try {
      // 运行 tsc 快速检查
      const rawDiags = await window.aela?.lsp?.quickCheck?.(process.cwd?.() ?? '.') ?? []
      const diags: Diagnostic[] = rawDiags.map(d => ({ ...d, severity: d.severity as Diagnostic['severity'] }))
      setDiagnostics(diags)
    } catch (err) {
      console.error('[LSP] Quick check failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const checkStatus = useCallback(async () => {
    const status = await window.aela?.lsp?.status?.() ?? { enabled: false }
    setEnabled(status.enabled)
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleToggle = async () => {
    const newEnabled = !enabled
    await window.aela?.lsp?.toggle?.(newEnabled)
    setEnabled(newEnabled)
  }

  // 统计
  const errors = diagnostics.filter(d => d.severity === 'error')
  const warnings = diagnostics.filter(d => d.severity === 'warning')

  return (
    <div className="flex flex-col h-full p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">代码诊断</h1>
          {diagnostics.length > 0 && (
            <div className="flex items-center gap-2">
              {errors.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-error/10 text-error">
                  {errors.length} 个错误
                </span>
              )}
              {warnings.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning">
                  {warnings.length} 个警告
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              enabled
                ? 'bg-accent text-white'
                : 'bg-surface hover:bg-surface-hover text-text-secondary'
            }`}
          >
            {enabled ? '✓ 已启用' : '已禁用'}
          </button>
          <button
            onClick={runQuickCheck}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-surface hover:bg-surface-hover text-text-secondary transition-colors disabled:opacity-50"
          >
            {loading ? '🔍 检查中...' : '🔍 快速检查'}
          </button>
        </div>
      </div>

      {/* 诊断列表 */}
      {diagnostics.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="text-4xl mb-3">{loading ? '⏳' : '✅'}</div>
          <p className="text-text-muted text-sm">
            {loading ? '正在检查...' : '没有诊断信息'}
          </p>
          {!loading && (
            <p className="text-text-muted text-xs mt-2">点击「快速检查」运行 TypeScript 编译检查</p>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {diagnostics.map((diag, index) => (
            <div
              key={`${diag.filePath}-${diag.line}-${index}`}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                diag.severity === 'error'
                  ? 'bg-error/5 border-error/20'
                  : diag.severity === 'warning'
                  ? 'bg-warning/5 border-warning/20'
                  : 'bg-surface border-border'
              }`}
            >
              {/* 严重度图标 */}
              <span className="text-base shrink-0">
                {diag.severity === 'error' ? '❌' : diag.severity === 'warning' ? '⚠️' : 'ℹ️'}
              </span>
              {/* 文件位置 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-text-primary truncate">
                    {diag.filePath.split('/').pop() || diag.filePath}
                  </span>
                  <span className="text-[10px] text-text-muted shrink-0">
                    :{diag.line}:{diag.column}
                  </span>
                  {diag.code && (
                    <span className="text-[10px] text-text-muted bg-surface px-1 rounded shrink-0">
                      {diag.code}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-1">{diag.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
