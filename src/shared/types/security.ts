export type AccessLevel = 'none' | 'read' | 'write' | 'execute' | 'all'

export interface ACLRule {
  agentId: string
  resource: string
  level: AccessLevel
  denied: boolean
}

export interface SandboxConfig {
  aclRules: ACLRule[]
  allowedCommands: string[]
  blockedCommands: string[]
}

export type GuardrailAction = 'pass' | 'reject' | 'sanitize' | 'flag'
export type GuardrailSeverity = 'low' | 'medium' | 'high' | 'critical'
export type GuardrailCheckPoint = 'input' | 'output' | 'both'

export interface GuardrailResult {
  ruleName: string
  action: GuardrailAction
  severity: GuardrailSeverity
  message: string
  sanitized?: string
}

export interface GuardrailReport {
  passed: boolean
  results: GuardrailResult[]
  action: GuardrailAction
}

export interface GuardrailRuleConfig {
  id: string
  name: string
  type: 'injection' | 'pii' | 'topic' | 'keyword'
  enabled: boolean
  checkPoint: GuardrailCheckPoint
  config: Record<string, unknown>
}
