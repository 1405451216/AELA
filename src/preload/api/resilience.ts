// Resilience 与编排扩展 API（resilience, orchestrationExt）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  ResilienceConfig,
  ResilienceStats,
  OrchestrationTemplate,
  OrchestrationRunRecord,
  OrchestrationPerformanceReport,
} from '@shared/types'

export const resilienceApi = {
  getConfig: (): Promise<ResilienceConfig> => invoke(IPC_CHANNELS.RESILIENCE_GET_CONFIG),
  setConfig: (partial: Partial<ResilienceConfig>): Promise<ResilienceConfig> => invoke(IPC_CHANNELS.RESILIENCE_SET_CONFIG, partial),
  getStats: (): Promise<ResilienceStats> => invoke(IPC_CHANNELS.RESILIENCE_GET_STATS),
  resetBreaker: (modelId: string): Promise<boolean> => invoke(IPC_CHANNELS.RESILIENCE_RESET_BREAKER, modelId),
}

export const orchestrationExtApi = {
  templatesList: (): Promise<OrchestrationTemplate[]> => invoke(IPC_CHANNELS.ORCHESTRATION_TEMPLATES_LIST),
  templatesGet: (id: string): Promise<OrchestrationTemplate | undefined> => invoke(IPC_CHANNELS.ORCHESTRATION_TEMPLATES_GET, id),
  runsList: (limit?: number): Promise<OrchestrationRunRecord[]> => invoke(IPC_CHANNELS.ORCHESTRATION_RUNS_LIST, limit),
  runsGet: (id: string): Promise<OrchestrationRunRecord | undefined> => invoke(IPC_CHANNELS.ORCHESTRATION_RUNS_GET, id),
  performance: (): Promise<OrchestrationPerformanceReport> => invoke(IPC_CHANNELS.ORCHESTRATION_PERFORMANCE),
}
