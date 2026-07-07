import type { MessageMetrics } from './session'

export type OrchestrationMode = 'pipeline' | 'parallel' | 'handoff' | 'pool' | 'groupchat' | 'debate' | 'supervisor' | 'streaming_pipeline'

export interface OrchestrationAgentConfig {
  id: string
  name: string
  modelConfigId: string
  systemPrompt: string
  input?: string
  maxTurns?: number
  role?: string
}

export interface OrchestrationConfig {
  id: string
  name: string
  mode: OrchestrationMode
  agents: OrchestrationAgentConfig[]
  input: string
  maxConcurrent?: number
  maxRounds?: number
}

export interface OrchestrationStepResult {
  agentName: string
  content: string
  metrics?: MessageMetrics
  skipped: boolean
  error?: string
}

export interface OrchestrationResult {
  configId: string
  mode: OrchestrationMode
  results: OrchestrationStepResult[]
  duration: number
  success: boolean
  error?: string
}

export type OrchestrationEvent =
  | { type: 'step_start'; agentName: string; stepIndex: number }
  | { type: 'step_token'; agentName: string; content: string }
  | { type: 'step_done'; agentName: string; stepIndex: number; result: OrchestrationStepResult }
  | { type: 'all_done'; result: OrchestrationResult }
  | { type: 'error'; error: string | Error }
