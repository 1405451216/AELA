import { useDialogStore } from '../stores/dialog'
import { useRef, useEffect, useCallback } from 'react'

/**
 * 全局对话框组件 — 替代原生 confirm / alert / prompt
 * 挂载在 App 根节点，由 dialog store 控制
 */
export default function Dialog() {
  const { visible, options, inputValue, setInputValue, resolve } = useDialogStore()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  // Focus trap: remember element that was focused before dialog opened,
  // trap Tab focus inside, and restore focus on close.
  useEffect(() => {
    if (visible) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement
    }
  }, [visible])

  useEffect(() => {
    if (!visible) {
      // Restore focus after dialog closes
      previouslyFocusedRef.current?.focus?.()
      previouslyFocusedRef.current = null
    }
  }, [visible])

  const handleTrapFocus = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
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

  if (!visible) return null

  const isPrompt = !!options.inputMode
  const isAlert = !options.cancelText
  const variant = options.variant ?? 'default'

  const variantColors = {
    default: 'bg-accent hover:bg-accent-hover text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
  }

  const handleConfirm = () => {
    if (isPrompt) {
      resolve(inputValue)
    } else {
      resolve(true)
    }
  }

  const handleCancel = () => {
    resolve(isPrompt ? null : false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    handleTrapFocus(e)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const dialogLabelId = 'aela-dialog-title'
  const dialogDescId = 'aela-dialog-desc'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-label={options.title}
      aria-labelledby={options.title ? dialogLabelId : undefined}
      aria-describedby={dialogDescId}
    >
      <div
        ref={dialogRef}
        className="bg-bg-secondary rounded-xl shadow-2xl border border-border max-w-md w-full mx-4 p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* 标题 */}
        {options.title && (
          <h2 id={dialogLabelId} className="text-lg font-bold text-text-primary mb-3">
            {options.title}
          </h2>
        )}

        {/* 消息 */}
        <p id={dialogDescId} className="text-sm text-text-secondary mb-4 whitespace-pre-wrap">
          {options.message}
        </p>

        {/* 输入框 (prompt 模式) */}
        {isPrompt && (
          <input
            type={options.inputMode === 'password' ? 'password' : 'text'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={options.inputPlaceholder}
            autoFocus
            className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none mb-4"
          />
        )}

        {/* 按钮 */}
        <div className="flex justify-end gap-3">
          {!isAlert && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm bg-bg-tertiary hover:opacity-80 text-text-secondary transition-opacity"
            >
              {options.cancelText || '取消'}
            </button>
          )}
          <button
            onClick={handleConfirm}
            autoFocus={isAlert}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-opacity ${variantColors[variant]}`}
          >
            {options.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
