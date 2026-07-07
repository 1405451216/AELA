// 基础编排 Tab — 串行/并行/交接/池化 四种模式
// 从原 OrchestrationView 提取
import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../../stores/app'
import { useT } from '../../i18n'
import type {
  OrchestrationMode,
  OrchestrationConfig,
  OrchestrationEvent,
  OrchestrationStepResult,
  ModelConfig,
} from '@shared/types'
import { randomUUID } from '../../utils'

const MODE_INFO: Record<OrchestrationMode, { label: string; icon: string; desc: string }> = {
  pipeline: { label: '串行流水线', icon: '🔗', desc: '多个 Agent 按顺序执行，前一个的输出作为后一个的输入' },
  parallel: { label: '并行执行', icon: '⚡', desc: '多个 Agent 同时执行各自的任务，互不依赖' },
  handoff: { label: '交接协作', icon: '🤝', desc: '多个 Agent 轮流处理同一任务，逐步优化结果' },
  pool: { label: '池化调度', icon: '🏊', desc: '任务池模式，支持最大并发数控制' },
  groupchat: { label: '群聊协作', icon: '💬', desc: '多 Agent 在群聊中协同讨论，共同完成任务' },
  debate: { label: '辩论模式', icon: '⚔️', desc: '多 Agent 对立辩论，通过多轮交锋得出最优方案' },
  supervisor: { label: '主管模式', icon: '👔', desc: '主管 Agent 统筹分配任务给下属 Agent 执行' },
  streaming_pipeline: { label: '流式管道', icon: '🌊', desc: 'Token 级流式传递，Agent 产出 token 时立即传递给下游，降低延迟' },
}

interface AgentForm {
  id: string
  name: string
  modelConfigId: string
  systemPrompt: string
  input: string
  maxTurns: number
}

