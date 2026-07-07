import { useState, useRef, useEffect, useCallback } from 'react'
import { useT } from '../../i18n'
import type { HITLInterruptRequest, HITLResponse } from '@shared/types'

interface Props {
  request: HITLInterruptRequest
  onRespond: (response: HITLResponse) => void
}

export default function HITLApprovalModal({ request, onRespond }: Props) {
  const t = useT()
  const [feedback, setFeedback] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Save and restore focus around modal visibility
  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement
    return () => {
      previouslyFocusedRef.current?.focus?.()
      previouslyFocusedRef.current = null
    }
  }, [])

  const handleTrapFocus = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return
    const focusables = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  const toolCall = request.data?.toolCall as { name?: string; arguments?: string } | undefined
  const toolName = toolCall?.name || request.data?.toolName as string || 'unknown'
  const toolArgs = toolCall?.arguments || ''

  const reasonLabels: Record<string, string> = {
    tool_confirm: t('hitl.reason.toolConfirm'),
    decision_point: t('hitl.reason.decisionPoint'),
    budget_exceed: t('hitl.reason.budgetExceed'),
    custom: t('hitl.reason.custom'),
  }

  const handleApprove = () => {
    onRespond({
      requestId: request.id || '',
      approved: true,
      feedback: feedback || undefined,
      timestamp: new Date().toISOString(),
    })
  }

  const handleReject = () => {
    onRespond({
      requestId: request.id || '',
      approved: false,
      feedback: feedback || t('hitl.defaultReject'),
      timestamp: new Date().toISOString(),
    })
  }

  const dialogDescId = 'hitl-modal-desc'

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-describedby={dialogDescId}
      onKeyDown={handleTrapFocus}
    >
      <div className="w-full max-w-lg bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <span className="text-2xl">🤝</span>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-text-primary">{t('hitl.title')}</h3>
            <p className="text-xs text-text-muted mt-0.5">
              {t('hitl.turn')} {request.turn} · {reasonLabels[request.reason] || request.reason}
            </p>
          </div>
          <span className="px-2 py-1 rounded-full text-xs font-mono bg-yellow-500/15 text-yellow-500 border border-yellow-500/20">
            {request.reason}
          </span>
        </div>

        {/* 内容区 */}
        <div className="px-5 py-4 space-y-4">
          {/* 消息 */}
          <div id={dialogDescId} className="bg-surface border border-border rounded-lg px-4 py-3">
            <p className="text-sm text-text-primary">{request.message}</p>
          </div>

          {/* 工具调用详情 */}
          {toolCall && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">{t('hitl.toolName')}</label>
                <code className="block bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm font-mono border border-border">
                  {toolName}
                </code>
              </div>
              {toolArgs && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">{t('hitl.toolArgs')}</label>
                  <pre className="block bg-bg-primary text-text-secondary rounded-lg px-3 py-2 text-xs font-mono border border-border max-h-40 overflow-y-auto whitespace-pre-wrap break-all">
                    {toolArgs}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* 预算超限详情 */}
          {request.reason === 'budget_exceed' && request.data && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(request.data, null, 2)}
              </pre>
            </div>
          )}

          {/* 反馈输入 */}
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('hitl.feedbackLabel')}</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder={t('hitl.feedbackPlaceholder')}
              className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* 按钮区 */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={handleReject}
            className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ✕ {t('hitl.reject')}
          </button>
          <button
            onClick={handleApprove}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            ✓ {t('hitl.approve')}
          </button>
        </div>
      </div>
    </div>
  )
}
