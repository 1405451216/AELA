import { useState } from 'react'
import { useT } from '../../i18n'
import type { ReflectionResult, CritiqueResult } from '@shared/types'

interface Props {
  input: string
  output: string
  onClose: () => void
}

const severityConfig: Record<string, string> = {
  low: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
}

export default function ReflectionPanel({ input, output, onClose }: Props) {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    reflection: ReflectionResult
    critique: CritiqueResult
    improvedOutput: string
  } | null>(null)
  const [error, setError] = useState('')
  const [showImproved, setShowImproved] = useState(false)

  const handleReflect = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await window.aela.reflection.reflectAndImprove(input, output)
      setResult(r)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reflection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-text-primary">🔍 {t('refl.title')}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">✕</button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!result && !loading && (
            <div className="text-center py-8">
              <p className="text-sm text-text-muted mb-4">{t('refl.reflect')}?</p>
              <button
                onClick={handleReflect}
                className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
              >
                {t('refl.reflect')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-text-muted text-sm">
              <div className="typing-indicator"><span></span><span></span><span></span></div>
              {t('refl.reflecting')}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {result && (
            <>
              {/* 反思结果 */}
              <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{t('refl.title')}</span>
                  <span className="text-xs text-text-muted">
                    {t('refl.confidence')}: <span className="font-mono text-accent-light">{(result.reflection.confidence * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-green-400 mb-1">✓ {t('refl.strengths')}</p>
                    <ul className="space-y-1">
                      {result.reflection.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-text-secondary">· {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-red-400 mb-1">✕ {t('refl.weaknesses')}</p>
                    <ul className="space-y-1">
                      {result.reflection.weaknesses.map((s, i) => (
                        <li key={i} className="text-xs text-text-secondary">· {s}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {result.reflection.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs text-accent-light mb-1">💡 {t('refl.suggestions')}</p>
                    <ul className="space-y-1">
                      {result.reflection.suggestions.map((s, i) => (
                        <li key={i} className="text-xs text-text-secondary">· {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 批评结果 */}
              {result.critique.issues.length > 0 && (
                <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">{t('refl.critique')}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${severityConfig[result.critique.severity] || ''}`}>
                      {result.critique.severity}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {result.critique.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded font-mono shrink-0 border ${severityConfig[issue.severity] || ''}`}>
                          {issue.severity}
                        </span>
                        <div className="flex-1">
                          <span className="text-text-primary">{issue.description}</span>
                          {issue.location && <span className="text-text-muted ml-1">({issue.location})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 纠正建议 */}
              {result.critique.corrections.length > 0 && (
                <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
                  <span className="text-sm font-medium text-text-primary">{t('refl.corrections')}</span>
                  {result.critique.corrections.map((c, i) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="text-red-400">- {c.original}</div>
                      <div className="text-green-400">+ {c.corrected}</div>
                      <div className="text-text-muted">→ {c.reason}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* 改进版本 */}
              {result.improvedOutput && result.improvedOutput !== output && (
                <div className="bg-surface border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text-primary">{t('refl.improved')}</span>
                    <button
                      onClick={() => setShowImproved(!showImproved)}
                      className="text-xs text-accent-light hover:text-accent"
                    >
                      {showImproved ? t('refl.original') : t('refl.improved')}
                    </button>
                  </div>
                  <pre className="text-xs text-text-secondary whitespace-pre-wrap bg-bg-primary/50 rounded-lg p-3 border border-border max-h-48 overflow-y-auto">
                    {showImproved ? result.improvedOutput : output}
                  </pre>
                  <button
                    onClick={() => navigator.clipboard.writeText(result.improvedOutput)}
                    className="text-xs text-accent-light hover:text-accent"
                  >
                    📋 {t('refl.copyImproved')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部 */}
        {result && (
          <div className="px-5 py-3 border-t border-border flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-bg-primary border border-border hover:bg-surface-hover text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              {t('refl.close')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
