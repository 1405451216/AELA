import { memo, useState, useRef, useCallback, type KeyboardEvent } from 'react'
import type { ChatMessage } from '@shared/types'

interface Props {
  message: ChatMessage
  onEdit?: (messageId: string, newContent: string) => void
}

function InlineEditButtonInner({ message, onEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const startEdit = useCallback(() => {
    setDraft(message.content)
    setIsEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [message.content])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setDraft(message.content)
  }, [message.content])

  const submitEdit = useCallback(() => {
    if (draft.trim() && draft !== message.content) {
      onEdit?.(message.id, draft.trim())
    }
    setIsEditing(false)
  }, [draft, message.id, message.content, onEdit])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      submitEdit()
    }
    if (e.key === 'Escape') {
      cancelEdit()
    }
  }, [submitEdit, cancelEdit])

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 mt-1">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full resize-none rounded-md bg-bg-secondary border border-accent/40 px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          rows={Math.min(8, draft.split('\n').length + 1)}
        />
        <div className="flex gap-2 text-xs">
          <button
            onClick={submitEdit}
            className="text-accent hover:text-accent-light transition-colors"
          >
            保存
          </button>
          <button
            onClick={cancelEdit}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            取消
          </button>
          <span className="text-text-muted ml-auto">Ctrl+Enter 保存 · Esc 取消</span>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={startEdit}
      className="text-xs text-text-muted hover:text-accent-light transition-colors"
      title="编辑此消息"
    >
      ✏️ 编辑
    </button>
  )
}

export default memo(InlineEditButtonInner)
