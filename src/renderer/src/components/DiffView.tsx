import { useState, useMemo, useCallback } from 'react'
import type { FileChangeRecord, FileDiffLine } from '@shared/types'

interface DiffViewProps {
  /** 文件变更记录 */
  change: FileChangeRecord
  /** 是否默认展开 */
  defaultExpanded?: boolean
  /** 接受变更回调 */
  onAccept?: (id: string) => void
  /** 拒绝变更回调 */
  onReject?: (id: string) => void
}

/**
 * 行级 diff 计算（LCS 算法）
 * 与主进程 computeLineDiff 逻辑一致，但运行在渲染进程
 */
function computeDiff(original: string, modified: string): FileDiffLine[] {
  const oldLines = original.split('\n')
  const newLines = modified.split('\n')
  const m = oldLines.length
  const n = newLines.length

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const result: FileDiffLine[] = []
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

/**
 * Diff 视图组件
 * 展示 Agent 对文件的修改，支持接受/拒绝操作
 */
export default function DiffView({ change, defaultExpanded = true, onAccept, onReject }: DiffViewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const diffLines = useMemo(
    () => computeDiff(change.originalContent, change.newContent),
    [change.originalContent, change.newContent]
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

  const handleAccept = useCallback(() => {
    onAccept?.(change.id)
  }, [change.id, onAccept])

  const handleReject = useCallback(() => {
    onReject?.(change.id)
  }, [change.id, onReject])

  const changeTypeBadge = useMemo(() => {
    switch (change.changeType) {
      case 'created':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-900/50 text-green-400 border border-green-700/50">新建</span>
      case 'modified':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/50 text-blue-400 border border-blue-700/50">修改</span>
      case 'deleted':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900/50 text-red-400 border border-red-700/50">删除</span>
      default:
        return null
    }
  }, [change.changeType])

  const statusBadge = useMemo(() => {
    if (change.accepted) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-900/30 text-green-400">已接受</span>
    }
    if (change.rejected) {
      return <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-900/30 text-red-400">已拒绝</span>
    }
    return null
  }, [change.accepted, change.rejected])

  // 折叠时只显示 diff 摘要（前后 3 行）
  const displayLines = useMemo(() => {
    if (expanded) return diffLines

    // 找到第一个和最后一个变更行
    let firstChange = -1
    let lastChange = -1
    for (let i = 0; i < diffLines.length; i++) {
      if (diffLines[i].type !== 'context') {
        if (firstChange === -1) firstChange = i
        lastChange = i
      }
    }
    if (firstChange === -1) return diffLines

    const start = Math.max(0, firstChange - 3)
    const end = Math.min(diffLines.length, lastChange + 4)
    return diffLines.slice(start, end)
  }, [diffLines, expanded])

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-2">
      {/* 头部：文件路径 + 变更统计 + 操作按钮 */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-hover border-b border-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text-primary flex-shrink-0"
            title={expanded ? '收起' : '展开'}
          >
            {expanded ? '▼' : '▶'}
          </button>
          {changeTypeBadge}
          <span className="text-xs font-mono text-text-secondary truncate" title={change.filePath}>
            {change.filePath}
          </span>
          <span className="flex items-center gap-1 text-[10px] flex-shrink-0">
            <span className="text-green-400">+{stats.additions}</span>
            <span className="text-red-400">-{stats.deletions}</span>
          </span>
          {statusBadge}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {!change.accepted && !change.rejected && (
            <>
              <button
                onClick={handleAccept}
                className="px-2 py-0.5 rounded text-[10px] bg-green-900/40 hover:bg-green-800/60 text-green-400 border border-green-700/50 transition-colors"
                title="接受变更"
              >
                ✓ 接受
              </button>
              <button
                onClick={handleReject}
                className="px-2 py-0.5 rounded text-[10px] bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-700/50 transition-colors"
                title="拒绝变更（回滚到原始内容）"
              >
                ✕ 拒绝
              </button>
            </>
          )}
        </div>
      </div>

      {/* Diff 内容 */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto font-mono text-xs">
        <table className="w-full">
          <tbody>
            {displayLines.map((line, idx) => {
              const bgClass =
                line.type === 'added'
                  ? 'bg-green-950/30'
                  : line.type === 'removed'
                  ? 'bg-red-950/30'
                  : ''
              const textClass =
                line.type === 'added'
                  ? 'text-green-300'
                  : line.type === 'removed'
                  ? 'text-red-300'
                  : 'text-text-muted'
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
                  <td className={`px-2 py-0 ${textClass} whitespace-pre`}>
                    {line.content || ' '}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!expanded && (stats.additions > 6 || stats.deletions > 6) && (
          <div className="text-center py-1 text-text-muted text-[10px] bg-surface-hover/30">
            ... {diffLines.length - displayLines.length} 行未展示，点击 ▶ 展开全部
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="px-3 py-1 border-t border-border/50 text-[10px] text-text-muted flex items-center justify-between">
        <span>{change.agentName}</span>
        <span>{new Date(change.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

/**
 * Diff 列表组件 — 展示多个文件变更
 */
export function DiffList({
  changes,
  onAccept,
  onReject,
}: {
  changes: FileChangeRecord[]
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
}) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        暂无文件变更
      </div>
    )
  }

  // 单次遍历同时计算 additions 和 deletions，避免重复调用 computeDiff
  const { totalAdditions, totalDeletions } = changes.reduce((acc, c) => {
    for (const l of computeDiff(c.originalContent, c.newContent)) {
      if (l.type === 'added') acc.totalAdditions++
      else if (l.type === 'removed') acc.totalDeletions++
    }
    return acc
  }, { totalAdditions: 0, totalDeletions: 0 })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-text-muted px-2 py-1">
        <span>{changes.length} 个文件变更</span>
        <span className="text-green-400">+{totalAdditions}</span>
        <span className="text-red-400">-{totalDeletions}</span>
      </div>
      {changes.map(change => (
        <DiffView
          key={change.id}
          change={change}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </div>
  )
}
