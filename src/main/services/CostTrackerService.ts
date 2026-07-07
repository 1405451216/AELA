// 成本追踪服务
// [重构] 使用 SDK 原生 PricingCalculator + defaultPricingTable
import Store from 'electron-store'
import { PricingCalculator, defaultPricingTable, type ModelPricingInfo as SDKModelPricing } from '@agentprimordia/sdk'
import type { Usage } from '@agentprimordia/sdk'
import type { CostRecord, CostSummary, ModelCost, BudgetConfig, ModelPricing } from '@shared/types'

interface CostStoreSchema {
  budget: BudgetConfig | null
  customPricing: Record<string, ModelPricing>
  records: CostRecord[]
  totals: { totalCostUSD: number; totalPromptTokens: number; totalCompTokens: number; totalTokens: number; callCount: number }
}

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
  private totalCostUSD = 0
  private totalPromptTokens = 0
  private totalCompTokens = 0
  private totalTokens = 0
  private callCount = 0
  private lastTokens = 0

  constructor(budget?: BudgetConfig) {
    this.store = new Store<CostStoreSchema>({
      name: 'aela-cost',
      defaults: { budget: null, customPricing: {}, records: [], totals: { totalCostUSD: 0, totalPromptTokens: 0, totalCompTokens: 0, totalTokens: 0, callCount: 0 } },
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
    this.records = this.store.get('records', [])
    const totals = this.store.get('totals', { totalCostUSD: 0, totalPromptTokens: 0, totalCompTokens: 0, totalTokens: 0, callCount: 0 })
    this.totalCostUSD = totals.totalCostUSD
    this.totalPromptTokens = totals.totalPromptTokens
    this.totalCompTokens = totals.totalCompTokens
    this.totalTokens = totals.totalTokens
    this.callCount = totals.callCount
  }

  setPricing(model: string, pricing: ModelPricing): void {
    this.calculator.setPricing({ model: pricing.model, provider: pricing.provider, promptPricePer1M: pricing.promptPricePer1M, completionPricePer1M: pricing.completionPricePer1M })
    const customPricing = this.store.get('customPricing', {})
    customPricing[model] = pricing
    this.store.set('customPricing', customPricing)
  }

  getPricing(model: string): ModelPricing | undefined {
    const sdkPricing = this.calculator.getPricing(model)
    if (!sdkPricing) return undefined
    return { model: sdkPricing.model, provider: sdkPricing.provider, promptPricePer1M: sdkPricing.promptPricePer1M, completionPricePer1M: sdkPricing.completionPricePer1M }
  }

  listPricing(): ModelPricing[] {
    const models = this.calculator.listModels()
    return models.map(m => {
      const p = this.calculator.getPricing(m)!
      return { model: p.model, provider: p.provider, promptPricePer1M: p.promptPricePer1M, completionPricePer1M: p.completionPricePer1M }
    })
  }

  setBudget(budget: BudgetConfig | null): void {
    this.budget = budget
    this.store.set('budget', budget)
  }

  getBudget(): BudgetConfig | null {
    return this.budget
  }

  estimateCost(model: string, usage: Usage): number {
    return this.calculator.calculate(model, usage.promptTokens, usage.completionTokens)
  }

  record(model: string, sessionId: string, agentName: string, usage: Usage): boolean {
    const cost = this.estimateCost(model, usage)
    const record: CostRecord = { model, promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, totalTokens: usage.totalTokens, costUSD: cost, timestamp: new Date().toISOString(), sessionId, agentName }
    this.records.push(record)
    this.totalCostUSD += cost
    this.totalPromptTokens += usage.promptTokens
    this.totalCompTokens += usage.completionTokens
    this.totalTokens += usage.totalTokens
    this.callCount++
    this.lastTokens = usage.totalTokens
    this.persistInternal()
    return this.checkBudget()
  }

  checkBudget(): boolean {
    if (!this.budget) return false
    if (this.budget.maxTotalCostUSD !== null && this.budget.maxTotalCostUSD !== undefined && this.budget.maxTotalCostUSD > 0 && this.totalCostUSD > this.budget.maxTotalCostUSD) return true
    if (this.budget.maxTokensPerSession !== null && this.budget.maxTokensPerSession !== undefined && this.budget.maxTokensPerSession > 0 && this.totalTokens > this.budget.maxTokensPerSession) return true
    if (this.budget.maxTokensPerCall !== null && this.budget.maxTokensPerCall !== undefined && this.budget.maxTokensPerCall > 0 && this.lastTokens > this.budget.maxTokensPerCall) return true
    return false
  }

  summary(): CostSummary {
    const byModel: Record<string, ModelCost> = {}
    const bySession: Record<string, ModelCost> = {}
    const byDay: Record<string, ModelCost> = {}
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const monthStr = now.toISOString().slice(0, 7)
    let todayCost = 0, monthCost = 0, todayTokens = 0, monthTokens = 0
    for (const r of this.records) {
      if (!byModel[r.model]) byModel[r.model] = { costUSD: 0, calls: 0, tokens: 0 }
      byModel[r.model].costUSD += r.costUSD; byModel[r.model].calls++; byModel[r.model].tokens += r.totalTokens
      if (!bySession[r.sessionId]) bySession[r.sessionId] = { costUSD: 0, calls: 0, tokens: 0 }
      bySession[r.sessionId].costUSD += r.costUSD; bySession[r.sessionId].calls++; bySession[r.sessionId].tokens += r.totalTokens
      const day = r.timestamp.slice(0, 10)
      if (!byDay[day]) byDay[day] = { costUSD: 0, calls: 0, tokens: 0 }
      byDay[day].costUSD += r.costUSD; byDay[day].calls++; byDay[day].tokens += r.totalTokens
      if (day === todayStr) { todayCost += r.costUSD; todayTokens += r.totalTokens }
      if (r.timestamp.slice(0, 7) === monthStr) { monthCost += r.costUSD; monthTokens += r.totalTokens }
    }
    return {
      totalCostUSD: this.totalCostUSD, totalPromptTokens: this.totalPromptTokens, totalCompTokens: this.totalCompTokens,
      totalTokens: this.totalTokens, callCount: this.callCount,
      todayCostUSD: todayCost, todayTokens, monthCostUSD: monthCost, monthTokens, byModel, bySession, byDay,
    }
  }

  getRecords(limit?: number): CostRecord[] {
    const records = [...this.records].reverse()
    return limit ? records.slice(0, limit) : records
  }

  reset(): void {
    this.records = []; this.totalCostUSD = 0; this.totalPromptTokens = 0
    this.totalCompTokens = 0; this.totalTokens = 0; this.callCount = 0; this.lastTokens = 0
    this.persistInternal()
  }

  private persistInternal(): void {
    if (this.records.length > 5000) { this.records = this.records.slice(-5000) }
    this.store.set('records', this.records)
    this.store.set('totals', { totalCostUSD: this.totalCostUSD, totalPromptTokens: this.totalPromptTokens, totalCompTokens: this.totalCompTokens, totalTokens: this.totalTokens, callCount: this.callCount })
  }

  stop(): void { /* no-op */ }
}
