// [升级 3] 可观测性增强 — 指标趋势 + 成本分析 + 异常告警
import { useState, useEffect, useCallback } from 'react'
import type { MetricsTrend, CostAnalysisReport, AnomalyAlert } from '@shared/types'

type TabType = 'trend' | 'cost' | 'anomaly'

export default function ObservabilityDashboardView() {
  const [tab, setTab] = useState<TabType>('trend')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">📊</span>
          <h1 className="text-xl font-bold text-text-primary">可观测性中心</h1>
        </div>
        <p className="text-sm text-text-muted">
          实时指标趋势 · 成本分析报告 · 异常检测告警
        </p>
      </div>

      <div className="px-8 pt-4">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit">
          {([
            { key: 'trend', label: '指标趋势', icon: '📈' },
            { key: 'cost', label: '成本分析', icon: '💰' },
            { key: 'anomaly', label: '异常告警', icon: '🚨' },
          ] as Array<{ key: TabType; label: string; icon: string }>).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-4">
        {tab === 'trend' && <TrendTab />}
        {tab === 'cost' && <CostTab />}
        {tab === 'anomaly' && <AnomalyTab />}
      </div>
    </div>
  )
}

// ===== 指标趋势 =====
function TrendTab() {
  const [trend, setTrend] = useState<MetricsTrend | null>(null)
  const [hours, setHours] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadTrend = useCallback(async () => {
    setLoading(true)
    try {
      const t = await window.aela.observability.trend(hours)
      setTrend(t)
    } catch (err) {
      console.error('Failed to load trend:', err)
    } finally {
      setLoading(false)
    }
  }, [hours])

  useEffect(() => {
    loadTrend()
    const timer = setInterval(loadTrend, 30000)
    return () => clearInterval(timer)
  }, [loadTrend])

  if (loading && !trend) {
    return <div className="text-center text-text-muted py-12">加载指标趋势中...</div>
  }

  if (!trend || trend.points.length === 0) {
    return (
      <div className="text-center text-text-muted py-12 bg-surface border border-border rounded-lg">
        暂无趋势数据，开始使用 Agent 后将自动采集
      </div>
    )
  }

  const maxLLMCalls = Math.max(...trend.points.map(p => p.llmCalls), 1)
  const maxErrors = Math.max(...trend.points.map(p => p.llmErrors + p.toolErrors), 1)

  return (
    <div className="space-y-4">
      {/* 时间范围选择 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">时间范围:</span>
        {[1, 6, 24].map(h => (
          <button
            key={h}
            onClick={() => setHours(h)}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${
              hours === h
                ? 'bg-blue-600 text-white'
                : 'bg-surface border border-border text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {h < 24 ? `${h}小时` : '24小时'}
          </button>
        ))}
        <span className="text-[10px] text-text-muted ml-auto">
          采样间隔: {trend.interval} · 共 {trend.points.length} 个数据点
        </span>
      </div>

      {/* LLM 调用趋势 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">LLM 调用数</h3>
        <div className="flex items-end gap-1 h-32">
          {trend.points.map((p, i) => (
            <div
              key={i}
              className="flex-1 bg-blue-500/70 rounded-t hover:bg-blue-400 transition-colors relative group"
              style={{ height: `${(p.llmCalls / maxLLMCalls) * 100}%`, minHeight: '2px' }}
              title={`${new Date(p.timestamp).toLocaleTimeString()}: ${p.llmCalls} 次调用`}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {p.llmCalls}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 错误趋势 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">错误数 (LLM + Tool)</h3>
        <div className="flex items-end gap-1 h-24">
          {trend.points.map((p, i) => (
            <div
              key={i}
              className="flex-1 bg-red-500/70 rounded-t hover:bg-red-400 transition-colors relative group"
              style={{ height: `${((p.llmErrors + p.toolErrors) / maxErrors) * 100}%`, minHeight: '2px' }}
              title={`${new Date(p.timestamp).toLocaleTimeString()}: LLM ${p.llmErrors} + Tool ${p.toolErrors}`}
            >
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {p.llmErrors + p.toolErrors}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 延迟趋势 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">LLM 平均延迟</h3>
          <div className="flex items-end gap-1 h-20">
            {trend.points.map((p, i) => {
              const maxLat = Math.max(...trend.points.map(pt => pt.avgLLMLatency), 1)
              return (
                <div
                  key={i}
                  className="flex-1 bg-green-500/70 rounded-t hover:bg-green-400 transition-colors"
                  style={{ height: `${(p.avgLLMLatency / maxLat) * 100}%`, minHeight: '2px' }}
                  title={`${new Date(p.timestamp).toLocaleTimeString()}: ${p.avgLLMLatency.toFixed(0)}ms`}
                />
              )
            })}
          </div>
          <p className="text-[10px] text-text-muted mt-2">
            最新: {trend.points[trend.points.length - 1]?.avgLLMLatency.toFixed(0)}ms
          </p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">Tool 平均延迟</h3>
          <div className="flex items-end gap-1 h-20">
            {trend.points.map((p, i) => {
              const maxLat = Math.max(...trend.points.map(pt => pt.avgToolLatency), 1)
              return (
                <div
                  key={i}
                  className="flex-1 bg-orange-500/70 rounded-t hover:bg-orange-400 transition-colors"
                  style={{ height: `${(p.avgToolLatency / maxLat) * 100}%`, minHeight: '2px' }}
                  title={`${new Date(p.timestamp).toLocaleTimeString()}: ${p.avgToolLatency.toFixed(0)}ms`}
                />
              )
            })}
          </div>
          <p className="text-[10px] text-text-muted mt-2">
            最新: {trend.points[trend.points.length - 1]?.avgToolLatency.toFixed(0)}ms
          </p>
        </div>
      </div>
    </div>
  )
}

// ===== 成本分析 =====
function CostTab() {
  const [report, setReport] = useState<CostAnalysisReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReport()
  }, [])

  const loadReport = async () => {
    setLoading(true)
    try {
      const r = await window.aela.observability.costAnalysis()
      setReport(r)
    } catch (err) {
      console.error('Failed to load cost analysis:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-text-muted py-12">生成成本分析中...</div>
  }

  if (!report) {
    return <div className="text-center text-text-muted py-12">暂无成本数据</div>
  }

  return (
    <div className="space-y-4">
      {/* 概览 */}
      <div className="grid grid-cols-4 gap-3">
        <CostStat label="总成本" value={`$${report.summary.totalCostUSD.toFixed(4)}`} icon="💵" />
        <CostStat label="调用次数" value={report.summary.callCount} icon="📞" />
        <CostStat label="总 Token" value={report.summary.totalTokens.toLocaleString()} icon="🔤" />
        <CostStat label="月预测" value={`$${report.projectedMonthlyCost.toFixed(2)}`} icon="📅" />
      </div>

      {/* 预算使用 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-text-primary">预算使用情况</h3>
          <span className={`text-xs font-bold ${
            report.budgetUsagePercent > 80 ? 'text-red-400' :
            report.budgetUsagePercent > 50 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {report.budgetUsagePercent.toFixed(1)}%
          </span>
        </div>
        <div className="bg-bg-primary rounded-full h-3 overflow-hidden">
          <div
            className={`h-full transition-all ${
              report.budgetUsagePercent > 80 ? 'bg-red-500' :
              report.budgetUsagePercent > 50 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(report.budgetUsagePercent, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-text-muted mt-1">
          剩余预算: ${report.budgetRemaining.toFixed(4)}
        </p>
      </div>

      {/* 每日成本 */}
      {report.dailyCosts.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">每日成本趋势</h3>
          <div className="flex items-end gap-1 h-32">
            {report.dailyCosts.slice(-30).map((d, i) => {
              const maxCost = Math.max(...report.dailyCosts.map(c => c.cost), 0.01)
              return (
                <div
                  key={i}
                  className="flex-1 bg-green-500/70 rounded-t hover:bg-green-400 transition-colors relative group"
                  style={{ height: `${(d.cost / maxCost) * 100}%`, minHeight: '2px' }}
                  title={`${d.date}: $${d.cost.toFixed(4)} (${d.calls} 次)`}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    ${d.cost.toFixed(3)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top 模型 */}
      {report.topModels.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">成本最高的模型</h3>
          <div className="space-y-2">
            {report.topModels.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-text-muted w-4">{i + 1}</span>
                <span className="text-sm text-text-primary flex-1 truncate">{m.model}</span>
                <span className="text-xs text-green-400">${m.cost.toFixed(4)}</span>
                <span className="text-[10px] text-text-muted">{m.calls} 次</span>
                <span className="text-[10px] text-text-muted">{m.tokens.toLocaleString()} tk</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 异常告警 =====
function AnomalyTab() {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([])
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.aela.observability.anomalyList(showAll)
      setAlerts(list)
    } catch (err) {
      console.error('Failed to load alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [showAll])

  useEffect(() => {
    loadAlerts()
    const timer = setInterval(loadAlerts, 15000)
    return () => clearInterval(timer)
  }, [loadAlerts])

  const handleAck = async (id: string) => {
    try {
      await window.aela.observability.anomalyAcknowledge(id)
      loadAlerts()
    } catch (err) {
      console.error('Ack failed:', err)
    }
  }

  const handleCheck = async () => {
    try {
      await window.aela.observability.anomalyCheck()
      loadAlerts()
    } catch (err) {
      console.error('Check failed:', err)
    }
  }

  if (loading && alerts.length === 0) {
    return <div className="text-center text-text-muted py-12">加载告警中...</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="accent-blue-500"
          />
          显示已确认的告警
        </label>
        <button
          onClick={handleCheck}
          className="text-xs px-3 py-1.5 rounded-md bg-surface border border-border hover:bg-surface-hover text-text-secondary"
        >
          🔄 检查异常
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center text-text-muted py-12 bg-surface border border-border rounded-lg">
          ✅ 暂无异常告警
        </div>
      ) : (
        alerts.map(alert => (
          <div
            key={alert.id}
            className={`border rounded-lg p-4 ${
              alert.severity === 'critical' ? 'border-red-500/50 bg-red-500/5' :
              alert.severity === 'warning' ? 'border-yellow-500/50 bg-yellow-500/5' :
              'border-blue-500/50 bg-blue-500/5'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                    alert.severity === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {alert.severity}
                  </span>
                  <span className="text-[10px] text-text-muted">{alert.type}</span>
                  {alert.acknowledged && (
                    <span className="text-[10px] text-green-400">✓ 已确认</span>
                  )}
                </div>
                <p className="text-sm text-text-primary">{alert.message}</p>
                <div className="flex gap-4 mt-2 text-[10px] text-text-muted">
                  <span>阈值: {alert.threshold}</span>
                  <span>实际: {alert.actual}</span>
                  <span>指标: {alert.metric}</span>
                  <span>{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
              </div>
              {!alert.acknowledged && (
                <button
                  onClick={() => handleAck(alert.id)}
                  className="text-xs px-3 py-1 rounded-md bg-surface border border-border hover:bg-surface-hover text-text-secondary"
                >
                  确认
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function CostStat({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="text-xl font-bold text-text-primary mt-1">{value}</div>
    </div>
  )
}
