// DAG 调度 Tab — 依赖图调度器
// 支持拓扑排序 / 并发执行 / Fail-Fast / 上游输出传递
import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../../stores/app'
import { useT } from '../../i18n'
import type {
  DAGConfig,
  DAGStep,
  OrchestrationEvent,
  OrchestrationStepResult,
  ModelConfig,
} from '@shared/types'
import { randomUUID } from '../../utils'

interface StepForm extends DAGStep {
  _uiId: string
}

interface EdgeForm {
  _uiId: string
  from: string
  to: string
}

export default function DAGSchedulerTab() {
  const t = useT()
  const { modelList, setError } = useAppStore()
  const [steps, setSteps] = useState<StepForm[]>([
    { _uiId: randomUUID(), id: 'step_1', name: '分析需求', modelConfigId: '', systemPrompt: '你是需求分析专家', input: '', maxTurns: 8 },
    { _uiId: randomUUID(), id: 'step_2', name: '编写代码', modelConfigId: '', systemPrompt: '你是代码编写专家', input: '', maxTurns: 15 },
    { _uiId: randomUUID(), id: 'step_3', name: '代码审查', modelConfigId: '', systemPrompt: '你是代码审查专家', input: '', maxTurns: 8 },
  ])
  const [edges, setEdges] = useState<EdgeForm[]>([
    { _uiId: randomUUID(), from: 'step_1', to: 'step_2' },
    { _uiId: randomUUID(), from: 'step_2', to: 'step_3' },
  ])
  const [input, setInput] = useState('')
  const [maxConcurrency, setMaxConcurrency] = useState(5)
  const [failFast, setFailFast] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<OrchestrationStepResult[]>([])
  const [liveTokens, setLiveTokens] = useState<Record<string, string>>({})
  const [activeStepId, setActiveStepId] = useState<string>('')
  const runIdRef = useRef<string>('')

  useEffect(() => {
    if (modelList.length > 0) {
      setSteps(prev => prev.map(s => s.modelConfigId ? s : { ...s, modelConfigId: modelList[0].id }))
    }
  }, [modelList])

  const addStep = () => {
    const id = `step_${steps.length + 1}_${Date.now().toString(36).slice(-4)}`
    setSteps([...steps, {
      _uiId: randomUUID(),
      id,
      name: `Step ${steps.length + 1}`,
      modelConfigId: modelList[0]?.id || '',
      systemPrompt: '',
      input: '',
      maxTurns: 10,
    }])
  }

  const removeStep = (uiId: string) => {
    const step = steps.find(s => s._uiId === uiId)
    if (!step) return
    setSteps(steps.filter(s => s._uiId !== uiId))
    setEdges(edges.filter(e => e.from !== step.id && e.to !== step.id))
  }

  const updateStep = (uiId: string, partial: Partial<StepForm>) => {
    setSteps(steps.map(s => s._uiId === uiId ? { ...s, ...partial } : s))
  }

  const addEdge = () => {
    if (steps.length < 2) return
    setEdges([...edges, { _uiId: randomUUID(), from: steps[0].id, to: steps[1].id }])
  }

  const removeEdge = (uiId: string) => {
    setEdges(edges.filter(e => e._uiId !== uiId))
  }

  const updateEdge = (uiId: string, partial: Partial<EdgeForm>) => {
    setEdges(edges.map(e => e._uiId === uiId ? { ...e, ...partial } : e))
  }

  const handleRun = async () => {
    if (steps.length < 1) {
      setError(t('orch.dag.needStep'))
      return
    }
    if (steps.some(s => !s.modelConfigId)) {
      setError(t('orch.dag.needModel'))
      return
    }
    if (!input.trim()) {
      setError(t('orch.dag.needInput'))
      return
    }

    // 检查 step ID 唯一性
    const ids = steps.map(s => s.id)
    if (new Set(ids).size !== ids.length) {
      setError(t('orch.dag.dupId'))
      return
    }

    const runId = randomUUID()
    runIdRef.current = runId
    setRunning(true)
    setResults([])
    setLiveTokens({})
    setActiveStepId('')

    const config: DAGConfig = {
      id: runId,
      name: 'DAG 编排',
      steps: steps.map(({ _uiId, ...rest }) => rest),
      edges: edges.map(({ _uiId, ...rest }) => rest),
      input: input.trim(),
      maxConcurrency,
      failFast,
    }

    const unsubscribe = window.aela.dag.onEvent(runId, (event: OrchestrationEvent) => {
      switch (event.type) {
        case 'step_start':
          setActiveStepId(event.agentName)
          setLiveTokens(prev => ({ ...prev, [event.agentName]: '' }))
          break
        case 'step_token':
          setLiveTokens(prev => ({
            ...prev,
            [event.agentName]: (prev[event.agentName] || '') + event.content,
          }))
          break
        case 'step_done':
          setResults(prev => [...prev, event.result])
          break
        case 'all_done':
          setRunning(false)
          setActiveStepId('')
          break
        case 'error':
          setError(typeof event.error === 'string' ? event.error : (event.error instanceof Error ? event.error.message : String(event.error)))
          setRunning(false)
          setActiveStepId('')
          break
      }
    })

    try {
      await window.aela.dag.run(config)
    } catch (err: unknown) {
      setError(`${t('orch.dag.runFailed')}: ${err instanceof Error ? err.message : String(err)}`)
      setRunning(false)
    } finally {
      unsubscribe()
    }
  }

  const handleStop = async () => {
    if (runIdRef.current) {
      await window.aela.dag.stop(runIdRef.current)
      setRunning(false)
    }
  }

  // 获取上游 step
  const getUpstream = (stepId: string) => edges.filter(e => e.to === stepId).map(e => e.from)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 全局设置 */}
        <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
          <label className="text-sm font-medium text-text-primary block">{t('orch.dag.globalSettings')}</label>
          <div>
            <label className="text-[11px] text-text-muted block mb-1">{t('orch.dag.initialInput')}</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={running}
              rows={3}
              placeholder={t('orch.dag.inputPlaceholder')}
              className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-secondary">{t('orch.dag.maxConcurrent')}</label>
              <input
                type="number" min="1" max="20"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(parseInt(e.target.value) || 5)}
                disabled={running}
                className="w-20 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={failFast}
                onChange={(e) => setFailFast(e.target.checked)}
                disabled={running}
                className="accent-accent"
              />
              {t('orch.dag.failFast')}
            </label>
          </div>
        </div>

        {/* Step 列表 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">
              {t('orch.dag.steps')} ({steps.length})
            </label>
            <button
              onClick={addStep}
              disabled={running}
              className="text-sm text-accent hover:text-accent-light disabled:opacity-50"
            >+ {t('orch.dag.addStep')}</button>
          </div>

          <div className="space-y-3">
            {steps.map((step, i) => {
              const upstream = getUpstream(step.id)
              return (
                <div key={step._uiId} className="bg-surface border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold shrink-0">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={step.id}
                      onChange={(e) => updateStep(step._uiId, { id: e.target.value })}
                      disabled={running}
                      placeholder="step_id"
                      className="w-32 bg-bg-primary text-text-muted text-xs font-mono rounded-lg px-2 py-1.5 border border-border focus:border-accent focus:outline-none"
                    />
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateStep(step._uiId, { name: e.target.value })}
                      disabled={running}
                      placeholder={t('orch.dag.stepName')}
                      className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    />
                    {upstream.length > 0 && (
                      <span className="text-text-muted text-xs">⬅ {upstream.join(', ')}</span>
                    )}
                    <button
                      onClick={() => removeStep(step._uiId)}
                      disabled={running}
                      className="text-text-muted hover:text-red-400 text-sm"
                    >✕</button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-text-muted block mb-1">{t('orch.dag.model')}</label>
                      <select
                        value={step.modelConfigId}
                        onChange={(e) => updateStep(step._uiId, { modelConfigId: e.target.value })}
                        disabled={running}
                        className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                      >
                        {modelList.map((m: ModelConfig) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-text-muted block mb-1">{t('orch.dag.maxTurns')}</label>
                      <input
                        type="number" min="1" max="50"
                        value={step.maxTurns || 10}
                        onChange={(e) => updateStep(step._uiId, { maxTurns: parseInt(e.target.value) || 10 })}
                        disabled={running}
                        className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className="text-[11px] text-text-muted block mb-1">{t('orch.dag.systemPrompt')}</label>
                    <textarea
                      value={step.systemPrompt}
                      onChange={(e) => updateStep(step._uiId, { systemPrompt: e.target.value })}
                      disabled={running}
                      rows={2}
                      placeholder={t('orch.dag.promptPlaceholder')}
                      className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
                    />
                  </div>

                  <div className="mt-2">
                    <label className="text-[11px] text-text-muted block mb-1">{t('orch.dag.overrideInput')} ({t('orch.dag.optional')})</label>
                    <input
                      type="text"
                      value={step.input || ''}
                      onChange={(e) => updateStep(step._uiId, { input: e.target.value })}
                      disabled={running}
                      placeholder={t('orch.dag.overridePlaceholder')}
                      className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 依赖边 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">
              {t('orch.dag.dependencies')} ({edges.length})
            </label>
            <button
              onClick={addEdge}
              disabled={running || steps.length < 2}
              className="text-sm text-accent hover:text-accent-light disabled:opacity-50"
            >+ {t('orch.dag.addEdge')}</button>
          </div>
          <div className="space-y-2">
            {edges.map(edge => (
              <div key={edge._uiId} className="flex items-center gap-2 bg-surface border border-border rounded-lg p-2">
                <select
                  value={edge.from}
                  onChange={(e) => updateEdge(edge._uiId, { from: e.target.value })}
                  disabled={running}
                  className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                >
                  {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="text-text-muted">→</span>
                <select
                  value={edge.to}
                  onChange={(e) => updateEdge(edge._uiId, { to: e.target.value })}
                  disabled={running}
                  className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                >
                  {steps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button
                  onClick={() => removeEdge(edge._uiId)}
                  disabled={running}
                  className="text-text-muted hover:text-red-400 text-sm ml-auto"
                >✕</button>
              </div>
            ))}
            {edges.length === 0 && (
              <p className="text-xs text-text-muted text-center py-3">{t('orch.dag.noEdges')}</p>
            )}
          </div>
        </div>

        {/* 运行按钮 */}
        <div className="flex items-center gap-3">
          {running ? (
            <button
              onClick={handleStop}
              className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
            >⏹ {t('orch.dag.stop')}</button>
          ) : (
            <button
              onClick={handleRun}
              className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
            >▶ {t('orch.dag.run')}</button>
          )}
        </div>

        {/* 实时输出 */}
        {(running || results.length > 0) && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary">{t('orch.dag.results')}</h3>
            {steps.map((step, i) => {
              const result = results.find(r => r.agentName === step.name)
              const liveContent = liveTokens[step.name] || ''
              const isActive = activeStepId === step.name
              const displayContent = result?.content || liveContent
              return (
                <div
                  key={step._uiId}
                  className={`bg-surface border rounded-xl p-4 transition-colors ${
                    isActive ? 'border-accent/50' : result ? 'border-border' : 'border-border opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{step.name}</span>
                    <span className="text-[10px] text-text-muted font-mono">{step.id}</span>
                    {isActive && (
                      <span className="text-[10px] text-blue-400 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        {t('orch.dag.executing')}
                      </span>
                    )}
                    {result?.error && <span className="text-[10px] text-red-400">✗ {result.error}</span>}
                    {result && !result.error && <span className="text-[10px] text-green-400">✓ {t('orch.dag.done')}</span>}
                  </div>
                  {displayContent && (
                    <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto bg-bg-primary/50 rounded-lg p-3">
                      {displayContent}
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
