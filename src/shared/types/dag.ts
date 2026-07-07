export interface DAGStep {
  id: string
  name: string
  modelConfigId: string
  systemPrompt: string
  input?: string
  maxTurns?: number
  retryCount?: number
  timeoutMs?: number
  condition?: string
}

export interface DAGEdge {
  from: string
  to: string
}

export interface DAGConfig {
  id: string
  name: string
  steps: DAGStep[]
  edges: DAGEdge[]
  input: string
  maxConcurrency?: number
  failFast?: boolean
}

export type CollaborationMode = 'debate' | 'review' | 'consensus' | 'brainstorm'

export interface CollaborationConfig {
  id: string
  name: string
  mode: CollaborationMode
  agents: import('./orchestration').OrchestrationAgentConfig[]
  topic: string
  maxRounds: number
  votingThreshold?: number
  enableCritique?: boolean
}

export interface CollaborationResult {
  configId: string
  mode: CollaborationMode
  arguments: Array<{
    agentName: string
    round: number
    type: 'initial' | 'response'
    content: string
  }>
  consensus?: string
  duration: number
  success: boolean
}
