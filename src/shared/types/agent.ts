export interface CustomAgentConfig {
  id: string
  name: string
  description: string
  systemPrompt: string
  modelConfigId: string
  tools: string[]
  maxTurns: number
  temperature: number
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type RouteStrategy = 'cost' | 'latency' | 'quality' | 'balanced'

export interface RouteRule {
  id: string
  taskType: string
  modelConfigId: string
  strategy: RouteStrategy
  priority: number
  enabled: boolean
}

export interface RouteSuggestion {
  modelConfigId: string
  modelName: string
  reason: string
  strategy: RouteStrategy
  estimatedCost: number
}

export interface ModelRouteConfig {
  rules: RouteRule[]
  defaultModelConfigId: string
  strategy: RouteStrategy
}

export interface ReviewIssue {
  id: string
  filePath: string
  lineStart: number
  lineEnd: number
  severity: 'info' | 'warning' | 'error' | 'critical'
  category: string
  message: string
  suggestion?: string
  rule?: string
}

export interface CodeReviewResult {
  id: string
  files: string[]
  issues: ReviewIssue[]
  summary: string
  score: number
  reviewedAt: string
  approved: boolean
}
