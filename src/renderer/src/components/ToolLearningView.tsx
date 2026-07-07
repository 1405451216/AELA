// [升级 5] 工具学习闭环 — 可视化面板
// 展示工具使用统计、成功率趋势、失败模式分析和最佳实践
import { useState, useEffect, useCallback } from 'react'
import type { ToolLearningVisualization } from '@shared/types'

export default function ToolLearningView() {
  const [viz, setViz] = useState<ToolLearningVisualization | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.aela.toolLearningExt.visualization()
      setViz(data)
    } catch (err) {
      console.error('Failed to load visualization:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleClear = async () => {
    if (!confirm('确定清空所有工具学习记录？此操作不可撤销。')) return
    try {
      await window.aela.toolLearningExt.clear()
      load()
    } catch (err) {
      console.error('Clear failed:', err)
    }
  }

  if (loading && !viz) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-text-muted py-20">加载工具学习数据中...</div>
      </div>
    )
  }

  if (!viz) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-text-muted py-20">暂无数据</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🧠</span>
          <h1 className="text-xl font-bold text-text-primary">工具学习分析</h1>
        </div>
        <p className="text-sm text-text-muted">
          工具调用成功率 · 失败模式 · 最佳实践 · 自适应优化
        </p>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl">
        {/* 概览 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <span className="text-xs text-text-muted">总成功率</span>
            </div>
            <div className={`text-2xl font-bold mt-1 ${
              viz.overallSuccessRate > 0.8 ? 'text-green-400' :
              viz.overallSuccessRate > 0.5 ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {(viz.overallSuccessRate * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔧</span>
              <span className="text-xs text-text-muted">追踪工具数</span>
            </div>
            <div className="text-2xl font-bold text-text-primary mt-1">{viz.totalToolsTracked}</div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center justify-center">
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-border hover:bg-red-500/10 hover:border-red-500/50 text-text-secondary hover:text-red-400 text-xs transition-colors"
            >
              🗑️ 清空记录
            </button>
          </div>
        </div>

        {/* 工具统计 */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">工具调用统计</h3>
          {viz.toolStats.length === 0 ? (
            <p className="text-center text-text-muted text-sm py-4">暂无工具调用记录</p>
          ) : (
            <div className="space-y-2">
              {viz.toolStats
                .sort((a, b) => b.totalCalls - a.totalCalls)
                .map((stat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary w-40 truncate" title={stat.toolName}>
                      {stat.toolName}
                    </span>
                    <div className="flex-1 bg-bg-primary rounded-full h-3 overflow-hidden relative">
                      <div
                        className={`h-full ${
                          stat.successRate > 0.8 ? 'bg-green-500' :
                          stat.successRate > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${stat.successRate * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-12 text-right ${
                      stat.successRate > 0.8 ? 'text-green-400' :
                      stat.successRate > 0.5 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {(stat.successRate * 100).toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-text-muted w-16 text-right">
                      {stat.totalCalls} 次
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* 失败模式分析 */}
        {viz.failureModes.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3">⚠️ 失败模式分析</h3>
            <div className="space-y-2">
              {viz.failureModes
                .sort((a, b) => b.count - a.count)
                .map((mode, i) => (
                  <div key={i} className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-red-400">{mode.toolName}</span>
                          <span className="text-[10px] text-text-muted">
                            {mode.count} 次 · 最后出现: {new Date(mode.lastSeen).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary font-mono bg-bg-primary rounded px-2 py-1">
                          {mode.error}
                        </p>
                        {mode.suggestedFix && (
                          <p className="text-xs text-green-400 mt-1">
                            💡 {mode.suggestedFix}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 最佳实践 */}
        {viz.bestPractices.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3">✅ 最佳实践</h3>
            <div className="space-y-2">
              {viz.bestPractices
                .sort((a, b) => b.successRate - a.successRate)
                .map((bp, i) => (
                  <div key={i} className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-green-400">{bp.toolName}</span>
                        <span className="text-[10px] text-text-muted">{bp.pattern}</span>
                      </div>
                      <span className={`text-xs font-mono ${
                        bp.successRate > 0.9 ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {(bp.successRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">{bp.description}</p>
                    {bp.examples.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {bp.examples.slice(0, 2).map((ex, ei) => (
                          <pre key={ei} className="text-[10px] text-text-muted bg-bg-primary rounded px-2 py-1 overflow-x-auto">
                            {ex.length > 200 ? ex.slice(0, 200) + '...' : ex}
                          </pre>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
