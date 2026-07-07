// 协作模式 Tab — 辩论/评审/共识/头脑风暴
import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../../stores/app'
import { useT } from '../../i18n'
import type {
  CollaborationMode,
  CollaborationConfig,
  ModelConfig,
} from '@shared/types'
import { randomUUID } from '../../utils'

const COLLAB_MODE_INFO: Record<CollaborationMode, { label: string; icon: string; desc: string }> = {
  debate: { label: '辩论', icon: '⚔️', desc: 'Agent 轮流提出论点并反驳对方' },
  review: { label: '评审', icon: '📋', desc: '依次审查并改进前一个的输出' },
  consensus: { label: '共识', icon: '🤝', desc: '多 Agent 讨论并投票达成共识' },
  brainstorm: { label: '头脑风暴', icon: '💡', desc: '自由发散，不重复已有想法' },
}

interface AgentForm {
  id: string
  name: string
  modelConfigId: string
  systemPrompt: string
  maxTurns: number
}

interface CollabArgument {
  agentName: string
  round: number
  type: 'initial' | 'response'
  content: string
}

export default function CollaborationTab() {
  const t = useT()
  const { modelList, setError } = useAppStore()
  const [mode, setMode] = useState<CollaborationMode>('debate')
  const [agents, setAgents] = useState<AgentForm[]>([
    { id: randomUUID(), name: '正方 Agent', modelConfigId: '', systemPrompt: '你支持给定观点，请提供有力论据', maxTurns: 8 },
    { id: randomUUID(), name: '反方 Agent', modelConfigId: '', systemPrompt: '你反对给定观点，请提出反驳', maxTurns: 8 },
  ])
  const [topic, setTopic] = useState('')
  const [maxRounds, setMaxRounds] = useState(2)
  const [votingThreshold, setVotingThreshold] = useState(0.6)
  const [running, setRunning] = useState(false)
  const [arguments_, setArguments] = useState<CollabArgument[]>([])
  const [liveTokens, setLiveTokens] = useState<Record<string, string>>({})
  const [activeAgent, setActiveAgent] = useState<string>('')
  const [consensus, setConsensus] = useState<string | undefined>(undefined)
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
      maxTurns: 8,
    }])
  }

  const removeAgent = (id: string) => setAgents(agents.filter(a => a.id !== id))
  const updateAgent = (id: string, partial: Partial<AgentForm>) =>
    setAgents(agents.map(a => a.id === id ? { ...a, ...partial } : a))

  const handleRun = async () => {
    if (agents.length < 2) { setError(t('orch.collab.needTwoAgents')); return }
    if (agents.some(a => !a.modelConfigId)) { setError(t('orch.collab.needModel')); return }
    if (!topic.trim()) { setError(t('orch.collab.needTopic')); return }

    const runId = randomUUID()
    runIdRef.current = runId
    setRunning(true)
    setArguments([])
    setLiveTokens({})
    setActiveAgent('')
    setConsensus(undefined)

    const config: CollaborationConfig = {
      id: runId,
      name: '协作任务',
      mode,
      agents: agents.map(a => ({
        id: a.id, name: a.name, modelConfigId: a.modelConfigId,
        systemPrompt: a.systemPrompt, maxTurns: a.maxTurns,
      })),
      topic: topic.trim(),
      maxRounds,
      votingThreshold: mode === 'consensus' ? votingThreshold : undefined,
    }

    const unsubscribe = window.aela.collaboration.onEvent(runId, (event: any) => {
      switch (event.type) {
        case 'step_start':
          setActiveAgent(event.agentName)
          setLiveTokens(prev => ({ ...prev, [event.agentName]: '' }))
          break
        case 'step_token':
          setLiveTokens(prev => ({
            ...prev,
            [event.agentName]: (prev[event.agentName] || '') + event.content,
          }))
          break
        case 'step_done':
          if (event.result?.content) {
            setArguments(prev => [...prev, {
              agentName: event.agentName,
              round: Math.floor(prev.filter(a => a.agentName === event.agentName).length / 1),
              type: prev.length === 0 ? 'initial' : 'response',
              content: event.result.content,
            }])
          }
          break
        case 'collab_done':
          if (event.result?.consensus) setConsensus(event.result.consensus)
          if (event.result?.arguments) setArguments(event.result.arguments)
          setRunning(false)
          setActiveAgent('')
          break
        case 'error':
          setError(typeof event.error === 'string' ? event.error : (event.error instanceof Error ? event.error.message : String(event.error)))
          setRunning(false)
          setActiveAgent('')
          break
      }
    })

    try {
      await window.aela.collaboration.run(config)
    } catch (err: unknown) {
      setError(`${t('orch.collab.runFailed')}: ${err instanceof Error ? err.message : String(err)}`)
      setRunning(false)
    } finally {
      unsubscribe()
    }
  }

  const handleStop = async () => {
    if (runIdRef.current) {
      await window.aela.collaboration.stop(runIdRef.current)
      setRunning(false)
    }
  }

  // 按轮次分组
  const groupedByRound = arguments_.reduce<Record<number, CollabArgument[]>>((acc, arg) => {
    if (!acc[arg.round]) acc[arg.round] = []
    acc[arg.round].push(arg)
    return acc
  }, {})

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 协作模式选择 */}
        <div>
          <label className="text-sm font-medium text-text-primary mb-2 block">{t('orch.collab.mode')}</label>
          <div className="grid grid-cols-4 gap-3">
            {(Object.keys(COLLAB_MODE_INFO) as CollaborationMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                disabled={running}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all disabled:opacity-50 ${
                  mode === m ? 'border-accent bg-accent/10' : 'border-border hover:border-accent/30 hover:bg-surface-hover'
                }`}
              >
                <span className="text-2xl">{COLLAB_MODE_INFO[m].icon}</span>
                <span className={`text-sm font-medium ${mode === m ? 'text-accent-light' : 'text-text-primary'}`}>
                  {COLLAB_MODE_INFO[m].label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">{COLLAB_MODE_INFO[mode].desc}</p>
        </div>

        {/* 主题 + 参数 */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">{t('orch.collab.topic')}</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={running}
              rows={3}
              placeholder={t('orch.collab.topicPlaceholder')}
              className="w-full bg-surface text-text-primary text-sm rounded-lg px-3 py-2.5 border border-border focus:border-accent focus:outline-none resize-none"
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm text-text-secondary">{t('orch.collab.maxRounds')}</label>
              <input
                type="number" min="1" max="10"
                value={maxRounds}
                onChange={(e) => setMaxRounds(parseInt(e.target.value) || 2)}
                disabled={running}
                className="w-20 bg-surface text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
              />
            </div>
            {mode === 'consensus' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-secondary">{t('orch.collab.threshold')}</label>
                <input
                  type="number" min="0.1" max="1" step="0.1"
                  value={votingThreshold}
                  onChange={(e) => setVotingThreshold(parseFloat(e.target.value) || 0.6)}
                  disabled={running}
                  className="w-20 bg-surface text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Agent 列表 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">
              {t('orch.collab.agents')} ({agents.length})
            </label>
            <button
              onClick={addAgent}
              disabled={running}
              className="text-sm text-accent hover:text-accent-light disabled:opacity-50"
            >+ {t('orch.collab.addAgent')}</button>
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
                    className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                  />
                  {agents.length > 2 && (
                    <button onClick={() => removeAgent(agent.id)} disabled={running} className="text-text-muted hover:text-red-400 text-sm">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">{t('orch.collab.model')}</label>
                    <select
                      value={agent.modelConfigId}
                      onChange={(e) => updateAgent(agent.id, { modelConfigId: e.target.value })}
                      disabled={running}
                      className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    >
                      {modelList.map((m: ModelConfig) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-text-muted block mb-1">{t('orch.collab.maxTurns')}</label>
                    <input
                      type="number" min="1" max="30"
                      value={agent.maxTurns}
                      onChange={(e) => updateAgent(agent.id, { maxTurns: parseInt(e.target.value) || 8 })}
                      disabled={running}
                      className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="text-[11px] text-text-muted block mb-1">{t('orch.collab.systemPrompt')}</label>
                  <textarea
                    value={agent.systemPrompt}
                    onChange={(e) => updateAgent(agent.id, { systemPrompt: e.target.value })}
                    disabled={running}
                    rows={2}
                    placeholder={t('orch.collab.promptPlaceholder')}
                    className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 运行按钮 */}
        <div className="flex items-center gap-3">
          {running ? (
            <button onClick={handleStop} className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium">
              ⏹ {t('orch.collab.stop')}
            </button>
          ) : (
            <button onClick={handleRun} className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium">
              ▶ {t('orch.collab.run')}
            </button>
          )}
        </div>

        {/* 共识结论 */}
        {consensus && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎯</span>
              <span className="text-sm font-medium text-green-400">{t('orch.collab.consensusTitle')}</span>
            </div>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{consensus}</p>
          </div>
        )}

        {/* 讨论记录 */}
        {(running || arguments_.length > 0) && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-primary">{t('orch.collab.discussion')}</h3>
            {Object.entries(groupedByRound).map(([round, args]) => (
              <div key={round} className="space-y-3">
                <div className="text-[11px] text-text-muted uppercase tracking-wider">
                  {t('orch.collab.round')} {parseInt(round) + 1}
                </div>
                {args.map((arg, idx) => {
                  const liveContent = liveTokens[arg.agentName] || ''
                  const isActive = activeAgent === arg.agentName && running
                  return (
                    <div key={idx} className={`bg-surface border rounded-xl p-4 ${isActive ? 'border-accent/50' : 'border-border'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-text-primary">{arg.agentName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                          {arg.type === 'initial' ? t('orch.collab.initial') : t('orch.collab.response')}
                        </span>
                        {isActive && (
                          <span className="text-[10px] text-blue-400 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                            {t('orch.collab.speaking')}
                          </span>
                        )}
                      </div>
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto bg-bg-primary/50 rounded-lg p-3">
                        {arg.content || liveContent}
                      </pre>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
