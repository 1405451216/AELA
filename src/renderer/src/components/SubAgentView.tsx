import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import type {
  SubAgentPreset,
  SubAgentRunConfig,
  SubAgentRunResult,
  SubAgentDefinition,
  SubAgentResourceQuota,
} from '@shared/types'

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-green-400 bg-green-900/30 border-green-700/50',
  failed: 'text-red-400 bg-red-900/30 border-red-700/50',
  timeout: 'text-orange-400 bg-orange-900/30 border-orange-700/50',
  quota_exceeded: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',
  pending: 'text-gray-400 bg-gray-800/30 border-gray-700/50',
  running: 'text-blue-400 bg-blue-900/30 border-blue-700/50',
}

const STATUS_ICONS: Record<string, string> = {
  completed: '✅',
  failed: '❌',
  timeout: '⏱️',
  quota_exceeded: '⚠️',
  pending: '⏳',
  running: '🔄',
}

export default function SubAgentView() {
  const { modelList } = useAppStore()
  const [presets, setPresets] = useState<SubAgentPreset[]>([])
  const [agents, setAgents] = useState<SubAgentDefinition[]>([])
  const [result, setResult] = useState<SubAgentRunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [aggregationMode, setAggregationMode] = useState<'concat' | 'best' | 'merge' | 'vote'>('concat')
  const [failFast, setFailFast] = useState(false)
  const [maxConcurrency, setMaxConcurrency] = useState(3)

  useEffect(() => {
    window.aela?.subAgent?.listPresets?.().then(setPresets).catch(console.error)
  }, [])

  const addAgentFromPreset = useCallback((preset: SubAgentPreset) => {
    const modelConfigId = modelList[0]?.id || ''
    const agent: SubAgentDefinition = {
      id: `${preset.id}-${Date.now()}`,
      name: `${preset.name}-${agents.length + 1}`,
      role: preset.role,
      systemPrompt: preset.systemPrompt,
      modelConfigId,
      input: '',
      quota: { ...preset.defaultQuota },
    }
    setAgents(prev => [...prev, agent])
  }, [modelList, agents.length])

  const removeAgent = (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id))
  }

  const updateAgent = (id: string, partial: Partial<SubAgentDefinition>) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...partial } : a))
  }

  const updateQuota = (agentId: string, partial: Partial<SubAgentResourceQuota>) => {
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, quota: { ...a.quota, ...partial } } : a
    ))
  }

  const handleRun = async () => {
    if (agents.length === 0) return
    setRunning(true)
    setResult(null)
    try {
      const config: SubAgentRunConfig = {
        id: `run-${Date.now()}`,
        agents,
        aggregationMode,
        failFast,
        maxConcurrency,
      }
      const res = await window.aela.subAgent.run(config)
      setResult(res)
    } catch (err) {
      console.error('Sub-Agent run failed:', err)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 标题 */}
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            🛡️ Sub-Agent 并行隔离
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            资源配额 · 上下文隔离 · 错误边界 · 结果聚合
          </p>
        </div>

        {/* 预设角色 */}
        <div className="bg-bg-secondary rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">预设角色</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {presets.map(preset => (
              <button
                key={preset.id}
                onClick={() => addAgentFromPreset(preset)}
                className="text-left p-3 rounded-lg border border-border hover:border-accent hover:bg-surface-hover transition-colors"
              >
                <div className="text-sm font-medium text-text-primary">{preset.name}</div>
                <div className="text-xs text-text-muted mt-1">{preset.description}</div>
                <div className="text-[10px] text-text-muted mt-2 flex gap-2">
                  <span>轮次: {preset.defaultQuota.maxTurns}</span>
                  <span>Token: {(preset.defaultQuota.maxTokens / 1000).toFixed(0)}K</span>
                  <span>超时: {preset.defaultQuota.timeoutMs / 1000}s</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Agent 列表 */}
        <div className="bg-bg-secondary rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              Agent 列表 ({agents.length})
            </h3>
          </div>

          {agents.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8">
              点击上方预设角色添加 Agent
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map(agent => (
                <div key={agent.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={agent.name}
                      onChange={e => updateAgent(agent.id, { name: e.target.value })}
                      className="flex-1 bg-surface text-text-primary text-sm rounded px-2 py-1 border border-border focus:border-accent focus:outline-none"
                    />
                    <select
                      value={agent.modelConfigId}
                      onChange={e => updateAgent(agent.id, { modelConfigId: e.target.value })}
                      className="bg-surface text-text-primary text-xs rounded px-2 py-1 border border-border"
                    >
                      {modelList.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeAgent(agent.id)}
                      className="text-text-muted hover:text-red-400 text-sm px-2"
                    >
                      ✕
                    </button>
                  </div>

                  <textarea
                    value={agent.input}
                    onChange={e => updateAgent(agent.id, { input: e.target.value })}
                    placeholder="该 Agent 的独立输入..."
                    className="w-full bg-surface text-text-primary text-xs rounded px-2 py-1.5 border border-border focus:border-accent focus:outline-none resize-y"
                    rows={2}
                  />

                  {/* 资源配额 */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <label className="text-xs text-text-muted">
                      最大轮次
                      <input
                        type="number"
                        value={agent.quota.maxTurns}
                        onChange={e => updateQuota(agent.id, { maxTurns: parseInt(e.target.value) || 0 })}
                        className="w-full bg-surface text-text-primary text-xs rounded px-1.5 py-1 border border-border"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      最大 Token
                      <input
                        type="number"
                        value={agent.quota.maxTokens}
                        onChange={e => updateQuota(agent.id, { maxTokens: parseInt(e.target.value) || 0 })}
                        className="w-full bg-surface text-text-primary text-xs rounded px-1.5 py-1 border border-border"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      超时(ms)
                      <input
                        type="number"
                        value={agent.quota.timeoutMs}
                        onChange={e => updateQuota(agent.id, { timeoutMs: parseInt(e.target.value) || 0 })}
                        className="w-full bg-surface text-text-primary text-xs rounded px-1.5 py-1 border border-border"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      文件写入上限
                      <input
                        type="number"
                        value={agent.quota.maxFileWrites}
                        onChange={e => updateQuota(agent.id, { maxFileWrites: parseInt(e.target.value) || 0 })}
                        className="w-full bg-surface text-text-primary text-xs rounded px-1.5 py-1 border border-border"
                      />
                    </label>
                    <label className="text-xs text-text-muted">
                      Shell 命令上限
                      <input
                        type="number"
                        value={agent.quota.maxShellCommands}
                        onChange={e => updateQuota(agent.id, { maxShellCommands: parseInt(e.target.value) || 0 })}
                        className="w-full bg-surface text-text-primary text-xs rounded px-1.5 py-1 border border-border"
                      />
                    </label>
                  </div>

                  {/* 允许的工具 */}
                  <div className="text-xs text-text-muted">
                    允许工具: {agent.quota.allowedTools.length === 0 ? '全部' : agent.quota.allowedTools.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 运行配置 */}
        <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">运行配置</h3>
          <div className="flex flex-wrap gap-4">
            <label className="text-xs text-text-secondary flex items-center gap-2">
              聚合策略:
              <select
                value={aggregationMode}
                onChange={e => setAggregationMode(e.target.value as 'concat' | 'best' | 'merge' | 'vote')}
                className="bg-surface text-text-primary text-xs rounded px-2 py-1 border border-border"
              >
                <option value="concat">拼接 (concat)</option>
                <option value="best">最佳 (best)</option>
                <option value="merge">合并 (merge)</option>
                <option value="vote">投票 (vote)</option>
              </select>
            </label>
            <label className="text-xs text-text-secondary flex items-center gap-2">
              最大并行度:
              <input
                type="number"
                min={1}
                max={10}
                value={maxConcurrency}
                onChange={e => setMaxConcurrency(parseInt(e.target.value) || 1)}
                className="w-16 bg-surface text-text-primary text-xs rounded px-2 py-1 border border-border"
              />
            </label>
            <label className="text-xs text-text-secondary flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={failFast}
                onChange={e => setFailFast(e.target.checked)}
                className="accent-blue-500"
              />
              快速失败 (failFast)
            </label>
          </div>

          <button
            onClick={handleRun}
            disabled={agents.length === 0 || running}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {running ? '🔄 运行中...' : '▶️ 启动并行编排'}
          </button>
        </div>

        {/* 结果展示 */}
        {result && (
          <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">执行结果</h3>
              <div className="flex gap-4 text-xs text-text-muted">
                <span>总耗时: {(result.totalDurationMs / 1000).toFixed(2)}s</span>
                <span>总 Token: {result.totalTokensUsed.toLocaleString()}</span>
                <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                  {result.success ? '✅ 全部成功' : '⚠️ 部分失败'}
                </span>
              </div>
            </div>

            {/* 各 Agent 结果 */}
            <div className="space-y-2">
              {result.results.map(r => (
                <div key={r.agentId} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] || STATUS_COLORS.pending}`}>
                      {STATUS_ICONS[r.status] || '⏳'} {r.status}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{r.agentName}</span>
                    <span className="text-xs text-text-muted">({r.role})</span>
                    <div className="ml-auto flex gap-3 text-[10px] text-text-muted">
                      <span>Token: {r.tokensUsed.toLocaleString()}</span>
                      <span>轮次: {r.turnsUsed}</span>
                      <span>工具调用: {r.toolCalls}</span>
                      <span>耗时: {(r.durationMs / 1000).toFixed(2)}s</span>
                    </div>
                  </div>
                  {r.error ? (
                    <div className="text-xs text-red-400 bg-red-900/20 rounded p-2">{r.error}</div>
                  ) : (
                    <pre className="text-xs text-text-secondary bg-surface rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">{r.output}</pre>
                  )}
                </div>
              ))}
            </div>

            {/* 聚合结果 */}
            <div>
              <h4 className="text-xs font-semibold text-text-primary mb-1">
                聚合结果 ({result.aggregationMode})
              </h4>
              <pre className="text-xs text-text-secondary bg-surface rounded p-3 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap border border-border">
                {result.aggregatedOutput}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
