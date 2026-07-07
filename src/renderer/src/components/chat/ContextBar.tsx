import { memo } from 'react'

interface ContextBarProps {
  activeFile: string | null
  errorCount: number
  warningCount: number
  gitModified: number
}

function ContextBarInner({ activeFile, errorCount, warningCount, gitModified }: ContextBarProps) {
  if (!activeFile && errorCount === 0 && warningCount === 0 && gitModified === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 text-xs border-b border-border bg-bg-secondary/50 text-text-muted">
      {activeFile && (
        <span className="flex items-center gap-1">
          <span className="text-accent">📄</span>
          <span className="font-mono truncate max-w-48">{activeFile}</span>
        </span>
      )}
      {errorCount > 0 && (
        <span className="flex items-center gap-0.5 text-red-400">
          <span>❌</span>
          <span>{errorCount}</span>
        </span>
      )}
      {warningCount > 0 && (
        <span className="flex items-center gap-0.5 text-yellow-400">
          <span>⚠️</span>
          <span>{warningCount}</span>
        </span>
      )}
      {gitModified > 0 && (
        <span className="flex items-center gap-0.5 text-blue-400">
          <span>⎇</span>
          <span>{gitModified}</span>
        </span>
      )}
    </div>
  )
}

export default memo(ContextBarInner)
