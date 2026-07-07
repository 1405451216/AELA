// 成本追踪服务
// [重构] 使用 SDK 原生 PricingCalculator + defaultPricingTable 替换自研定价表
// 保持 AELA 公共 API 不变（electron-store 持久化 + 预算管理 + 成本汇总）
// SDK 优势: 维护统一的定价表（含 DeepSeek/Qwen/GLM/Mistral/Cohere 等），避免价格不一致

import Store from 'electron-store'
import { PricingCalculator, defaultPricingTable, type ModelPricingInfo as SDKModelPricing } from '@agentprimordia/sdk'
import type { Usage } from '@agentprimordia/sdk'
import type { CostRecord, CostSummary, ModelCost, BudgetConfig, ModelPricing } from '@shared/types'

interface CostStoreSchema {
  budget: BudgetConfig | null
  customPricing: Record<string, ModelPricing>
  records: CostRecord[]
  totals: {
    totalCostUSD: number
    totalPromptTokens: number
    totalCompTokens: number
    totalTokens: number
    callCount: number
  }
}

// AELA 额外模型定价（SDK 未覆盖的新模型）
const AELA_EXTRA_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-20250514': { model: 'claude-sonnet-4-20250514', provider: 'anthropic', promptPricePer1M: 3.0, completionPricePer1M: 15.0 },
  'gemini-2.0-flash': { model: 'gemini-2.0-flash', provider: 'google', promptPricePer1M: 0.1, completionPricePer1M: 0.4 },
  'deepseek-reasoner': { model: 'deepseek-reasoner', provider: 'deepseek', promptPricePer1M: 0.55, completionPricePer1M: 2.19 },
}

export class CostTrackerService {
  private store: Store<CostStoreSchema>
  private calculator: PricingCalculator
  private budget: BudgetConfig | null
  private records: CostRecord[] = []
  // 累加字段
  private totalCostUSD = 0
  private totalPromptTokens = 0
  private totalCompTokens = 0
  private totalTokens = 0
  private callCount = 0
  private lastTokens = 0

  constructor(budget?: BudgetConfig) {
    this.store = new Store<CostStoreSchema>({
      name: 'aela-cost',
      defaults: {
        budget: null,
        customPricing: {},
        records: [],
        totals: { totalCostUSD: 0, totalPromptTokens: 0, totalCompTokens: 0, totalTokens: 0, callCount: 0 },
      },
    })

    const sdkTable = defaultPricingTable()
    for (const [model, p] of Object.entries(AELA_EXTRA_PRICING)) {
      const sdkPricing: SDKModelPricing = { model: p.model, provider: p.provider, promptPricePer1M: p.promptPricePer1M, completionPricePer1M: p.completionPricePer1M }
      sdkTable.set(model, sdkPricing)
    }
    const customPricing = this.store.get('customPricing', {})
    for (const [model, p] of Object.entries(customPricing)) {
      const sdkPricing: SDKModelPricing = { model: p.model, provider: p.provider, promptPricePer1M: p.promptPricePer1M, completionPricePer1M: p.completionPricePer1M }
      sdkTable.set(model, sdkPricing)
    }
    this.calculator = new PricingCalculator(sdkTable)

    this.budget = budget ?? this.store.get('budget', null)
    if (budget) this.store.set('budget', budget)
    this.records = this.store.get('records', [])
    const totals = this.store.get('totals', { totalCostUSD: 0, totalPromptTokens: 0, totalCompTokens: 0, totalTokens: 0, callCount: 0 })
    this.totalCostUSD = totals.totalCostUSD
    this.totalPromptTokens = totals.totalPromptTokens
    this.totalCompTokens = totals.totalCompTokens
    this.totalTokens = totals.totalTokens
    this.callCount = totals.callCount
  }
    this.store = new Store<CostStoreSchema>({
      name: 'aela-cost',
      defaults: {
        budget: null,
        customPricing: {},
        records: [],
        totals: { totalCostUSD: 0, totalPromptTokens: 0, totalCompTokens: 0, totalTokens: 0, callCount: 0 },
      },
    })

    // 使用 SDK defaultPricingTable + AELA 额外模型构建 PricingCalculator
    const sdkTable = defaultPricingTable()
    // 合并 AELA 额外模型
    for (const [model, p] of Object.entries(AELA_EXTRA_PRICING)) {
      const sdkPricing: SDKModelPricing = {
        model: p.model,
        provider: p.provider,
        promptPricePer1M: p.promptPricePer1M,
        completionPricePer1M: p.completionPricePer1M,
      }
      sdkTable.set(model, sdkPricing)
    }
    // 合并用户自定义定价
    const customPricing = this.store.get('customPricing', {})
    for (const [model, p] of Object.entries(customPricing)) {
      const sdkPricing: SDKModelPricing = {
        model: p.model,
        provider: p.provider,
        promptPricePer1M: p.promptPricePer1M,
        completionPricePer1M: p.completionPricePer1M,
      }
      sdkTable.set(model, sdkPricing)
    }
    this.calculator = new PricingCalculator(sdkTable)

