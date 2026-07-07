// 动态拓扑 Tab — 条件路由 DAG / 三种节点类型
import { useEffect, useState, useRef } from 'react'
import { useAppStore } from '../../stores/app'
import { useT } from '../../i18n'
import type {
  DynamicDAGConfig,
  DynamicDAGNode,
  OrchestrationEvent,
  OrchestrationStepResult,
  ModelConfig,
} from '@shared/types'
import { randomUUID } from '../../utils'

type HandlerType = 'agent' | 'transform' | 'condition'

const HANDLER_INFO: Record<HandlerType, { label: string; icon: string }> = {
  agent: { label: 'Agent', icon: '🤖' },
  transform: { label: 'Transform', icon: '🔄' },
  condition: { label: 'Condition', icon: '🔀' },
}

interface NodeForm {
  _uiId: string
  id: string
  name: string
  handlerType: HandlerType
  // agent config
  modelConfigId?: string
  systemPrompt?: string
  maxTurns?: number
  // transform config
  transform?: string
  template?: string
  // condition config
  condition?: string
  contains?: string
}

interface EdgeForm {
  _uiId: string
  from: string
  to: string
}

interface CondEdgeForm {
  _uiId: string
  from: string
  routes: { value: string; target: string }[]
}

export default function DynamicDAGTab() {
  const t = useT()
  const { modelList, setError } = useAppStore()
  const [nodes, setNodes] = useState<NodeForm[]>([
    { _uiId: randomUUID(), id: 'start', name: '入口节点', handlerType: 'agent', modelConfigId: '', systemPrompt: '你是任务执行者', maxTurns: 10 },
    { _uiId: randomUUID(), id: 'check', name: '条件检查', handlerType: 'condition', condition: 'nonempty' },
    { _uiId: randomUUID(), id: 'transform', name: '格式化', handlerType: 'transform', transform: 'json_parse' },
    { _uiId: randomUUID(), id: 'final', name: '最终输出', handlerType: 'agent', modelConfigId: '', systemPrompt: '你是最终报告生成者', maxTurns: 8 },
  ])
  const [edges, setEdges] = useState<EdgeForm[]>([
    { _uiId: randomUUID(), from: 'start', to: 'check' },
    { _uiId: randomUUID(), from: 'transform', to: 'final' },
  ])
  const [condEdges, setCondEdges] = useState<CondEdgeForm[]>([
    { _uiId: randomUUID(), from: 'check', routes: [
      { value: 'true', target: 'transform' },
      { value: 'false', target: 'final' },
    ]},
  ])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<OrchestrationStepResult[]>([])
  const [_liveTokens, setLiveTokens] = useState<Record<string, string>>({})
  const [activeNode, setActiveNode] = useState<string>('')
  const runIdRef = useRef<string>('')

  useEffect(() => {
    if (modelList.length > 0) {
      setNodes(prev => prev.map(n => {
        if (n.handlerType === 'agent' && !n.modelConfigId) {
          return { ...n, modelConfigId: modelList[0].id }
        }
        return n
      }))
    }
  }, [modelList])

  const addNode = (type: HandlerType) => {
    const id = `node_${nodes.length + 1}_${Date.now().toString(36).slice(-4)}`
    const base: NodeForm = { _uiId: randomUUID(), id, name: `Node ${nodes.length + 1}`, handlerType: type }
    if (type === 'agent') Object.assign(base, { modelConfigId: modelList[0]?.id || '', systemPrompt: '', maxTurns: 10 })
    if (type === 'transform') Object.assign(base, { transform: 'trim' })
    if (type === 'condition') Object.assign(base, { condition: 'nonempty' })
    setNodes([...nodes, base])
  }

  const removeNode = (uiId: string) => {
    const node = nodes.find(n => n._uiId === uiId)
    if (!node) return
    setNodes(nodes.filter(n => n._uiId !== uiId))
    setEdges(edges.filter(e => e.from !== node.id && e.to !== node.id))
    setCondEdges(condEdges.filter(ce => ce.from !== node.id))
  }

  const updateNode = (uiId: string, partial: Partial<NodeForm>) => {
    setNodes(nodes.map(n => n._uiId === uiId ? { ...n, ...partial } : n))
  }

  const addEdge = () => {
    if (nodes.length < 2) return
    setEdges([...edges, { _uiId: randomUUID(), from: nodes[0].id, to: nodes[1].id }])
  }
  const removeEdge = (uiId: string) => setEdges(edges.filter(e => e._uiId !== uiId))
  const updateEdge = (uiId: string, partial: Partial<EdgeForm>) =>
    setEdges(edges.map(e => e._uiId === uiId ? { ...e, ...partial } : e))

  const addCondEdge = () => {
    if (nodes.length < 2) return
    setCondEdges([...condEdges, { _uiId: randomUUID(), from: nodes[0].id, routes: [{ value: 'true', target: nodes[1].id }] }])
  }
  const removeCondEdge = (uiId: string) => setCondEdges(condEdges.filter(ce => ce._uiId !== uiId))
  const updateCondEdge = (uiId: string, from: string, routes: { value: string; target: string }[]) =>
    setCondEdges(condEdges.map(ce => ce._uiId === uiId ? { ...ce, from, routes } : ce))

  const handleRun = async () => {
    if (nodes.length < 1) { setError(t('orch.ddag.needNode')); return }
    if (!input.trim()) { setError(t('orch.ddag.needInput')); return }

    // 检查 agent 节点是否有 model
    for (const n of nodes) {
      if (n.handlerType === 'agent' && !n.modelConfigId) {
        setError(t('orch.ddag.needModel'))
        return
      }
    }

    const runId = randomUUID()
    runIdRef.current = runId
    setRunning(true)
    setResults([])
    setLiveTokens({})
    setActiveNode('')

    // 构建配置
    const dagNodes: DynamicDAGNode[] = nodes.map(n => {
      const config: Record<string, unknown> = {}
      if (n.handlerType === 'agent') {
        config.modelConfigId = n.modelConfigId
        config.systemPrompt = n.systemPrompt
        config.maxTurns = n.maxTurns
      } else if (n.handlerType === 'transform') {
        config.transform = n.transform
        config.template = n.template
      } else if (n.handlerType === 'condition') {
        config.condition = n.condition
        config.contains = n.contains
      }
      return { id: n.id, name: n.name, handlerType: n.handlerType, config }
    })

    const config: DynamicDAGConfig = {
      id: runId,
      name: '动态拓扑 DAG',
      nodes: dagNodes,
      edges: edges.map(({ _uiId, ...rest }) => rest),
      conditionalEdges: condEdges.map(ce => ({
        from: ce.from,
        routing: ce.routes.reduce<Record<string, string>>((acc, r) => { acc[r.value] = r.target; return acc }, {}),
      })),
      input: input.trim(),
    }

    const unsubscribe = window.aela.dynamicDag.onEvent(runId, (event: OrchestrationEvent) => {
      switch (event.type) {
        case 'step_start':
          setActiveNode(event.agentName)
          setLiveTokens(prev => ({ ...prev, [event.agentName]: '' }))
          break
        case 'step_token':
          setLiveTokens(prev => ({ ...prev, [event.agentName]: (prev[event.agentName] || '') + event.content }))
          break
        case 'step_done':
          setResults(prev => [...prev, event.result])
          break
        case 'all_done':
          setRunning(false)
          setActiveNode('')
          break
        case 'error':
          setError(typeof event.error === 'string' ? event.error : (event.error instanceof Error ? event.error.message : String(event.error)))
          setRunning(false)
          setActiveNode('')
          break
      }
    })

    try {
      await window.aela.dynamicDag.run(config)
    } catch (err: unknown) {
      setError(`${t('orch.ddag.runFailed')}: ${err instanceof Error ? err.message : String(err)}`)
      setRunning(false)
    } finally {
      unsubscribe()
    }
  }

  const handleStop = async () => {
    if (runIdRef.current) {
      await window.aela.dynamicDag.stop(runIdRef.current)
      setRunning(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 初始输入 */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <label className="text-sm font-medium text-text-primary mb-2 block">{t('orch.ddag.initialInput')}</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={running}
            rows={3}
            placeholder={t('orch.ddag.inputPlaceholder')}
            className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
          />
        </div>

        {/* 添加节点按钮 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">{t('orch.ddag.addNode')}:</span>
          {(Object.keys(HANDLER_INFO) as HandlerType[]).map(ht => (
            <button
              key={ht}
              onClick={() => addNode(ht)}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text-primary hover:border-accent/30 hover:bg-surface-hover disabled:opacity-50"
            >
              <span>{HANDLER_INFO[ht].icon}</span>
              <span>{HANDLER_INFO[ht].label}</span>
              <span className="text-accent">+</span>
            </button>
          ))}
        </div>

        {/* 节点列表 */}
        <div className="space-y-3">
          {nodes.map((node, i) => (
            <div key={node._uiId} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/15 text-accent text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <span className="text-lg">{HANDLER_INFO[node.handlerType].icon}</span>
                <input
                  type="text"
                  value={node.id}
                  onChange={(e) => updateNode(node._uiId, { id: e.target.value })}
                  disabled={running}
                  className="w-32 bg-bg-primary text-text-muted text-xs font-mono rounded-lg px-2 py-1.5 border border-border focus:border-accent focus:outline-none"
                />
                <input
                  type="text"
                  value={node.name}
                  onChange={(e) => updateNode(node._uiId, { name: e.target.value })}
                  disabled={running}
                  className="flex-1 bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-hover text-text-muted">
                  {HANDLER_INFO[node.handlerType].label}
                </span>
                <button onClick={() => removeNode(node._uiId)} disabled={running} className="text-text-muted hover:text-red-400 text-sm">✕</button>
              </div>

              {/* Agent 节点配置 */}
              {node.handlerType === 'agent' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={node.modelConfigId || ''}
                      onChange={(e) => updateNode(node._uiId, { modelConfigId: e.target.value })}
                      disabled={running}
                      className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    >
                      {modelList.map((m: ModelConfig) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input
                      type="number" min="1" max="50"
                      value={node.maxTurns || 10}
                      onChange={(e) => updateNode(node._uiId, { maxTurns: parseInt(e.target.value) || 10 })}
                      disabled={running}
                      className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    />
                  </div>
                  <textarea
                    value={node.systemPrompt || ''}
                    onChange={(e) => updateNode(node._uiId, { systemPrompt: e.target.value })}
                    disabled={running}
                    rows={2}
                    placeholder={t('orch.ddag.promptPlaceholder')}
                    className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-2 border border-border focus:border-accent focus:outline-none resize-none"
                  />
                </div>
              )}

              {/* Transform 节点配置 */}
              {node.handlerType === 'transform' && (
                <div className="space-y-2">
                  <select
                    value={node.transform || 'trim'}
                    onChange={(e) => updateNode(node._uiId, { transform: e.target.value })}
                    disabled={running}
                    className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                  >
                    <option value="uppercase">UPPERCASE</option>
                    <option value="lowercase">lowercase</option>
                    <option value="trim">trim</option>
                    <option value="json_parse">JSON Parse (format)</option>
                  </select>
                  <input
                    type="text"
                    value={node.template || ''}
                    onChange={(e) => updateNode(node._uiId, { template: e.target.value })}
                    disabled={running}
                    placeholder={t('orch.ddag.templatePlaceholder')}
                    className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                  />
                </div>
              )}

              {/* Condition 节点配置 */}
              {node.handlerType === 'condition' && (
                <div className="space-y-2">
                  <select
                    value={node.condition || 'nonempty'}
                    onChange={(e) => updateNode(node._uiId, { condition: e.target.value, contains: e.target.value === 'contains' ? node.contains : undefined })}
                    disabled={running}
                    className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                  >
                    <option value="empty">{t('orch.ddag.condEmpty')}</option>
                    <option value="nonempty">{t('orch.ddag.condNonEmpty')}</option>
                    <option value="contains">{t('orch.ddag.condContains')}</option>
                  </select>
                  {node.condition === 'contains' && (
                    <input
                      type="text"
                      value={node.contains || ''}
                      onChange={(e) => updateNode(node._uiId, { contains: e.target.value })}
                      disabled={running}
                      placeholder={t('orch.ddag.containsPlaceholder')}
                      className="w-full bg-bg-primary text-text-primary text-xs rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 普通边 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">{t('orch.ddag.edges')} ({edges.length})</label>
            <button onClick={addEdge} disabled={running || nodes.length < 2} className="text-sm text-accent hover:text-accent-light disabled:opacity-50">
              + {t('orch.ddag.addEdge')}
            </button>
          </div>
          <div className="space-y-2">
            {edges.map(edge => (
              <div key={edge._uiId} className="flex items-center gap-2 bg-surface border border-border rounded-lg p-2">
                <select value={edge.from} onChange={(e) => updateEdge(edge._uiId, { from: e.target.value })} disabled={running}
                  className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none">
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <span className="text-text-muted">→</span>
                <select value={edge.to} onChange={(e) => updateEdge(edge._uiId, { to: e.target.value })} disabled={running}
                  className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none">
                  {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <button onClick={() => removeEdge(edge._uiId)} disabled={running} className="text-text-muted hover:text-red-400 text-sm ml-auto">✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* 条件边 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary">{t('orch.ddag.condEdges')} ({condEdges.length})</label>
            <button onClick={addCondEdge} disabled={running || nodes.length < 2} className="text-sm text-accent hover:text-accent-light disabled:opacity-50">
              + {t('orch.ddag.addCondEdge')}
            </button>
          </div>
          <div className="space-y-2">
            {condEdges.map(ce => (
              <div key={ce._uiId} className="bg-surface border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">{t('orch.ddag.from')}</span>
                  <select value={ce.from} onChange={(e) => updateCondEdge(ce._uiId, e.target.value, ce.routes)} disabled={running}
                    className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1.5 border border-border focus:border-accent focus:outline-none">
                    {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                  <span className="text-xs text-text-muted ml-auto">{t('orch.ddag.routing')}</span>
                  <button onClick={() => removeCondEdge(ce._uiId)} disabled={running} className="text-text-muted hover:text-red-400 text-sm">✕</button>
                </div>
                {ce.routes.map((route, ridx) => (
                  <div key={ridx} className="flex items-center gap-2 pl-4">
                    <span className="text-xs text-text-muted">&ldquo;{t('orch.ddag.output')}&rdquo; =</span>
                    <input
                      type="text"
                      value={route.value}
                      onChange={(e) => {
                        const newRoutes = [...ce.routes]
                        newRoutes[ridx] = { ...route, value: e.target.value }
                        updateCondEdge(ce._uiId, ce.from, newRoutes)
                      }}
                      disabled={running}
                      placeholder="true / false / ..."
                      className="w-32 bg-bg-primary text-text-primary text-xs rounded-lg px-2 py-1 border border-border focus:border-accent focus:outline-none"
                    />
                    <span className="text-text-muted">→</span>
                    <select
                      value={route.target}
                      onChange={(e) => {
                        const newRoutes = [...ce.routes]
                        newRoutes[ridx] = { ...route, target: e.target.value }
                        updateCondEdge(ce._uiId, ce.from, newRoutes)
                      }}
                      disabled={running}
                      className="bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-1 border border-border focus:border-accent focus:outline-none"
                    >
                      {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                    <button
                      onClick={() => updateCondEdge(ce._uiId, ce.from, ce.routes.filter((_, i) => i !== ridx))}
                      disabled={running}
                      className="text-text-muted hover:text-red-400 text-xs"
                    >✕</button>
                  </div>
                ))}
                <button
                  onClick={() => updateCondEdge(ce._uiId, ce.from, [...ce.routes, { value: '', target: nodes[0]?.id || '' }])}
                  disabled={running}
                  className="text-xs text-accent hover:text-accent-light pl-4"
                >+ {t('orch.ddag.addRoute')}</button>
              </div>
            ))}
          </div>
        </div>

        {/* 运行按钮 */}
        <div className="flex items-center gap-3">
          {running ? (
            <button onClick={handleStop} className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium">
              ⏹ {t('orch.ddag.stop')}
            </button>
          ) : (
            <button onClick={handleRun} className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium">
              ▶ {t('orch.ddag.run')}
            </button>
          )}
        </div>

        {/* 实时输出 */}
        {(running || results.length > 0) && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-primary">{t('orch.ddag.results')}</h3>
            {results.map((result, idx) => {
              const node = nodes.find(n => n.name === result.agentName)
              const isActive = activeNode === result.agentName && running
              return (
                <div key={idx} className={`bg-surface border rounded-xl p-4 ${isActive ? 'border-accent/50' : 'border-border'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {node && <span className="text-lg">{HANDLER_INFO[node.handlerType].icon}</span>}
                    <span className="text-sm font-medium text-text-primary">{result.agentName}</span>
                    {node && <span className="text-[10px] text-text-muted font-mono">{node.id}</span>}
                    {isActive && (
                      <span className="text-[10px] text-blue-400 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                        {t('orch.ddag.executing')}
                      </span>
                    )}
                    {result?.error && <span className="text-[10px] text-red-400">✗ {result.error}</span>}
                    {!result?.error && <span className="text-[10px] text-green-400">✓ {t('orch.ddag.done')}</span>}
                  </div>
                  {result.content && (
                    <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-64 overflow-y-auto bg-bg-primary/50 rounded-lg p-3">
                      {result.content}
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