export default function BasicOrchestrationTab() {
  const t = useT()
  const { modelList, setError } = useAppStore()
  const [mode, setMode] = useState<OrchestrationMode>('pipeline')
  const [agents, setAgents] = useState<AgentForm[]>([
    { id: randomUUID(), name: '分析 Agent', modelConfigId: '', systemPrompt: '你是一个代码分析专家', input: '', maxTurns: 10 },
    { id: randomUUID(), name: '实现 Agent', modelConfigId: '', systemPrompt: '你是一个代码实现专家', input: '', maxTurns: 15 },
  ])
  const [input, setInput] = useState('')
  const [maxConcurrent, setMaxConcurrent] = useState(3)
  const [maxRounds, setMaxRounds] = useState(2)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<OrchestrationStepResult[]>([])
  const [liveTokens, setLiveTokens] = useState<Record<string, string>>({})
  const [activeStep, setActiveStep] = useState<number>(-1)
  const runIdRef = useRef<string>('')

  useEffect(() => {
    if (modelList.length > 0) {
      setAgents(prev => prev.map(a => a.modelConfigId ? a : { ...a, modelConfigId: modelList[0].id }))
    }
  }, [modelList])

  const addAgent = () => {
    setAgents([...agents, {
      id: randomUUID(),
      name: `Agent ${agents.length + 1}`,
      modelConfigId: modelList[0]?.id || '',
      systemPrompt: '',
      input: '',
      maxTurns: 10,
    }])
  }

  const removeAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id))
  }

  const updateAgent = (id: string, partial: Partial<AgentForm>) => {
    setAgents(agents.map(a => a.id === id ? { ...a, ...partial } : a))
  }

  const handleRun = async () => {
    if (agents.length < 2) {
      setError(t('orch.basic.needTwoAgents'))
      return
    }
    if (agents.some(a => !a.modelConfigId)) {
      setError(t('orch.basic.needModel'))
      return
    }
    if ((mode === 'pipeline' || mode === 'handoff') && !input.trim()) {
      setError(t('orch.basic.needInput'))
      return
    }

    const runId = randomUUID()
    runIdRef.current = runId
    setRunning(true)
    setResults([])
    setLiveTokens({})
    setActiveStep(-1)

    const config: OrchestrationConfig = {
      id: runId,
      name: '编排任务',
      mode,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        modelConfigId: a.modelConfigId,
        systemPrompt: a.systemPrompt,
        input: (mode === 'parallel' || mode === 'pool') ? a.input : undefined,
        maxTurns: a.maxTurns,
      })),
      input: input.trim(),
      maxConcurrent: mode === 'pool' ? maxConcurrent : undefined,
      maxRounds: mode === 'handoff' ? maxRounds : undefined,
    }

    const unsubscribe = window.aela.orchestration.onEvent(runId, (event: OrchestrationEvent) => {
      switch (event.type) {
        case 'step_start':
          setActiveStep(event.stepIndex)
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
          setActiveStep(-1)
          break
        case 'error':
          setError(typeof event.error === 'string' ? event.error : (event.error instanceof Error ? event.error.message : String(event.error)))
          setRunning(false)
          setActiveStep(-1)
          break
      }
    })

    try {
      await window.aela.orchestration.run(config)
    } catch (err: unknown) {
      setError(`${t('orch.basic.runFailed')}: ${err instanceof Error ? err.message : String(err)}`)
      setRunning(false)
    } finally {
      unsubscribe()
    }
  }

  const handleStop = async () => {
    if (runIdRef.current) {
      await window.aela.orchestration.stop(runIdRef.current)
      setRunning(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 编排模式选择 */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">{t('orch.basic.mode')}</label>
          <div className="grid grid-cols-4 gap-3">
            {(Object.keys(MODE_INFO) as OrchestrationMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={running}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all disabled:opacity-50 ${
                  mode === m
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-accent/30 hover:bg-surface-hover'
                }`}
              >
                <span className="text-2xl">{MODE_INFO[m].icon}</span>
                <span className={`text-sm font-medium ${mode === m ? 'text-accent-light' : 'text-text-primary'}`}>
                  {MODE_INFO[m].label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">{MODE_INFO[mode].desc}</p>
        </div>

        {/* 模式参数 */}
        {mode === 'pool' && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">{t('orch.basic.maxConcurrent')}</label>
            <input
              type="number" min="1" max="20"
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(parseInt(e.target.value) || 3)}
              className="w-20 bg-surface text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
          </div>
        )}
        {mode === 'handoff' && (
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">{t('orch.basic.maxRounds')}</label>
            <input
              type="number" min="1" max="10"
              value={maxRounds}
              onChange={(e) => setMaxRounds(parseInt(e.target.value) || 2)}
              className="w-20 bg-surface text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
          </div>
        )}

        {/* 初始输入 */}
        {(mode === 'pipeline' || mode === 'handoff') && (
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">{t('orch.basic.initialTask')}</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={running}
              rows={3}
              placeholder={t('orch.basic.taskPlaceholder')}
              className="w-full bg-surface text-text-primary text-sm rounded-lg px-3 py-2.5 border border-border focus:border-accent focus:outline-none resize-none"
            />
          </div>
        )}

        {/* Agent 列表 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">
              {t('orch.basic.agents')} ({agents.length})
            </label>
            <button
              onClick={addAgent}
              disabled={running}
              className="text-sm text-accent hover:text-accent-light flex items-center gap-1 disabled:opacity-50"
            >
              + {t('orch.basic.addAgent')}
            </button>
          </div>

          <div className="space-y-3">
            {agents.map((agent, i) => (
              <div key={agent.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={agent.name}
                    onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                    disabled={running}
                    placeholder={t('orch.basic.agentName')}
                    className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                  />
                  {mode === 'pipeline' && i > 0 && (
                    <span className="text-text-muted text-xs">⬅ {t('orch.basic.receivesPrev')}</span>
                  )}
                  {agents.length > 2 && (
                    <button
                      onClick={() => removeAgent(agent.id)}
                      disabled={running}
                      className="text-text-muted hover:text-red-400 text-sm"
                    >✕</button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">{t('orch.basic.model')}</label>
                    <select
                      value={agent.modelConfigId}
                      onChange={(e) => updateAgent(agent.id, { modelConfigId: e.target.value })}
                      disabled={running}
                      className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    >
                      {modelList.map((m: ModelConfig) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">{t('orch.basic.maxTurns')}</label>
                    <input
                      type="number" min="1" max="50"
                      value={agent.maxTurns}
                      onChange={(e) => updateAgent(agent.id, { maxTurns: parseInt(e.target.value) || 10 })}
                      disabled={running}
                      className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-2">
                  <label className="text-[11px] text-text-muted block mb-1">{t('orch.basic.systemPrompt')}</label>
                  <textarea
                    value={agent.systemPrompt}
                    onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
                    disabled={running}
                    rows={2}
                    placeholder={t('orch.basic.promptPlaceholder')}
                    className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
                  />
                </div>

                {(mode === 'parallel' || mode === 'pool') && (
                  <div className="mt-2">
                    <label className="text-[11px] text-text-muted block mb-1">{t('orch.basic.independentInput')}</label>
                    <textarea
                      value={agent.input}
                      onChange={(e) => updateAgent(agent.id, { input: e.target.value })}
                      disabled={running}
                      rows={2}
                      placeholder={t('orch.basic.inputPlaceholder')}
                      className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 运行按钮 */}
        <div className="flex items-center gap-3">
          {running ? (
            <button
              onClick={handleStop}
              className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
            >⏹ {t('orch.basic.stop')}</button>
          ) : (
            <button
              onClick={handleRun}
              className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
            >▶ {t('orch.basic.run')}</button>
          )}
        </div>

        {/* 实时输出 */}
        {(running || results.length > 0) && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary">{t('orch.basic.results')}</h3>
            {agents.map((agent, i) => {
              const result = results.find(r => r.agentName === agent.name)
              const liveContent = liveTokens[agent.name] || ''
              const isActive = activeStep === i
              const displayContent = result?.content || liveContent

              return (
                <div
                  key={agent.id}
                  className={`bg-surface border rounded-xl p-4 transition-colors ${
                    isActive ? 'border-accent/50' : result ? 'border-border' : 'border-border opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{agent.name}</span>
                    {isActive && (
                      <span className="text-[10px] text-blue-400 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        {t('orch.basic.executing')}
                      </span>
                    )}
                    {result?.error && (
                      <span className="text-[10px] text-red-400">✗ {result.error}</span>
                    )}
                    {result && !result.error && (
                      <span className="text-[10px] text-green-400">✓ {t('orch.basic.done')}</span>
                    )}
                    {result?.metrics && (
                      <span className="text-[10px] text-text-muted ml-auto">
                        {result.metrics.totalTurns} {t('msg.turns')} · {result.metrics.totalTools} {t('msg.tools')} · {(result.metrics.duration / 1000).toFixed(1)}{t('msg.time')}
                      </span>
                    )}
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
