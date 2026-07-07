import { useState } from 'react'
import { useT } from '../i18n'
import type { Plan, SubTask, TaskStatus } from '@shared/types'

const inputCls = 'w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none'
const btnCls = 'px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors'

const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  pending: { color: 'bg-gray-500/15 text-gray-400 border-gray-500/20', label: 'plan.status.pending' },
  running: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/20', label: 'plan.status.running' },
  completed: { color: 'bg-green-500/15 text-green-400 border-green-500/20', label: 'plan.status.completed' },
  failed: { color: 'bg-red-500/15 text-red-400 border-red-500/20', label: 'plan.status.failed' },
}

export default function PlanningView() {
  const t = useT()
  const [task, setTask] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDecompose = async () => {
    if (!task.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await window.aela.planning.generatePlan(task.trim())
      setPlan(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan')
    } finally {
      setLoading(false)
    }
  }

  const completedCount = plan?.subtasks.filter(s => s.status === 'completed').length ?? 0
  const failedCount = plan?.subtasks.filter(s => s.status === 'failed').length ?? 0

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* 标题 */}
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{t('plan.title')}</h2>
          <p className="text-xs text-text-muted mt-1">{t('plan.desc')}</p>
        </div>

        {/* 任务输入 */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <label className="text-sm font-medium text-text-primary">{t('plan.inputTask')}</label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            rows={3}
            placeholder={t('plan.taskPlaceholder')}
            className={inputCls + ' resize-none'}
          />
          <button
            onClick={handleDecompose}
            disabled={!task.trim() || loading}
            className={btnCls}
          >
            {loading ? t('plan.generating') : t('plan.decompose')}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* 计划展示 */}
        {plan ? (
          <div className="space-y-4">
            {/* 进度条 */}
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-text-primary">{t('plan.progress')}</span>
                <span className="text-xs text-text-muted">
                  {completedCount}/{plan.subtasks.length} {t('plan.status.completed')}
                  {failedCount > 0 && ` · ${failedCount} ${t('plan.status.failed')}`}
                </span>
              </div>
              <div className="w-full h-2 bg-bg-primary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(completedCount / plan.subtasks.length) * 100}%` }}
                />
              </div>
            </div>

            {/* 子任务列表 */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
              <label className="text-sm font-medium text-text-primary">{t('plan.subtasks')}</label>
              {plan.subtasks.map((st: SubTask, idx: number) => {
                const sc = statusConfig[st.status]
                return (
                  <div key={st.id} className="flex items-start gap-3 p-3 bg-bg-primary/50 rounded-lg border border-border">
                    <span className="text-xs font-mono text-text-muted shrink-0 mt-0.5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">{st.description}</p>
                      {st.dependsOn.length > 0 && (
                        <p className="text-xs text-text-muted mt-1">
                          {t('plan.dependency')}: {st.dependsOn.map(d => `#${d}`).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 border ${sc.color}`}>
                      {t(sc.label)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          !loading && (
            <div className="text-center text-text-muted text-sm py-8 bg-surface/50 border border-dashed border-border rounded-xl">
              {t('plan.noPlan')}
            </div>
          )
        )}
      </div>
    </div>
  )
}
