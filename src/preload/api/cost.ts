// 成本与工具 API（cost, builtinTools, contextWindow）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  CostSummary,
  CostRecord,
  BudgetConfig,
  ModelPricing,
  BuiltinToolInfo,
  ContextWindowConfig,
} from '@shared/types'

export const costApi = {
  summary: (): Promise<CostSummary> => invoke(IPC_CHANNELS.COST_SUMMARY),
  records: (limit?: number): Promise<CostRecord[]> => invoke(IPC_CHANNELS.COST_RECORDS, limit),
  reset: (): Promise<boolean> => invoke(IPC_CHANNELS.COST_RESET),
  setBudget: (budget: BudgetConfig | null): Promise<boolean> => invoke(IPC_CHANNELS.COST_SET_BUDGET, budget),
  getBudget: (): Promise<BudgetConfig | null> => invoke(IPC_CHANNELS.COST_GET_BUDGET),
  setPricing: (model: string, pricing: ModelPricing): Promise<boolean> => invoke(IPC_CHANNELS.COST_SET_PRICING, model, pricing),
  listPricing: (): Promise<ModelPricing[]> => invoke(IPC_CHANNELS.COST_LIST_PRICING),
}

export const builtinToolsApi = {
  list: (): Promise<BuiltinToolInfo[]> => invoke(IPC_CHANNELS.BUILTIN_TOOLS_LIST),
  toggle: (name: string, enabled: boolean): Promise<boolean> => invoke(IPC_CHANNELS.BUILTIN_TOOLS_TOGGLE, name, enabled),
}

export const contextWindowApi = {
  getConfig: (): Promise<ContextWindowConfig> => invoke(IPC_CHANNELS.CONTEXT_WINDOW_GET_CONFIG),
  setConfig: (config: Partial<ContextWindowConfig>): Promise<boolean> => invoke(IPC_CHANNELS.CONTEXT_WINDOW_SET_CONFIG, config),
  trim: (messages: Array<{ role: string; content: string }>): Promise<Array<{ role: string; content: string }>> => invoke(IPC_CHANNELS.CONTEXT_WINDOW_TRIM, messages),
  compress: (messages: Array<{ role: string; content: string }>, modelConfigId: string): Promise<Array<{ role: string; content: string }>> => invoke(IPC_CHANNELS.CONTEXT_WINDOW_COMPRESS, messages, modelConfigId),
}
