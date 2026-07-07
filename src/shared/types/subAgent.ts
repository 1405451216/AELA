export interface SubAgentResourceQuota {
  maxTurns: number
  maxTokens: number
  timeoutMs: number
  maxFileWrites: number
  maxShellCommands: number
  allowedTools: string[]
  workspaceSandbox?: string
}

export interface SubAgentDefinition {
  id: string
  name: string
  role: string
  systemPrompt: string
  modelConfigId: string
  input: string
  quota: SubAgentResourceQuota
}

export interface SubAgentResult {
  agentId: string
  agentName: string
  role: string
  status: 'completed' | 'failed' | 'timeout' | 'quota_exceeded'
  output: string
  error?: string
  tokensUsed: number
  turnsUsed: number
  toolCalls: number
  durationMs: number
  filesWritten: string[]
}

export interface SubAgentRunConfig {
  id: string
  agents: SubAgentDefinition[]
  aggregationMode: 'concat' | 'best' | 'merge' | 'vote'
  failFast: boolean
  maxConcurrency: number
}

export interface SubAgentRunResult {
  runId: string
  results: SubAgentResult[]
  aggregatedOutput: string
  totalDurationMs: number
  totalTokensUsed: number
  success: boolean
  aggregationMode: string
}

export interface SubAgentPreset {
  id: string
  name: string
  role: string
  systemPrompt: string
  defaultQuota: SubAgentResourceQuota
  description: string
}

export interface SubAgentRunStatus {
  runId: string
  running: boolean
  totalAgents: number
  completedAgents: number
  failedAgents: number
  agentStatuses: Array<{
    agentId: string
    agentName: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'
    tokensUsed: number
    turnsUsed: number
  }>
}
