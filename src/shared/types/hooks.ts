export type HookEventPoint =
  | 'before_run'
  | 'after_run'
  | 'before_turn'
  | 'after_turn'
  | 'before_llm'
  | 'after_llm'
  | 'before_tool'
  | 'after_tool'
  | 'on_error'
  | 'on_complete'

export type HookActionType = 'shell' | 'block' | 'modify_input' | 'notify'

export interface HookAction {
  type: HookActionType
  command?: string
  message?: string
  modifyInput?: string
}

export interface HookRule {
  id: string
  name: string
  description: string
  enabled: boolean
  eventPoint: HookEventPoint
  condition: string
  actions: HookAction[]
  createdAt: string
  updatedAt: string
}

export interface HookExecutionContext {
  eventPoint: HookEventPoint
  agentId: string
  sessionId: string
  turn: number
  toolCall?: { name: string; arguments: string }
  toolResult?: { content: string; isError: boolean }
  response?: { content: string; usage?: unknown }
  error?: { message: string }
}

export interface HookExecutionResult {
  ruleId: string
  ruleName: string
  executed: boolean
  blocked: boolean
  modifiedInput?: string
  output: string
  error?: string
  durationMs: number
}

export interface HookConfigSummary {
  totalRules: number
  enabledRules: number
  rulesByEvent: Record<HookEventPoint, number>
  recentExecutions: HookExecutionResult[]
}
