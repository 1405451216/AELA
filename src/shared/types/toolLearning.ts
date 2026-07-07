export interface ToolUsageRecord {
  toolName: string
  args: string
  result?: string
  error?: string
  success: boolean
  timestamp: string
}

export interface BestPractice {
  toolName: string
  pattern: string
  description: string
  successRate: number
  examples: string[]
  createdAt: string
}

export interface ToolLearningSuggestion {
  originalArgs: string
  improvedArgs: string
  reason: string
  confidence: number
}

export interface ToolLearningVisualization {
  toolStats: Array<{
    toolName: string
    totalCalls: number
    successRate: number
    trend: Array<{ timestamp: string; success: boolean }>
  }>
  failureModes: Array<{
    toolName: string
    error: string
    count: number
    lastSeen: string
    suggestedFix: string
  }>
  bestPractices: Array<{
    toolName: string
    pattern: string
    description: string
    successRate: number
    examples: string[]
  }>
  overallSuccessRate: number
  totalToolsTracked: number
}