    this.budget = budget ?? this.store.get('budget', null)
    // 加载持久化的记录和累计统计
    this.records = this.store.get('records', [])
    const totals = this.store.get('totals', { totalCostUSD: 0, totalPromptTokens: 0, totalCompTokens: 0, totalTokens: 0, callCount: 0 })
    this.totalCostUSD = totals.totalCostUSD
    this.totalPromptTokens = totals.totalPromptTokens
    this.totalCompTokens = totals.totalCompTokens
    this.totalTokens = totals.totalTokens
    this.callCount = totals.callCount
  }

  /**
   * 添加或更新模型定价 — 委托给 SDK PricingCalculator.setPricing
   */
  setPricing(model: string, pricing: ModelPricing): void {
    this.calculator.setPricing({
      model: pricing.model,
      provider: pricing.provider,
      promptPricePer1M: pricing.promptPricePer1M,
      completionPricePer1M: pricing.completionPricePer1M,
    })
    // 持久化自定义定价
    const customPricing = this.store.get('customPricing', {})
    customPricing[model] = pricing
    this.store.set('customPricing', customPricing)
  }

  /**
   * 获取模型定价 — 委托给 SDK PricingCalculator.getPricing
   */
  getPricing(model: string): ModelPricing | undefined {
    const sdkPricing = this.calculator.getPricing(model)
    if (!sdkPricing) return undefined
    return {
      model: sdkPricing.model,
      provider: sdkPricing.provider,
      promptPricePer1M: sdkPricing.promptPricePer1M,
      completionPricePer1M: sdkPricing.completionPricePer1M,
    }
  }

  /**
   * 列出所有定价
   */
  listPricing(): ModelPricing[] {
    const models = this.calculator.listModels()
    return models.map(m => {
      const p = this.calculator.getPricing(m)!
      return {
        model: p.model,
        provider: p.provider,
        promptPricePer1M: p.promptPricePer1M,
        completionPricePer1M: p.completionPricePer1M,
      }
    })
  }

  /**
   * 设置预算
   */
  setBudget(budget: BudgetConfig | null): void {
    this.budget = budget
    this.store.set('budget', budget)
  }

  /**
   * 获取预算
   */
  getBudget(): BudgetConfig | null {
    return this.budget
  }

  /**
   * 估算单次调用成本（USD）— 委托给 SDK PricingCalculator.calculate
   */
  estimateCost(model: string, usage: Usage): number {
    return this.calculator.calculate(model, usage.promptTokens, usage.completionTokens)
  }

  /**
   * 记录一次 LLM 调用的 Usage
   */
  record(model: string, sessionId: string, agentName: string, usage: Usage): boolean {
    const cost = this.estimateCost(model, usage)

    const record: CostRecord = {
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      costUSD: cost,
      timestamp: new Date().toISOString(),
      sessionId,
      agentName,
    }

    this.records.push(record)
    this.totalCostUSD += cost
    this.totalPromptTokens += usage.promptTokens
    this.totalCompTokens += usage.completionTokens
    this.totalTokens += usage.totalTokens
    this.callCount++
    this.lastTokens = usage.totalTokens

    // 持久化
    this.persist()

    // 预算检查
    return this.checkBudget()
  }

  /**
   * 检查是否超出预算
   */
  checkBudget(): boolean {
    if (!this.budget) return false

    if (this.budget.maxTotalCostUSD !== null && this.budget.maxTotalCostUSD !== undefined && this.budget.maxTotalCostUSD > 0 && this.totalCostUSD > this.budget.maxTotalCostUSD) {
      return true
    }
    if (this.budget.maxTokensPerSession !== null && this.budget.maxTokensPerSession !== undefined && this.budget.maxTokensPerSession > 0 && this.totalTokens > this.budget.maxTokensPerSession) {
      return true
    }
    if (this.budget.maxTokensPerCall !== null && this.budget.maxTokensPerCall !== undefined && this.budget.maxTokensPerCall > 0 && this.lastTokens > this.budget.maxTokensPerCall) {
      return true
    }
    return false
  }

  /**
   * 返回成本汇总
   */
  summary(): CostSummary {
    const byModel: Record<string, ModelCost> = {}
    const bySession: Record<string, ModelCost> = {}
    const byDay: Record<string, ModelCost> = {}

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const monthStr = now.toISOString().slice(0, 7)

    let todayCost = 0
    let monthCost = 0
    let todayTokens = 0
    let monthTokens = 0

    for (const r of this.records) {
      // by model
      if (!byModel[r.model]) byModel[r.model] = { costUSD: 0, calls: 0, tokens: 0 }
      byModel[r.model].costUSD += r.costUSD
      byModel[r.model].calls++
      byModel[r.model].tokens += r.totalTokens

      // by session
      if (!bySession[r.sessionId]) bySession[r.sessionId] = { costUSD: 0, calls: 0, tokens: 0 }
      bySession[r.sessionId].costUSD += r.costUSD
      bySession[r.sessionId].calls++
      bySession[r.sessionId].tokens += r.totalTokens

      // by day
      const day = r.timestamp.slice(0, 10)
      if (!byDay[day]) byDay[day] = { costUSD: 0, calls: 0, tokens: 0 }
      byDay[day].costUSD += r.costUSD
      byDay[day].calls++
      byDay[day].tokens += r.totalTokens

      // today/month accumulators
      if (day === todayStr) {
        todayCost += r.costUSD
        todayTokens += r.totalTokens
      }
      if (r.timestamp.slice(0, 7) === monthStr) {
        monthCost += r.costUSD
        monthTokens += r.totalTokens
      }
    }

    return {
      totalCostUSD: this.totalCostUSD,
      totalPromptTokens: this.totalPromptTokens,
      totalCompTokens: this.totalCompTokens,
      totalTokens: this.totalTokens,
      callCount: this.callCount,
      todayCostUSD: todayCost,
      todayTokens,
      monthCostUSD: monthCost,
      monthTokens,
      byModel,
      bySession,
      byDay,
    }
  }

  /**
   * 获取每日成本趋势（最近 N 天）
   */
  getDailyTrend(days: number = 30): Array<{ date: string; costUSD: number; tokens: number }> {
    const trend: Array<{ date: string; costUSD: number; tokens: number }> = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const byDay = new Map<string, { costUSD: number; tokens: number }>()
    for (const r of this.records) {
      const day = r.timestamp.slice(0, 10)
      const existing = byDay.get(day) ?? { costUSD: 0, tokens: 0 }
      existing.costUSD += r.costUSD
      existing.tokens += r.totalTokens
      byDay.set(day, existing)
    }

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const entry = byDay.get(key) ?? { costUSD: 0, tokens: 0 }
      trend.push({ date: key, ...entry })
    }
    return trend
  }

  /**
   * 检查今日花费是否超过阈值（默认 $5）
   */
  isTodayOverBudget(thresholdUSD: number = 5): boolean {
    const todayStr = new Date().toISOString().slice(0, 10)
    let todayCost = 0
    for (const r of this.records) {
      if (r.timestamp.slice(0, 10) === todayStr) {
        todayCost += r.costUSD
        if (todayCost > thresholdUSD) return true
      }
    }
    return false
  }

  /**
   * 导出 CSV（最近 90 天）
   */
  exportCSV(): string {
    const lines = ['timestamp,model,sessionId,agentName,promptTokens,completionTokens,totalTokens,costUSD']
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    for (const r of this.records) {
      if (new Date(r.timestamp).getTime() < cutoff) continue
      lines.push([
        r.timestamp,
        r.model,
        r.sessionId,
        r.agentName,
        r.promptTokens,
        r.completionTokens,
        r.totalTokens,
        r.costUSD.toFixed(6),
      ].join(','))
    }
    return lines.join('\n')
  }

  /**
   * 获取所有记录
   */
  getRecords(limit?: number): CostRecord[] {
    const records = [...this.records].reverse()
    return limit ? records.slice(0, limit) : records
  }

  /**
   * 重置追踪器
   */
  reset(): void {
    this.records = []
    this.totalCostUSD = 0
    this.totalPromptTokens = 0
    this.totalCompTokens = 0
    this.totalTokens = 0
    this.callCount = 0
    this.lastTokens = 0
    this.persist()
  }

  /**
   * 持久化记录和累计统计到磁盘
   */
  private persist(): void {
    // 限制持久化记录数量，避免无限增长（保留最近 5000 条）
    if (this.records.length > 5000) {
      this.records = this.records.slice(-5000)
    }
    this.store.set('records', this.records)
    this.store.set('totals', {
      totalCostUSD: this.totalCostUSD,
      totalPromptTokens: this.totalPromptTokens,
      totalCompTokens: this.totalCompTokens,
      totalTokens: this.totalTokens,
      callCount: this.callCount,
    })
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
