export interface HITLConfig {
  enabled: boolean
  interruptPoints: HITLInterruptPoint[]
  autoApproveTools: string[]
  timeoutMs?: number
}

export interface HITLInterruptPoint {
  type: 'tool_confirm' | 'decision_point' | 'budget_exceed' | 'custom'
  toolName: string
  message: string
}

export interface HITLInterruptRequest {
  reason: 'tool_confirm' | 'decision_point' | 'budget_exceed' | 'custom'
  message: string
  data?: Record<string, unknown>
  turn: number
  timestamp: string
  id?: string
}

export interface HITLResponse {
  approved: boolean
  input?: string
  modified?: Record<string, unknown>
  feedback?: string
  requestId?: string
  timestamp?: string
}

export type SecurityPresetLevel = 'strict' | 'standard' | 'relaxed'

export interface SecurityPreset {
  level: SecurityPresetLevel
  name: string
  description: string
  config: import('./security').SandboxConfig
  guardrailRules: import('./security').GuardrailRuleConfig[]
  hitlInterruptPoints: HITLInterruptPoint[]
}
