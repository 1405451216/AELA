// 监督者池 Tab — Worker 管理 / 策略选择 / 任务提交 / 实时统计
import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../../stores/app'
import { useT } from '../../i18n'
import type {
  AssignmentStrategy,
  SupervisorWorker,
  SupervisorStats,
  SupervisorTaskResult,
  ModelConfig,
} from '@shared/types'

const STRATEGY_INFO: Record<AssignmentStrategy, { label: string; icon: string; desc: string }> = {
  round_robin: { label: '轮询', icon: '🔄', desc: '按顺序轮流分配' },
  load_balanced: { label: '负载均衡', icon: '⚖️', desc: '分配给当前负载最低的 Worker' },
  skill_based: { label: '技能匹配', icon: '🎯', desc: '根据任务所需技能匹配最合适的 Worker' },
}

interface WorkerForm {
  name: string
  skills: string
  maxConcurrency: number
  modelConfigId: string
  systemPrompt: string
}

interface TaskForm {
  name: string
  type: string
  input: string
  requiredSkills: string
  priority: number
}

export default function SupervisorTab() {
  const t = useT()
  const { modelList, setError } = useAppStore()
  const [strategy, setStrategy] = useState<AssignmentStrategy>('load_balanced')
  const [workers, setWorkers] = useState<SupervisorWorker[]>([])
  const [stats, setStats] = useState<SupervisorStats | null>(null)
  const [workerForm, setWorkerForm] = useState<WorkerForm>({
    name: '', skills: '', maxConcurrency: 3, modelConfigId: '', systemPrompt: '',
  })
  const [taskForm, setTaskForm] = useState<TaskForm>({
    name: '', type: 'generic', input: '', requiredSkills: '', priority: 5,
  })
  const [taskResults, setTaskResults] = useState<SupervisorTaskResult[]>([])
  const [submitting, setSubmitting] = useState(false)

  const refreshWorkers = useCallback(async () => {
    try {
      const [workerList, statsData] = await Promise.all([
        window.aela.supervisor.listWorkers(),
        window.aela.supervisor.stats(),
      ])
      setWorkers(workerList)
      setStats(statsData)
    } catch (err: unknown) {
      console.error('Failed to refresh workers:', err)
    }
  }, [])

  useEffect(() => {
    refreshWorkers()
    if (modelList.length > 0 && !workerForm.modelConfigId) {
      setWorkerForm(prev => ({ ...prev, modelConfigId: modelList[0].id }))
    }
  }, [modelList]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetStrategy = async (s: AssignmentStrategy) => {
    setStrategy(s)
    try {
      await window.aela.supervisor.setStrategy(s)
    } catch (err: unknown) {
      setError(`${t('orch.sup.setStrategyFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleAddWorker = async () => {
    if (!workerForm.name.trim()) { setError(t('orch.sup.needWorkerName')); return }
    if (!workerForm.modelConfigId) { setError(t('orch.sup.needModel')); return }
    try {
      await window.aela.supervisor.addWorker({
        name: workerForm.name.trim(),
        skills: workerForm.skills.split(',').map(s => s.trim()).filter(Boolean),
        maxConcurrency: workerForm.maxConcurrency,
        modelConfigId: workerForm.modelConfigId,
        systemPrompt: workerForm.systemPrompt,
      })
      setWorkerForm({ name: '', skills: '', maxConcurrency: 3, modelConfigId: modelList[0]?.id || '', systemPrompt: '' })
      await refreshWorkers()
    } catch (err: unknown) {
      setError(`${t('orch.sup.addWorkerFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRemoveWorker = async (id: string) => {
    try {
      await window.aela.supervisor.removeWorker(id)
      await refreshWorkers()
    } catch (err: unknown) {
      setError(`${t('orch.sup.removeWorkerFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSubmitTask = async () => {
    if (!taskForm.name.trim()) { setError(t('orch.sup.needTaskName')); return }
    if (!taskForm.input.trim()) { setError(t('orch.sup.needTaskInput')); return }
    if (workers.length === 0) { setError(t('orch.sup.needWorkerFirst')); return }
    setSubmitting(true)
    try {
      const result = await window.aela.supervisor.submitTask({
        name: taskForm.name.trim(),
        type: taskForm.type,
        payload: { input: taskForm.input.trim() },
        requiredSkills: taskForm.requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        priority: taskForm.priority,
      })
      setTaskResults(prev => [result, ...prev].slice(0, 20))
      setTaskForm(prev => ({ ...prev, name: '', input: '' }))
      await refreshWorkers()
    } catch (err: unknown) {
      setError(`${t('orch.sup.taskFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 统计面板 */}
        {stats && (
          <div className="grid grid-cols-6 gap-3">
            {[
              { label: t('orch.sup.totalWorkers'), value: stats.totalWorkers, color: 'text-blue-400' },
              { label: t('orch.sup.available'), value: stats.availableWorkers, color: 'text-green-400' },
              { label: t('orch.sup.activeTasks'), value: stats.activeTasks, color: 'text-yellow-400' },
              { label: t('orch.sup.completed'), value: stats.totalCompleted, color: 'text-green-400' },
              { label: t('orch.sup.failed'), value: stats.totalFailed, color: 'text-red-400' },
              { label: t('orch.sup.queueLen'), value: stats.queueLength, color: 'text-orange-400' },
            ].map(stat => (
              <div key={stat.label} className="bg-surface border border-border rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-[10px] text-text-muted mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* 策略选择 */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">{t('orch.sup.strategy')}</label>
          <div className="grid grid-cols-3 gap-3">
            {(Object.keys(STRATEGY_INFO) as AssignmentStrategy[]).map(s => (
              <button
                key={s}
                onClick={() => handleSetStrategy(s)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                  strategy === s ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/30 hover:bg-surface-hover'
                }`}
              >
                <span className="text-xl">{STRATEGY_INFO[s].icon}</span>
                <span className={`text-sm font-medium ${strategy === s ? 'text-accent-light' : 'text-text-primary'}`}>
                  {STRATEGY_INFO[s].label}
                </span>
                <span className="text-[10px] text-text-muted text-center">{STRATEGY_INFO[s].desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 添加 Worker */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <label className="text-sm font-medium text-text-primary block">{t('orch.sup.addWorker')}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={workerForm.name}
              onChange={(e) => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('orch.sup.workerName')}
              className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={workerForm.skills}
              onChange={(e) => setWorkerForm(prev => ({ ...prev, skills: e.target.value }))}
              placeholder={t('orch.sup.skillsPlaceholder')}
              className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={workerForm.modelConfigId}
              onChange={(e) => setWorkerForm(prev => ({ ...prev, modelConfigId: e.target.value }))}
              className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            >
              {modelList.map((m: ModelConfig) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <input
              type="number" min="1" max="20"
              value={workerForm.maxConcurrency}
              onChange={(e) => setWorkerForm(prev => ({ ...prev, maxConcurrency: parseInt(e.target.value) || 3 }))}
              placeholder={t('orch.sup.maxConcurrent')}
              className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
            <button
              onClick={handleAddWorker}
              className="bg-accent hover:bg-accent-hover text-white text-sm rounded-lg px-4 py-1.5 font-medium"
            >+ {t('orch.sup.add')}</button>
          </div>
          <textarea
            value={workerForm.systemPrompt}
            onChange={(e) => setWorkerForm(prev => ({ ...prev, systemPrompt: e.target.value }))}
            placeholder={t('orch.sup.systemPrompt')}
            rows={2}
            className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
          />
        </div>

        {/* Worker 列表 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">
              {t('orch.sup.workers')} ({workers.length})
            </label>
            <button onClick={refreshWorkers} className="text-sm text-accent hover:text-accent-light">
              ↻ {t('orch.sup.refresh')}
            </button>
          </div>
          <div className="space-y-2">
            {workers.map(w => (
              <div key={w.id} className="bg-surface border border-border rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${w.available ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <span className="text-sm font-medium text-text-primary">{w.name}</span>
                  {w.skills.length > 0 && (
                    <div className="flex gap-1">
                      {w.skills.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{s}</span>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-text-muted ml-auto">
                    {w.activeTasks}/{w.maxConcurrency} {t('orch.sup.active')} · ✓{w.totalCompleted} ✗{w.totalFailed}
                  </span>
                  <button
                    onClick={() => handleRemoveWorker(w.id)}
                    className="text-text-muted hover:text-red-400 text-sm"
                  >✕</button>
                </div>
              </div>
            ))}
            {workers.length === 0 && (
              <p className="text-xs text-text-muted text-center py-4">{t('orch.sup.noWorkers')}</p>
            )}
          </div>
        </div>

        {/* 提交任务 */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <label className="text-sm font-medium text-text-primary block">{t('orch.sup.submitTask')}</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={taskForm.name}
              onChange={(e) => setTaskForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('orch.sup.taskName')}
              className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
            <input
              type="text"
              value={taskForm.requiredSkills}
              onChange={(e) => setTaskForm(prev => ({ ...prev, requiredSkills: e.target.value }))}
              placeholder={t('orch.sup.reqSkills')}
              className="w-40 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
            <input
              type="number" min="1" max="10"
              value={taskForm.priority}
              onChange={(e) => setTaskForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 5 }))}
              className="w-16 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
              title={t('orch.sup.priority')}
            />
          </div>
          <textarea
            value={taskForm.input}
            onChange={(e) => setTaskForm(prev => ({ ...prev, input: e.target.value }))}
            placeholder={t('orch.sup.taskInput')}
            rows={3}
            className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
          />
          <button
            onClick={handleSubmitTask}
            disabled={submitting || workers.length === 0}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium disabled:opacity-50"
          >
            {submitting ? t('orch.sup.submitting') : `▶ ${t('orch.sup.submit')}`}
          </button>
        </div>

        {/* 任务结果 */}
        {taskResults.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-text-primary">{t('orch.sup.results')}</h3>
            {taskResults.map((result, idx) => {
              const worker = workers.find(w => w.id === result.workerId)
              return (
                <div key={idx} className={`bg-surface border rounded-xl p-3 ${result.status === 'failed' ? 'border-red-500/30' : 'border-border'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${result.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                      {result.status === 'completed' ? '✓' : '✗'} {result.status}
                    </span>
                    <span className="text-xs text-text-muted">→ {worker?.name || result.workerId.slice(0, 8)}</span>
                    <span className="text-[10px] text-text-muted ml-auto">{(result.duration / 1000).toFixed(1)}{t('msg.time')}</span>
                  </div>
                  {result.error && <p className="text-xs text-red-400">{result.error}</p>}
                  {result.output?.content !== null && result.output?.content !== undefined && (
                    <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-40 overflow-y-auto bg-bg-primary/50 rounded-lg p-2 mt-1">
                      {String(result.output.content)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
