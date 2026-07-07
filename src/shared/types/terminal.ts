export interface TerminalTabInfo {
  id: string
  title: string
  shell: string
  cwd: string
  createdAt: string
  isActive: boolean
  agentLinked: boolean
}

export interface TerminalCommandHistoryEntry {
  id: string
  terminalId: string
  command: string
  exitCode: number | null
  timestamp: string
  duration: number
}

export interface AdaptiveLearningProfile {
  agentId: string
  agentName: string
  totalInteractions: number
  successfulInteractions: number
  failedInteractions: number
  learnedRules: AdaptiveRule[]
  strengths: string[]
  weakAreas: string[]
  avgConfidence: number
  learningProgress: number
  lastUpdated: string
}

export interface AdaptiveRule {
  id: string
  pattern: string
  description: string
  confidence: number
  occurrences: number
  successRate: number
  category: 'tool_usage' | 'prompt_pattern' | 'error_avoidance' | 'task_strategy'
  createdAt: string
  lastTriggered: string
}

export interface AdaptiveHint {
  ruleIds: string[]
  hint: string
  priority: 'low' | 'medium' | 'high'
  category: string
}

export interface LearningProgress {
  totalRules: number
  avgConfidence: number
  progressPercent: number
  recentImprovements: Array<{
    timestamp: string
    description: string
    metric: string
    before: number
    after: number
  }>
  categoryStats: Record<string, { rules: number; avgSuccessRate: number }>
}

export interface ResilienceConfig {
  maxRetries: number
  retryBackoffMs: number
  maxBackoffMs: number
  circuitThreshold: number
  circuitRecoverMs: number
  retryOnErrors: string[]
  fallbackModelId: string | null
}

export interface CircuitBreakerState {
  modelId: string
  modelName: string
  state: 'closed' | 'open' | 'half_open'
  failureCount: number
  lastFailureTime: string | null
  lastFailureError: string | null
  totalRequests: number
  totalFailures: number
  totalRetries: number
  totalFallbacks: number
}

export interface ResilienceStats {
  config: ResilienceConfig
  circuitBreakers: CircuitBreakerState[]
  totalRequests: number
  totalRetries: number
  totalFallbacks: number
  avgRetryRate: number
}

export interface AnomalyAlert {
  id: string
  type: 'high_error_rate' | 'high_latency' | 'cost_spike' | 'budget_warning' | 'tool_failure_burst'
  severity: 'info' | 'warning' | 'critical'
  message: string
  metric: string
  threshold: number
  actual: number
  timestamp: string
  acknowledged: boolean
}
