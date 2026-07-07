// 可观测性服务
// 整合 MetricsCollector + EventBus + 调试器状态
// 提供 Agent 运行时指标采集、事件发布/订阅、调试信息
// [升级] 增加指标趋势追踪、成本分析报告、异常检测告警

import { MetricsCollector, Bus } from '@agentprimordia/sdk'
import type { Event, EventType } from '@agentprimordia/sdk'
import type { MetricsSnapshot, MetricsTrend, MetricsTrendPoint, CostAnalysisReport, AnomalyAlert, CostSummary, CostRecord, BudgetConfig } from '@shared/types'
import { randomUUID } from 'crypto'
import Store from 'electron-store'

interface ObservabilityStoreSchema {
  trendPoints: MetricsTrendPoint[]
  alerts: AnomalyAlert[]
}

// 异常检测阈值
const ANOMALY_THRESHOLDS = {
  errorRate: 0.3,        // 错误率 > 30%
  llmLatency: 10000,     // LLM 延迟 > 10s
  toolLatency: 30000,    // 工具延迟 > 30s
  costSpikeMultiplier: 3, // 单次成本 > 平均的 3 倍
  budgetWarningPercent: 0.8, // 预算使用 > 80%
  toolFailureBurst: 5,   // 连续工具失败 > 5 次
}

export class ObservabilityService {
  private metrics: MetricsCollector = new MetricsCollector()
  private bus: Bus = new Bus()
  private store: Store<ObservabilityStoreSchema>

  // 调试器状态
  private debugEnabled = false
  private debugLog: Array<{ timestamp: string; type: string; data: unknown }> = []

  // 指标趋势追踪
  private trendPoints: MetricsTrendPoint[]
  private trendIntervalMs = 60_000 // 每分钟采样一次
  private lastTrendSnapshot: MetricsSnapshot | null = null
  private lastTrendTime = 0

  // 异常告警
  private alerts: AnomalyAlert[]
  private consecutiveToolFailures = 0

  constructor() {
    this.store = new Store<ObservabilityStoreSchema>({
      name: 'aela-observability',
      defaults: { trendPoints: [], alerts: [] },
    })
    this.trendPoints = this.store.get('trendPoints', [])
    this.alerts = this.store.get('alerts', [])

    // 启动趋势采样定时器
    this.startTrendSampling()
  }

  getMetricsCollector(): MetricsCollector {
    return this.metrics
  }

  getBus(): Bus {
    return this.bus
  }

  /**
   * 发布事件
   */
  publish(type: EventType, source: string, payload?: unknown): void {
    const event: Event = {
      id: randomUUID(),
      type,
      source,
      timestamp: new Date(),
      payload,
    }
    this.bus.publish(event)

    // 检测工具失败
    if ((type as string) === 'tool.error' || ((type as string) === 'tool.end' && payload && typeof payload === 'object' && 'error' in (payload as object))) {
      this.consecutiveToolFailures++
      if (this.consecutiveToolFailures >= ANOMALY_THRESHOLDS.toolFailureBurst) {
        this.raiseAlert({
          type: 'tool_failure_burst',
          severity: 'warning',
          message: `连续 ${this.consecutiveToolFailures} 次工具调用失败，可能存在环境问题`,
          metric: 'consecutive_tool_failures',
          threshold: ANOMALY_THRESHOLDS.toolFailureBurst,
          actual: this.consecutiveToolFailures,
        })
      }
    } else if ((type as string) === 'tool.end') {
      this.consecutiveToolFailures = 0
    }

    if (this.debugEnabled) {
      this.debugLog.push({
        timestamp: event.timestamp.toISOString(),
        type: event.type,
        data: event.payload,
      })
      // 提前裁剪避免数组膨胀到 10000 才触发
      if (this.debugLog.length > 5000) {
        this.debugLog = this.debugLog.slice(-2500)
      }
    }
  }

  /**
   * 订阅事件
   */
  subscribe(eventType: EventType, handler: (event: Event) => void): string {
    return this.bus.subscribe(eventType, handler)
  }

  /**
   * 订阅所有事件
   */
  subscribeAll(handler: (event: Event) => void): string {
    return this.bus.subscribeAll(handler)
  }

  /**
   * 取消订阅
   */
  unsubscribe(id: string): void {
    this.bus.unsubscribe(id)
  }

  /**
   * 获取指标快照
   */
  getSnapshot(): MetricsSnapshot {
    const snap = this.metrics.snapshot()
    return {
      llmTotalCalls: snap.llm_total_calls,
      llmTotalErrors: snap.llm_total_errors,
      toolTotalCalls: snap.tool_total_calls,
      toolTotalErrors: snap.tool_total_errors,
      totalTurns: snap.total_turns,
      activeAgents: snap.active_agents,
      avgLLMLatencyMs: snap.avg_llm_latency_ms,
      avgToolLatencyMs: snap.avg_tool_latency_ms,
    }
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics.reset()
    this.consecutiveToolFailures = 0
  }

  // ===== [升级] 指标趋势追踪 =====

