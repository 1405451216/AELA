import type { OrchestrationMode } from './orchestration'
import type { OrchestrationStepResult } from './orchestration'

export interface OrchestrationTemplate {
  id: string
  name: string
  description: string
  mode: OrchestrationMode
  category: 'development' | 'research' | 'writing' | 'review' | 'custom'
  agents: Array<{
    name: string
    systemPrompt: string
    role: string
  }>
  inputPlaceholder: string
  maxRounds?: number
  maxConcurrent?: number
}

export interface OrchestrationRunRecord {
  id: string
  configId: string
  configName: string
  mode: OrchestrationMode
  startedAt: string
  finishedAt: string
  duration: number
  success: boolean
  agentCount: number
  results: OrchestrationStepResult[]
  error?: string
}

export interface OrchestrationPerformanceReport {
  totalRuns: number
  successRate: number
  avgDuration: number
  avgAgentCount: number
  byMode: Record<OrchestrationMode, { runs: number; avgDuration: number; successRate: number }>
  slowestAgents: Array<{ agentName: string; avgDuration: number; runs: number }>
  errorPatterns: Array<{ error: string; count: number }>
}
