import { logError } from '../lib/logger'
// SDK 工具面板组件
// 提供结构化输出提取、记忆重要性衰减、模型路由、可视化等功能的操作界面

import { useEffect, useState, useCallback } from 'react'
import type { RouteSuggestion } from '@shared/types'

/** 缓存统计类型 */
interface CacheStatsType {
  hits?: number
  misses?: number
  size?: number
  hitRate?: number
  [key: string]: unknown
}

/** 模型路由配置类型 */
interface ModelRouteConfigType {
  rules?: Array<{
    id?: string
    taskType?: string
    modelConfigId?: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

/** 记忆衰减结果类型 */
interface MemoryDecayResult {
  processed?: number
  updated?: number
  [key: string]: unknown
}

// ===== 结构化数据提取面板 =====
function StructuredExtractPanel({ modelConfigId, onError }: { modelConfigId: string; onError: (msg: string) => void }) {
  const [input, setInput] = useState('')
  const [schemaType, setSchemaType] = useState('sentiment')
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [schemas, setSchemas] = useState<Record<string, unknown>>({})

  useEffect(() => {
    window.aela.sdkPhase4.getSchemas().then((s: unknown) => setSchemas(s as Record<string, unknown>)).catch((err) => logError('sdkTools.getSchemas', err))
  }, [])

  const handleExtract = async () => {
    if (!input.trim() || !modelConfigId) {
      onError('请输入文本并选择模型')
      return
    }
    setLoading(true)
    setResult('')
    try {
      const schema = schemas[schemaType] as Record<string, unknown>
      const res = await window.aela.sdkPhase4.extractWithSchema(modelConfigId, input, schema)
      setResult(JSON.stringify(res, null, 2))
    } catch (err: unknown) {
      onError(`提取失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-medium text-text-primary">结构化数据提取</h4>
        <p className="text-xs text-text-muted">使用 SDK StructuredOutputExtractor，通过 JSON Schema 引导 LLM 输出结构化数据，支持错误反馈重试</p>

        <div className="space-y-2">
          <label className="text-xs text-text-secondary">Schema 类型</label>
          <select
            value={schemaType}
            onChange={e => setSchemaType(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
          >
            <option value="sentiment">情感分析</option>
            <option value="classification">文本分类</option>
            <option value="summary">摘要提取</option>
            <option value="ner">命名实体识别 (NER)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-text-secondary">输入文本</label>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={4}
            placeholder="输入要提取结构化数据的文本..."
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none"
          />
        </div>

        <button
          onClick={handleExtract}
          disabled={loading || !input.trim() || !modelConfigId}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '提取中...' : '提取结构化数据'}
        </button>
      </div>

      {result && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-medium text-text-primary">提取结果</h4>
          <pre className="bg-bg-primary border border-border rounded-lg p-3 text-xs text-text-primary overflow-x-auto max-h-60 overflow-y-auto">
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}

// ===== 记忆重要性衰减面板 =====
function MemoryDecayPanel({ onError }: { onError: (msg: string) => void }) {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [decayFactor, setDecayFactor] = useState(0.95)
  const [stats, setStats] = useState<{ totalEpisodes?: number } | null>(null)

  useEffect(() => {
    window.aela.memory.stats().then(s => setStats(s ? { totalEpisodes: s.totalEpisodes } : null)).catch((err) => logError('sdkTools.memoryStats', err))
  }, [result])

  const handleDecay = async () => {
    setLoading(true)
    try {
      const res = await window.aela.sdkPhase4.memory.decay(decayFactor) as MemoryDecayResult
      setResult(`处理完成: ${res.processed ?? 0} 条记忆, 更新 ${res.updated ?? 0} 条重要性`)
    } catch (err: unknown) {
      onError(`记忆衰减失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-medium text-text-primary">记忆重要性衰减</h4>
        <p className="text-xs text-text-muted">使用指数衰减函数降低旧记忆的重要性: importance × decayFactor^ageDays。有助于让 Agent 关注近期记忆</p>

        {stats && (
          <div className="text-xs text-text-secondary">
            当前记忆总量: <span className="text-text-primary font-medium">{stats.totalEpisodes ?? 0}</span> 条
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs text-text-secondary">衰减因子 (0-1, 越小衰减越快)</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={decayFactor}
              onChange={e => setDecayFactor(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm text-text-primary w-12 text-right">{decayFactor.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleDecay}
          disabled={loading}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? '处理中...' : '执行衰减'}
        </button>

        {result && (
          <div className="text-sm text-text-secondary bg-bg-primary/50 rounded-lg p-3 border border-border">
            {result}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== 模型路由面板 =====
function ModelRoutePanel({ onError }: { onError: (msg: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [suggestion, setSuggestion] = useState<RouteSuggestion | null>(null)
  const [config, setConfig] = useState<ModelRouteConfigType | null>(null)
  const [, setModelConfigId] = useState('')

  useEffect(() => {
    window.aela.modelRoute.getConfig().then((c: unknown) => {
      const config = c as ModelRouteConfigType
      setConfig(config)
      if (config.rules && config.rules.length > 0 && config.rules[0].modelConfigId) {
        setModelConfigId(config.rules[0].modelConfigId)
      }
    }).catch((err) => logError('sdkTools.modelRoute', err))
  }, [])

  const handleSuggest = async () => {
    if (!input.trim()) {
      onError('请输入任务描述')
      return
    }
    setLoading(true)
    try {
      const res = await window.aela.modelRoute.suggest('code', input)
      setSuggestion(res)
    } catch (err: unknown) {
      onError(`获取推荐失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-medium text-text-primary">智能模型路由</h4>
        <p className="text-xs text-text-muted">根据任务类型和输入复杂度自动选择最优模型</p>

        <div className="space-y-2">
          <label className="text-xs text-text-secondary">任务描述</label>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="如: 帮我写一个排序算法"
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
          />
        </div>

        <button
          onClick={handleSuggest}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '分析中...' : '获取模型推荐'}
        </button>
      </div>

      {suggestion && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-medium text-text-primary">推荐结果</h4>
          <pre className="bg-bg-primary border border-border rounded-lg p-3 text-xs text-text-primary overflow-x-auto">
            {JSON.stringify(suggestion, null, 2)}
          </pre>
        </div>
      )}

      {config && (
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-medium text-text-primary">路由配置</h4>
          <pre className="bg-bg-primary border border-border rounded-lg p-3 text-xs text-text-primary overflow-x-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ===== 性能优化面板 =====
function PerformancePanel({ onError }: { onError: (msg: string) => void }) {
  const [cacheStats, setCacheStats] = useState<CacheStatsType | null>(null)
  const [specStats, setSpecStats] = useState<unknown[]>([])
  const [cacheEnabled, setCacheEnabled] = useState(true)
  const [specEnabled, setSpecEnabled] = useState(true)
  const [, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [cs, ss] = await Promise.all([
        window.aela.perf.cache.stats(),
        window.aela.perf.speculative.stats(),
      ])
      setCacheStats(cs as CacheStatsType)
      setSpecStats(ss as unknown[])
    } catch (err: unknown) {
      onError(`获取统计失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleToggleCache = async () => {
    try {
      const res = await window.aela.perf.cache.toggle(!cacheEnabled)
      setCacheEnabled(typeof res === 'boolean' ? res : !cacheEnabled)
    } catch (err: unknown) {
      onError(`切换缓存失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleToggleSpec = async () => {
    try {
      await window.aela.perf.speculative.toggle(!specEnabled)
      setSpecEnabled(!specEnabled)
    } catch (err: unknown) {
      onError(`切换投机执行失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleClearCache = async () => {
    try {
      await window.aela.perf.cache.clear()
      refresh()
    } catch (err: unknown) {
      onError(`清空缓存失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleResetSpec = async () => {
    try {
      await window.aela.perf.speculative.reset()
      refresh()
    } catch (err: unknown) {
      onError(`重置统计失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* 请求缓存 */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-text-primary">请求缓存</h4>
            <p className="text-xs text-text-muted">LLM 响应指纹缓存，避免重复调用，节省 API 成本</p>
          </div>
          <button
            onClick={handleToggleCache}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              cacheEnabled ? 'bg-green-500/20 text-green-400' : 'bg-surface-hover text-text-muted'
            }`}
          >
            {cacheEnabled ? '已启用' : '已禁用'}
          </button>
        </div>
        {cacheStats && (
          <pre className="bg-bg-primary border border-border rounded-lg p-3 text-xs text-text-primary overflow-x-auto">
            {JSON.stringify(cacheStats, null, 2)}
          </pre>
        )}
        <button
          onClick={handleClearCache}
          className="px-3 py-1.5 bg-surface-hover text-text-secondary rounded-lg text-xs hover:text-text-primary"
        >
          清空缓存
        </button>
      </div>

      {/* 投机执行 */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-text-primary">投机执行</h4>
            <p className="text-xs text-text-muted">工具执行期间并行预热下一轮 LLM 调用，降低端到端延迟</p>
          </div>
          <button
            onClick={handleToggleSpec}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              specEnabled ? 'bg-green-500/20 text-green-400' : 'bg-surface-hover text-text-muted'
            }`}
          >
            {specEnabled ? '已启用' : '已禁用'}
          </button>
        </div>
        {specStats.length > 0 && (
          <pre className="bg-bg-primary border border-border rounded-lg p-3 text-xs text-text-primary overflow-x-auto">
            {JSON.stringify(specStats, null, 2)}
          </pre>
        )}
        <button
          onClick={handleResetSpec}
          className="px-3 py-1.5 bg-surface-hover text-text-secondary rounded-lg text-xs hover:text-text-primary"
        >
          重置统计
        </button>
      </div>
    </div>
  )
}

export { StructuredExtractPanel, MemoryDecayPanel, ModelRoutePanel, PerformancePanel }

/** SDK 工具主面板 - 组合所有 SDK 工具 */
export default function SDKToolsView({ onError }: { onError: (msg: string) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'extract' | 'memory' | 'route' | 'perf'>('extract')
  const [modelConfigId, setModelConfigId] = useState('')

  // 获取可用模型列表
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])
  useEffect(() => {
    window.aela.model.list().then((m: Array<{ id: string; name: string }>) => {
      setModels(m)
      if (m.length > 0 && !modelConfigId) {
        setModelConfigId(m[0].id)
      }
    }).catch((err) => { logError('sdkTools.list', err); return [] })
  }, [modelConfigId])

  return (
    <div className="space-y-4">
      {/* 子标签切换 */}
      <div className="flex gap-2 border-b border-border pb-2">
        {(['extract', 'memory', 'route', 'perf'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeSubTab === tab
                ? 'bg-accent text-white'
                : 'bg-surface-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab === 'extract' && '结构化提取'}
            {tab === 'memory' && '记忆衰减'}
            {tab === 'route' && '模型路由'}
            {tab === 'perf' && '性能优化'}
          </button>
        ))}
      </div>

      {/* 模型选择器 */}
      {models.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-3">
          <label className="text-xs text-text-secondary block mb-1">选择模型配置</label>
          <select
            value={modelConfigId}
            onChange={e => setModelConfigId(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* 子面板内容 */}
      {activeSubTab === 'extract' && (
        <StructuredExtractPanel modelConfigId={modelConfigId} onError={onError} />
      )}
      {activeSubTab === 'memory' && (
        <MemoryDecayPanel onError={onError} />
      )}
      {activeSubTab === 'route' && (
        <ModelRoutePanel onError={onError} />
      )}
      {activeSubTab === 'perf' && (
        <PerformancePanel onError={onError} />
      )}
    </div>
  )
}
