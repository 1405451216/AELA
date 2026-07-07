export interface SessionSearchResult {
  session: import('./session').Session
  matchedMessages: Array<{ message: import('./session').ChatMessage; snippet: string }>
  matchCount: number
}

export interface SessionExportOptions {
  format: 'markdown' | 'json'
  includeMetrics: boolean
  includeToolCalls: boolean
  includeSystemMessages: boolean
}

export interface SessionExportResult {
  content: string
  format: string
  filename: string
  messageCount: number
}

export interface SessionContextInfo {
  sessionId: string
  totalMessages: number
  estimatedTokens: number
  contextWindowConfig: import('./contextWindow').ContextWindowConfig
  messagesByRole: Record<string, number>
  oldestMessageAge: string
  wouldTriggerCompression: boolean
}
