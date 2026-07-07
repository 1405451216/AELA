// AELA — Inline Completion Hook
// 在 textarea 上提供 ghost text 补全效果
// Tab 接受 / Esc 拒绝 / 300ms 去抖

import { useState, useRef, useCallback, useEffect } from 'react'

interface InlineCompletionState {
  text: string
  visible: boolean
  loading: boolean
}

export function useInlineCompletion(
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  enabled: boolean,
  filePath: string,
  language: string,
  content: string,
) {
  const [state, setState] = useState<InlineCompletionState>({
    text: '',
    visible: false,
    loading: false,
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestCompletion = useCallback(async () => {
    if (!enabled || !textareaRef.current) return

    const textarea = textareaRef.current
    const cursorPos = textarea.selectionStart
    const before = content.slice(0, cursorPos)
    const after = content.slice(cursorPos)

    const beforeLines = before.split('\n')
    const cursorLine = beforeLines.length - 1
    const cursorColumn = beforeLines[beforeLines.length - 1].length

    setState(prev => ({ ...prev, loading: true }))

    try {
      const result = await window.aela?.inlineCompletion?.complete?.({
        filePath,
        language,
        contentBefore: before,
        contentAfter: after,
        cursorLine,
        cursorColumn,
      })

      if (result?.text && result.text.length > 1) {
        setState({ text: result.text, visible: true, loading: false })
      } else {
        setState({ text: '', visible: false, loading: false })
      }
    } catch {
      setState({ text: '', visible: false, loading: false })
    }
  }, [enabled, textareaRef, filePath, language, content])

  const trigger = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(requestCompletion, 300)
  }, [requestCompletion])

  // 接受补全 — 返回要插入的文本
  const accept = useCallback((): string => {
    if (!state.visible || !state.text) return ''
    const text = state.text
    setState({ text: '', visible: false, loading: false })
    return text
  }, [state])

  // 拒绝补全
  const dismiss = useCallback(() => {
    setState(prev => prev.visible ? { ...prev, visible: false } : prev)
  }, [])

  // 监听 Tab/Esc 键
  useEffect(() => {
    if (!state.visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && state.visible) {
        e.preventDefault()
        const text = accept()
        if (text) {
          // 触发自定义事件让 InputBox 处理插入
          window.dispatchEvent(new CustomEvent('aela-inline-accept', { detail: text }))
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [state.visible, accept, dismiss])

  return {
    completionText: state.visible ? state.text : '',
    isLoading: state.loading,
    isVisible: state.visible,
    trigger,
    accept,
    dismiss,
  }
}
