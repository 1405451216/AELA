// AELA — Checkpoint 时间线组件
// 显示当前会话的检查点列表，支持回滚到任意检查点

import { useState, useEffect, useCallback } from 'react'
import { useConfigStore } from '../stores/configStore'

interface CheckpointSnapshot {
  id: string
  sessionId: string
  createdAt: string
  description: string
  fileCount: number
}

// 自包含组件：从 configStore 获取当前会话
export default function CheckpointTimeline() {
  const sessionId = useConfigStore(s => s.currentSession?.id ?? null)
  const [checkpoints, setCheckpoints] = useState<CheckpointSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  // 加载检查点列表
  const loadCheckpoints = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const list = await window.aela?.checkpoint?.list?.(sessionId) ?? []
      setCheckpoints(list)
    } catch (err) {
      console.error('[Checkpoint] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    loadCheckpoints()
  }, [loadCheckpoints])

  // 回滚到检查点
  const handleRestore = async (checkpointId: string) => {
    if (!confirm('确定要回滚到此检查点吗？这将恢复所有被修改的文件到修改前的状态。')) return
    setRestoring(checkpointId)
    try {
      const result = await window.aela?.checkpoint?.restore?.(checkpointId)
      if (result?.success) {
        alert(`已恢复 ${result.restoredCount} 个文件`)
        // 触发刷新
        window.dispatchEvent(new CustomEvent('aela-refresh-sessions'))
      }
    } catch (err) {
      alert(`回滚失败: ${(err as Error).message}`)
    } finally {
      setRestoring(null)
    }
  }

  // 删除检查点
  const handleDelete = async (checkpointId: string) => {
    try {
      await window.aela?.checkpoint?.delete?.(checkpointId)
      setCheckpoints(prev => prev.filter(c => c.id !== checkpointId))
    } catch (err) {
      console.error('[Checkpoint] Delete failed:', err)
    }
  }

  if (!sessionId) {
    return (
      <div className="p-8 text-center text-text-muted text-sm">
        请先选择一个会话
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🕐</span>
          <h2 className="text-sm font-bold text-text-primary">检查点时间线</h2>
          {checkpoints.length > 0 && (
            <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">
              {checkpoints.length} 个快照
            </span>
          )}
        </div>
      </div>

      {/* 时间线列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-text-muted text-sm py-8">加载中...</div>
        ) : checkpoints.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8">
            <div className="text-3xl mb-2">📋</div>
            <p>暂无检查点</p>
            <p className="text-xs mt-1">当 AI 修改文件时会自动创建快照</p>
          </div>
        ) : (
          <div className="relative">
            {/* 竖线 */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-3">
              {checkpoints.map((cp, index) => (
                <div key={cp.id} className="relative pl-10">
                  {/* 圆点 */}
                  <div className={`absolute left-2 top-3 w-3 h-3 rounded-full border-2 ${
                    index === 0
                      ? 'bg-accent border-accent'
                      : 'bg-bg-primary border-border'
                  }`} />

                  {/* 卡片 */}
                  <div className="bg-bg-secondary border border-border rounded-lg p-3 hover:border-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary font-medium truncate">
                          {cp.description}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-muted">
                          <span>{new Date(cp.createdAt).toLocaleString('zh-CN')}</span>
                          <span className="flex items-center gap-0.5">
                            📄 {cp.fileCount} 个文件
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleRestore(cp.id)}
                          disabled={restoring === cp.id}
                          className="px-2 py-1 text-[10px] rounded bg-accent/10 text-accent-light hover:bg-accent/20 disabled:opacity-50 transition-colors"
                          title="回滚到此检查点"
                        >
                          {restoring === cp.id ? '恢复中...' : '↩ 回滚'}
                        </button>
                        <button
                          onClick={() => handleDelete(cp.id)}
                          className="px-2 py-1 text-[10px] rounded text-text-muted hover:bg-error/10 hover:text-error transition-colors"
                          title="删除此检查点"
                        >✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
