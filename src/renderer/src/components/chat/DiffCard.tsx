import { useState, useMemo, useCallback } from 'react'
import type { FileDiffLine } from '@shared/types'

export interface DiffCardProps {
  diffId: string
  filePath: string
  description: string
  originalContent: string
  fixedContent: string
  onAccept: (diffId: string) => void
  onReject: (diffId: string) => void
}

interface ComputedDiffLine {
  type: 'context' | 'added' | 'removed'
  oldLineNumber: number | null
  newLineNumber: number | null
  content: string
}

function computeDiff(original: string, modified: string): ComputedDiffLine[] {
  const oldLines = original.split('\n')
  const newLines = modified.split('\n')
  const m = oldLines.length
  const n = newLines.length

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i1 = 1; i1 <= m; i1++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i1 - 1] === newLines[j - 1]) {
        dp[i1][j] = dp[i1 - 1][j - 1] + 1
      } else {
        dp[i1][j] = Math.max(dp[i1 - 1][j], dp[i1][j - 1])
      }
    }
  }

  const result: ComputedDiffLine[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({
        type: 'context',
        oldLineNumber: i,
        newLineNumber: j,
        content: oldLines[i - 1],
      })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({
        type: 'added',
        oldLineNumber: null,
        newLineNumber: j,
        content: newLines[j - 1],
      })
      j--
    } else if (i > 0) {
      result.unshift({
        type: 'removed',
        oldLineNumber: i,
        newLineNumber: null,
        content: oldLines[i - 1],
      })
      i--
    }
  }

  return result
}

export default function DiffCard({
  diffId,
  filePath,
  description,
  originalContent,
  fixedContent,
  onAccept,
  onReject,
}: DiffCardProps) {
  const [expanded, setExpanded] = useState(false)

  const diffLines = useMemo<FileDiffLine[]>(
    () => computeDiff(originalContent, fixedContent) as FileDiffLine[],
    [originalContent, fixedContent],
  )

  const stats = useMemo(() => {
    let additions = 0
    let deletions = 0
    for (const line of diffLines) {
      if (line.type === 'added') additions++
      else if (line.type === 'removed') deletions++
    }
    return { additions, deletions }
  }, [diffLines])

  const displayLines = useMemo(() => {
    if (expanded) return diffLines

    let firstChange = -1
    let lastChange = -1
    for (let k = 0; k < diffLines.length; k++) {
      if (diffLines[k].type !== 'context') {
        if (firstChange === -1) firstChange = k
        lastChange = k
      }
    }
    if (firstChange === -1) return diffLines.slice(0, 10)

    const start = Math.max(0, firstChange - 2)
    const end = Math.min(diffLines.length, lastChange + 3)
    return diffLines.slice(start, end)
  }, [diffLines, expanded])

  const handleAccept = useCallback(() => {
    onAccept(diffId)
  }, [diffId, onAccept])

  const handleReject = useCallback(() => {
    onReject(diffId)
  }, [diffId, onReject])

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-hover border-b border-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-primary flex-shrink-0"
            title={expanded ? '收起' : '展开'}
          >
            {expanded ? '▼' : '▶'}
          </button>
          <span className="text-xs font-medium text-accent truncate" title={description}>
            {description}
          </span>
          <span className="text-xs font-mono text-text-secondary truncate" title={filePath}>
            {filePath}
          </span>
          <span className="flex items-center gap-1 text-[10px] flex-shrink-0">
            <span className="text-green-400">+{stats.additions}</span>
            <span className="text-red-400">-{stats.deletions}</span>
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <button
            onClick={handleAccept}
            className="px-2.5 py-1 rounded text-xs font-medium bg-green-900/40 hover:bg-green-800/60 text-green-400 border border-green-700/50 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="px-2.5 py-1 rounded text-xs font-medium bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-700/50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-surface-hover hover:bg-surface-active text-text-secondary border border-border transition-colors"
          >
            View Details
          </button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-x-auto max-h-[300px] overflow-y-auto font-mono text-xs">
          <table className="w-full">
            <tbody>
              {displayLines.map((line, idx) => {
                const bgClass =
                  line.type === 'added'
                    ? 'bg-green-950/30'
                    : line.type === 'removed'
                    ? 'bg-red-950/30'
                    : ''
                const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '
                const prefixClass =
                  line.type === 'added' ? 'text-green-500' : line.type === 'removed' ? 'text-red-500' : 'text-text-muted'

                return (
                  <tr key={idx} className={`${bgClass} hover:bg-surface-hover/50`}>
                    <td className="px-2 py-0 text-right text-text-muted select-none w-10 border-r border-border/30">
                      {line.oldLineNumber ?? ''}
                    </td>
                    <td className="px-2 py-0 text-right text-text-muted select-none w-10 border-r border-border/30">
                      {line.newLineNumber ?? ''}
                    </td>
                    <td className={`px-1 select-none ${prefixClass}`}>{prefix}</td>
                    <td className="px-2 py-0 text-text-secondary whitespace-pre">
                      {line.content || ' '}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!expanded && (stats.additions > 4 || stats.deletions > 4) && (
        <div className="text-center py-1 text-text-muted text-[10px] bg-surface-hover/30">
          点击 View Details 查看全部 {diffLines.length} 行变更
        </div>
      )}
    </div>
  )
}