  /**
   * 启动趋势采样定时器
   */
  private trendTimer: ReturnType<typeof setInterval> | null = null

  private startTrendSampling(): void {
    this.trendTimer = setInterval(() => {
      this.sampleTrend()
    }, this.trendIntervalMs)
    if (typeof this.trendTimer.unref === 'function') this.trendTimer.unref()
  }

  /**
   * 采样一次指标趋势
   */
  private sampleTrend(): void {
    const now = Date.now()
    const snap = this.getSnapshot()

    if (this.lastTrendSnapshot) {
      const point: MetricsTrendPoint = {
        timestamp: new Date(now).toISOString(),
        llmCalls: snap.llmTotalCalls - this.lastTrendSnapshot.llmTotalCalls,
        llmErrors: snap.llmTotalErrors - this.lastTrendSnapshot.llmTotalErrors,
        toolCalls: snap.toolTotalCalls - this.lastTrendSnapshot.toolTotalCalls,
        toolErrors: snap.toolTotalErrors - this.lastTrendSnapshot.toolTotalErrors,
        turns: snap.totalTurns - this.lastTrendSnapshot.totalTurns,
        avgLLMLatency: snap.avgLLMLatencyMs,
        avgToolLatency: snap.avgToolLatencyMs,
      }

      this.trendPoints.push(point)

      // 保留最近 1440 个点（24 小时的分钟级数据）
      if (this.trendPoints.length > 1440) {
        this.trendPoints = this.trendPoints.slice(-1440)
      }

      // 异常检测
      this.detectAnomalies(point, snap)
      // 防抖持久化：避免每 60 秒重写整个 1440 点数组
      this.flushTrendPoints()
    }

    this.lastTrendSnapshot = snap
    this.lastTrendTime = now
  }

  /** 防抖持久化：限制写入频率，避免每次采样都重写整个数组 */
  private trendFlushTimer: ReturnType<typeof setTimeout> | null = null
  private flushTrendPoints(): void {
    if (this.trendFlushTimer) return
    this.trendFlushTimer = setTimeout(() => {
      this.trendFlushTimer = null
      this.store.set('trendPoints', this.trendPoints)
    }, 5 * 60 * 1000)
    if (typeof this.trendFlushTimer.unref === 'function') this.trendFlushTimer.unref()
  }

  /**
   * 获取指标趋势
   */
  getTrend(hours: number = 1): MetricsTrend {
    const pointsNeeded = Math.min(hours * 60, this.trendPoints.length)
    const points = this.trendPoints.slice(-pointsNeeded)

    return {
      points,
      interval: `${this.trendIntervalMs / 1000}s`,
      startedAt: points.length > 0 ? points[0].timestamp : new Date().toISOString(),
      endedAt: points.length > 0 ? points[points.length - 1].timestamp : new Date().toISOString(),
    }
  }

  // ===== [升级] 异常检测 =====

  /**
   * 检测指标异常并生成告警
   */
  private detectAnomalies(point: MetricsTrendPoint, _snap: MetricsSnapshot): void {
    // 高错误率检测
    const totalCalls = point.llmCalls + point.toolCalls
    const totalErrors = point.llmErrors + point.toolErrors
    if (totalCalls > 5 && totalErrors / totalCalls > ANOMALY_THRESHOLDS.errorRate) {
      this.raiseAlert({
        type: 'high_error_rate',
        severity: totalErrors / totalCalls > 0.5 ? 'critical' : 'warning',
        message: `错误率 ${((totalErrors / totalCalls) * 100).toFixed(1)}% 超过阈值 ${ANOMALY_THRESHOLDS.errorRate * 100}%`,
        metric: 'error_rate',
        threshold: ANOMALY_THRESHOLDS.errorRate,
        actual: totalErrors / totalCalls,
      })
    }

    // 高延迟检测
    if (point.avgLLMLatency > ANOMALY_THRESHOLDS.llmLatency) {
      this.raiseAlert({
        type: 'high_latency',
        severity: 'warning',
        message: `LLM 平均延迟 ${point.avgLLMLatency.toFixed(0)}ms 超过阈值 ${ANOMALY_THRESHOLDS.llmLatency}ms`,
        metric: 'avg_llm_latency',
        threshold: ANOMALY_THRESHOLDS.llmLatency,
        actual: point.avgLLMLatency,
      })
    }

    if (point.avgToolLatency > ANOMALY_THRESHOLDS.toolLatency) {
      this.raiseAlert({
        type: 'high_latency',
        severity: 'warning',
        message: `工具平均延迟 ${point.avgToolLatency.toFixed(0)}ms 超过阈值 ${ANOMALY_THRESHOLDS.toolLatency}ms`,
        metric: 'avg_tool_latency',
        threshold: ANOMALY_THRESHOLDS.toolLatency,
        actual: point.avgToolLatency,
      })
    }
  }

