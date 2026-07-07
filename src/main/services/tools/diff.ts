// 行级 diff 计算（基于 LCS + 大文件降级）
// 暴露给 ToolManager.getFileDiff 使用。
//
// 大文件保护：当 m * n 超过 MAX_DIFF_CELLS 时，降级为简单行级对比。
// 降级算法：依次对齐两边的行，匹配相同前缀/后缀，其余标记为 removed + added。
// 这牺牲了"最小编辑距离"的最优性，但保证 O(m+n) 内存 + 始终能返回结果。

import type { FileDiffLine } from '@shared/types'

/** LCS DP 表的最大维度上限 (行 × 列)，超过即降级 */
export const MAX_DIFF_CELLS = 2_000_000 // 2000 行 × 1000 行 的安全范围

export function computeLineDiff(original: string, modified: string): FileDiffLine[] {
  const oldLines = original.split('\n')
  const newLines = modified.split('\n')
  const m = oldLines.length
  const n = newLines.length

  // 大文件降级路径
  if (m * n > MAX_DIFF_CELLS) {
    return computeLineDiffFallback(oldLines, newLines)
  }

  // LCS DP 表
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

  // 回溯生成 diff
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

/** 降级版行级 diff：O(m+n) 内存 */
function computeLineDiffFallback(
  oldLines: string[],
  newLines: string[]
): FileDiffLine[] {
  const m = oldLines.length
  const n = newLines.length

  // 共同前缀
  let prefix = 0
  const maxPrefix = Math.min(m, n)
  while (prefix < maxPrefix && oldLines[prefix] === newLines[prefix]) {
    prefix++
  }

  // 共同后缀（不与前缀重叠）
  let suffix = 0
  const maxSuffix = Math.min(m - prefix, n - prefix)
  while (
    suffix < maxSuffix &&
    oldLines[m - 1 - suffix] === newLines[n - 1 - suffix]
  ) {
    suffix++
  }

  const result: FileDiffLine[] = []

  for (let i = 0; i < prefix; i++) {
    result.push({
      type: 'context',
      oldLineNumber: i + 1,
      newLineNumber: i + 1,
      content: oldLines[i],
    })
  }

  for (let i = prefix; i < m - suffix; i++) {
    result.push({
      type: 'removed',
      oldLineNumber: i + 1,
      newLineNumber: null,
      content: oldLines[i],
    })
  }

  for (let j = prefix; j < n - suffix; j++) {
    result.push({
      type: 'added',
      oldLineNumber: null,
      newLineNumber: j + 1,
      content: newLines[j],
    })
  }

  for (let k = 0; k < suffix; k++) {
    result.push({
      type: 'context',
      oldLineNumber: m - suffix + k + 1,
      newLineNumber: n - suffix + k + 1,
      content: oldLines[m - suffix + k],
    })
  }

  return result
}