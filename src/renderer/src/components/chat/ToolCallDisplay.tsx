import { useState } from 'react'

interface Props {
  toolCallId: string
  content: string
  isError: boolean
  isPending?: boolean
}

export default function ToolCallDisplay({ content, isError, isPending }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Defensive: ensure content is always a string (SDK tools may return objects)
  const safeContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2)

  // 截取内容前 200 字符作为预览
  const preview = safeContent.length > 200 ? safeContent.slice(0, 200) + '...' : safeContent
  const displayContent = expanded ? safeContent : preview

  return (
    <div
      className={`rounded-lg border text-xs overflow-hidden my-1 ${
        isError
          ? 'border-red-700/50 bg-red-900/20'
          : isPending
          ? 'border-yellow-700/50 bg-yellow-900/20'
          : 'border-border bg-surface'
      }`}
    >
      {/* 头部 */}
      <div
        onClick={() => safeContent.length > 200 && setExpanded(!expanded)}
        className={`flex items-center justify-between px-3 py-1.5 ${
          safeContent.length > 200 ? 'cursor-pointer hover:bg-surface-hover' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={isError ? 'text-red-400' : isPending ? 'text-yellow-400' : 'text-green-400'}>
            {isError ? '❌' : isPending ? '⏳' : '✅'}
          </span>
          <span className="text-text-secondary font-mono">
            {isPending ? '工具执行中' : '工具结果'}
          </span>
        </div>
        {safeContent.length > 200 && (
          <span className="text-text-muted">
            {expanded ? '收起 ▲' : '展开 ▼'}
          </span>
        )}
      </div>

      {/* 内容 */}
      <div className="px-3 py-2 border-t border-border/50 text-text-secondary font-mono whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
        {displayContent}
      </div>
    </div>
  )
}
