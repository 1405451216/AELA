export interface ModelPricing {
  model: string
  provider: string
  promptPricePer1M: number
  completionPricePer1M: number
}

export interface BudgetConfig {
  maxTotalCostUSD?: number
  maxTokensPerCall?: number
  maxTokensPerSession?: number
}

export interface CostRecord {
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUSD: number
  timestamp: string
  sessionId: string
  agentName: string
}

export interface ModelCost {
  costUSD: number
  calls: number
  tokens: number
}

export interface CostSummary {
  totalCostUSD: number
  totalPromptTokens: number
  totalCompTokens: number
  totalTokens: number
  callCount: number
  todayCostUSD: number
  todayTokens: number
  monthCostUSD: number
  monthTokens: number
  byModel: Record<string, ModelCost>
  bySession: Record<string, ModelCost>
  byDay: Record<string, ModelCost>
}

export interface CostAnalysisReport {
  summary: CostSummary
  dailyCosts: Array<{ date: string; cost: number; calls: number }>
  topModels: Array<{ model: string; cost: number; calls: number; tokens: number }>
  projectedMonthlyCost: number
  budgetUsagePercent: number
  budgetRemaining: number
}
