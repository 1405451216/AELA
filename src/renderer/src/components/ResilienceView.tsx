// [进化 3] ResilientProvider — 韧性配置与熔断器监控面板
// 可配置的重试/熔断/Fallback 设置 + 熔断器状态可视化
import { useState, useEffect, useCallback } from 'react'
import type { ResilienceConfig, ResilienceStats, CircuitBreakerState, ModelConfig } from '@shared/types'

export default function ResilienceView() {
  const [config, setConfig] = useState<ResilienceConfig | null>(null)
  const [stats, setStats] = useState<ResilienceStats | null>(null)
  const [models, setModels] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editConfig, setEditConfig] = useState<Partial<ResilienceConfig>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, sts, mdls] = await Promise.all([
        window.aela.resilience.getConfig(),
        window.aela.resilience.getStats(),
        window.aela.model.list(),
      ])
      setConfig(cfg)
      setStats(sts)
      setModels(mdls)
      setEditConfig(cfg)
    } catch (err) {
      console.error('Failed to load resilience data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.aela.resilience.setConfig(editConfig)
      await load()
    } catch (err) {
      console.error('Save failed:', err)
      alert(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleResetBreaker = async (modelId: string) => {
    try {
      await window.aela.resilience.resetBreaker(modelId)
      await load()
    } catch (err) {
      console.error('Reset breaker failed:', err)
    }
  }

  if (loading && !config) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-text-muted py-20">加载韧性配置中...</div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-text-muted py-20">暂无数据</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-xl font-bold text-text-primary">ResilientProvider 韧性配置</h1>
        </div>
        <p className="text-sm text-text-muted">
          自动重试 · 熔断器保护 · Fallback 降级 — 提升 Provider 稳定性
        </p>
      </div>

      {/* 全局统计 */}
      {stats && (
        <div className="px-8 py-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary mb-4">全局统计</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-bg-secondary rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-text-primary mb-1">{stats.totalRequests}</div>
              <div className="text-xs text-text-muted">总请求数</div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-yellow-400 mb-1">{stats.totalRetries}</div>
              <div className="text-xs text-text-muted">总重试次数</div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-blue-400 mb-1">{stats.totalFallbacks}</div>
              <div className="text-xs text-text-muted">Fallback 次数</div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-4 border border-border">
              <div className="text-2xl font-bold text-accent mb-1">{(stats.avgRetryRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-text-muted">平均重试率</div>
            </div>
          </div>
        </div>
      )}

      {/* 配置编辑 */}
      <div className="px-8 py-6 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary mb-4">韧性配置</h2>
        <div className="grid grid-cols-2 gap-4">
          {/* 最大重试次数 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">最大重试次数</label>
            <input
              type="number"
              min={0}
              max={10}
              value={editConfig.maxRetries ?? config.maxRetries}
              onChange={(e) => setEditConfig({ ...editConfig, maxRetries: parseInt(e.target.value) || 0 })}
              className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent"
            />
            <div className="text-xs text-text-muted mt-1">对 5xx / 429 / 超时等错误自动重试</div>
          </div>

          {/* 初始退避 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">初始退避时间 (ms)</label>
            <input
              type="number"
              min={100}
              max={10000}
              step={100}
              value={editConfig.retryBackoffMs ?? config.retryBackoffMs}
              onChange={(e) => setEditConfig({ ...editConfig, retryBackoffMs: parseInt(e.target.value) || 500 })}
              className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent"
            />
            <div className="text-xs text-text-muted mt-1">第一次重试前的等待时间</div>
          </div>

          {/* 最大退避 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">最大退避时间 (ms)</label>
            <input
              type="number"
              min={1000}
              max={60000}
              step={1000}
              value={editConfig.maxBackoffMs ?? config.maxBackoffMs}
              onChange={(e) => setEditConfig({ ...editConfig, maxBackoffMs: parseInt(e.target.value) || 10000 })}
              className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent"
            />
            <div className="text-xs text-text-muted mt-1">指数退避的上限</div>
          </div>

          {/* 熔断阈值 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">熔断阈值（连续失败次数）</label>
            <input
              type="number"
              min={1}
              max={20}
              value={editConfig.circuitThreshold ?? config.circuitThreshold}
              onChange={(e) => setEditConfig({ ...editConfig, circuitThreshold: parseInt(e.target.value) || 5 })}
              className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent"
            />
            <div className="text-xs text-text-muted mt-1">连续失败达到此值后触发熔断</div>
          </div>

          {/* 熔断恢复时间 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">熔断恢复时间 (ms)</label>
            <input
              type="number"
              min={5000}
              max={300000}
              step={1000}
              value={editConfig.circuitRecoverMs ?? config.circuitRecoverMs}
              onChange={(e) => setEditConfig({ ...editConfig, circuitRecoverMs: parseInt(e.target.value) || 30000 })}
              className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent"
            />
            <div className="text-xs text-text-muted mt-1">熔断后等待此时间后尝试恢复</div>
          </div>

          {/* Fallback 模型 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Fallback 模型</label>
            <select
              value={editConfig.fallbackModelId ?? config.fallbackModelId ?? ''}
              onChange={(e) => setEditConfig({ ...editConfig, fallbackModelId: e.target.value || null })}
              className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent"
            >
              <option value="">不使用 Fallback</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.provider}/{m.model})
                </option>
              ))}
            </select>
            <div className="text-xs text-text-muted mt-1">主模型不可用时切换到的备用模型</div>
          </div>
        </div>

        {/* 重试错误关键词 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-text-primary mb-2">触发重试的错误关键词</label>
          <div className="flex flex-wrap gap-2">
            {(editConfig.retryOnErrors ?? config.retryOnErrors).map((kw, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-bg-tertiary text-text-primary rounded text-xs border border-border"
              >
                {kw}
              </span>
            ))}
          </div>
          <div className="text-xs text-text-muted mt-2">包含这些关键词的错误会自动触发重试</div>
        </div>

        {/* 保存按钮 */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button
            onClick={load}
            className="px-6 py-2 bg-bg-secondary text-text-primary rounded-lg text-sm font-medium hover:bg-bg-tertiary transition-colors border border-border"
          >
            重置
          </button>
        </div>
        <div className="text-xs text-yellow-400 mt-2">
          ⚠️ 保存配置后，所有缓存的 Provider 将被清除并在下次请求时重建
        </div>
      </div>

      {/* 熔断器状态 */}
      {stats && stats.circuitBreakers.length > 0 && (
        <div className="px-8 py-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">熔断器状态</h2>
          <div className="space-y-3">
            {stats.circuitBreakers.map((breaker) => (
              <CircuitBreakerCard
                key={breaker.modelId}
                breaker={breaker}
                onReset={() => handleResetBreaker(breaker.modelId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CircuitBreakerCard({ breaker, onReset }: { breaker: CircuitBreakerState; onReset: () => void }) {
  const stateConfig = {
    closed: { label: '正常', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: '✅' },
    open: { label: '熔断中', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: '🔴' },
    half_open: { label: '半开（恢复中）', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: '🟡' },
  }

  const sc = stateConfig[breaker.state]

  return (
    <div className="bg-bg-secondary rounded-xl p-4 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xl">{sc.icon}</span>
          <div>
            <div className="text-sm font-medium text-text-primary">{breaker.modelName}</div>
            <div className="text-xs text-text-muted">{breaker.modelId}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sc.color}`}>
            {sc.label}
          </span>
          {breaker.state !== 'closed' && (
            <button
              onClick={onReset}
              className="px-3 py-1 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-hover transition-colors"
            >
              重置熔断器
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div>
          <div className="text-xs text-text-muted">总请求</div>
          <div className="text-sm font-medium text-text-primary">{breaker.totalRequests}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">总失败</div>
          <div className="text-sm font-medium text-red-400">{breaker.totalFailures}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">总重试</div>
          <div className="text-sm font-medium text-yellow-400">{breaker.totalRetries}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Fallback</div>
          <div className="text-sm font-medium text-blue-400">{breaker.totalFallbacks}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">连续失败</div>
          <div className="text-sm font-medium text-orange-400">{breaker.failureCount}</div>
        </div>
      </div>

      {breaker.lastFailureError && (
        <div className="mt-3 bg-red-500/5 rounded-lg p-2 border border-red-500/10">
          <div className="text-xs text-text-muted mb-1">最近错误</div>
          <div className="text-xs text-red-400 font-mono truncate">{breaker.lastFailureError}</div>
        </div>
      )}

      {breaker.lastFailureTime && (
        <div className="mt-2 text-xs text-text-muted">
          最后失败时间: {new Date(breaker.lastFailureTime).toLocaleString()}
        </div>
      )}
    </div>
  )
}
