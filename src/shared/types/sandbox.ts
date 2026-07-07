export type SandboxActionType = 'terminal_exec' | 'file_read' | 'file_write' | 'tool_call' | 'llm_complete'
export const SANDBOX_ACTION_WILDCARD = '*'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface SandboxAction {
  seq: number
  runId: string
  type: SandboxActionType
  payload: Record<string, unknown>
  result?: Record<string, unknown>
  error?: string
  duration?: number
  riskLevel: RiskLevel
  timestamp: string
}

export interface RecordingSummary {
  runId: string
  startedAt: string
  endedAt?: string
  actionCount: number
  status: 'recording' | 'paused' | 'completed'
  riskSummary: Record<RiskLevel, number>
}

export interface PermissionRecord {
  id: string
  pattern: string
  action: SandboxActionType | '*'
  scope: string
  grantedBy: 'user' | 'system'
  expiresAt: string
  createdAt: string
}

export interface ReplayFrame {
  seq: number
  type: SandboxActionType
  summary: string
  riskLevel: RiskLevel
  timestamp: string
}