  /**
   * 生成告警
   */
  private raiseAlert(params: Omit<AnomalyAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    // 避免重复告警（相同类型 5 分钟内不重复）
    const recent = this.alerts.find(
      a => a.type === params.type &&
           !a.acknowledged &&
           Date.now() - new Date(a.timestamp).getTime() < 5 * 60 * 1000
    )
    if (recent) return

    const alert: AnomalyAlert = {
      id: randomUUID(),
      ...params,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    }

    this.alerts.push(alert)
    // 保留最近 100 条告警
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }
    this.store.set('alerts', this.alerts)

    // 发布事件通知 UI
    this.bus.publish({
      id: randomUUID(),
      type: 'agent.error' as EventType,
      source: 'observability',
      timestamp: new Date(),
      payload: { alert },
    })
  }

  /**
   * 检查预算异常（由外部调用，传入成本数据）
   */
  checkCostAnomalies(summary: CostSummary, budget: BudgetConfig | null): void {
    if (!budget) return

    if (budget.maxTotalCostUSD && budget.maxTotalCostUSD > 0) {
      const usagePercent = summary.totalCostUSD / budget.maxTotalCostUSD
      if (usagePercent >= ANOMALY_THRESHOLDS.budgetWarningPercent) {
        this.raiseAlert({
          type: 'budget_warning',
          severity: usagePercent >= 1 ? 'critical' : 'warning',
          message: `预算使用率 ${(usagePercent * 100).toFixed(1)}% (${summary.totalCostUSD.toFixed(4)}/${budget.maxTotalCostUSD} USD)`,
          metric: 'budget_usage',
          threshold: ANOMALY_THRESHOLDS.budgetWarningPercent,
          actual: usagePercent,
        })
      }
    }
  }

  /**
   * 获取所有告警
   */
  getAlerts(includeAcknowledged: boolean = false): AnomalyAlert[] {
    const sorted = [...this.alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return includeAcknowledged ? sorted : sorted.filter(a => !a.acknowledged)
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.find(a => a.id === id)
    if (!alert) return false
    alert.acknowledged = true
    this.store.set('alerts', this.alerts)
    return true
  }

  // ===== [升级] 成本分析报告 =====

  /**
   * 生成成本分析报告
   */
  generateCostAnalysis(costSummary: CostSummary, costRecords: CostRecord[], budget: BudgetConfig | null): CostAnalysisReport {
    // 按天分组统计
    const dailyMap: Map<string, { cost: number; calls: number }> = new Map()
    for (const r of costRecords) {
      const date = r.timestamp.split('T')[0]
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { cost: 0, calls: 0 })
      }
      const d = dailyMap.get(date)!
      d.cost += r.costUSD
      d.calls++
    }
    const dailyCosts = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // 按模型统计 Top
    const modelMap: Map<string, { cost: number; calls: number; tokens: number }> = new Map()
    for (const r of costRecords) {
      if (!modelMap.has(r.model)) {
        modelMap.set(r.model, { cost: 0, calls: 0, tokens: 0 })
      }
      const m = modelMap.get(r.model)!
      m.cost += r.costUSD
      m.calls++
      m.tokens += r.totalTokens
    }
    const topModels = Array.from(modelMap.entries())
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)

    // 预测月度成本（基于最近 7 天的平均日成本）
    const recent7Days = dailyCosts.slice(-7)
    const avgDailyCost = recent7Days.length > 0
      ? recent7Days.reduce((s, d) => s + d.cost, 0) / recent7Days.length
      : 0
    const projectedMonthlyCost = avgDailyCost * 30

    // 预算使用率
    const budgetMax = budget?.maxTotalCostUSD ?? 0
    const budgetUsagePercent = budgetMax > 0 ? (costSummary.totalCostUSD / budgetMax) * 100 : 0
    const budgetRemaining = budgetMax > 0 ? Math.max(0, budgetMax - costSummary.totalCostUSD) : 0

    return {
      summary: costSummary,
      dailyCosts,
      topModels,
      projectedMonthlyCost,
      budgetUsagePercent,
      budgetRemaining,
    }
  }

  // ===== 调试器 =====

  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled
  }

  isDebugEnabled(): boolean {
    return this.debugEnabled
  }

  getDebugLog(): Array<{ timestamp: string; type: string; data: unknown }> {
    return this.debugLog
  }

  clearDebugLog(): void {
    this.debugLog = []
  }

  /**
   * 获取调试器状态
   */
  getDebugStatus(): {
    enabled: boolean
    logEntries: number
    subscriberCount: number
  } {
    return {
      enabled: this.debugEnabled,
      logEntries: this.debugLog.length,
      subscriberCount: this.bus.subscriberCount('agent.start'),
    }
  }

  /** 生命周期停止方法，别名调用 close() */
  stop(): void {
    this.close()
  }

  close(): void {
    if (this.trendTimer) {
      clearInterval(this.trendTimer)
      this.trendTimer = null
    }
    // 退出时立即 flush 趋势数据，避免丢失最后一次防抖窗口内的点
    if (this.trendFlushTimer) {
      clearTimeout(this.trendFlushTimer)
      this.trendFlushTimer = null
    }
    this.store.set('trendPoints', this.trendPoints)
    this.bus.close()
  }
}
