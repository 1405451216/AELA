export interface MetricsSnapshot {
  llmTotalCalls: number
  llmTotalErrors: number
  toolTotalCalls: number
  toolTotalErrors: number
  totalTurns: number
  activeAgents: number
  avgLLMLatencyMs: number
  avgToolLatencyMs: number
}

export interface MetricsTrendPoint {
  timestamp: string
  llmCalls: number
  llmErrors: number
  toolCalls: number
  toolErrors: number
  turns: number
  avgLLMLatency: number
  avgToolLatency: number
}

export interface MetricsTrend {
  points: MetricsTrendPoint[]
  interval: string
  startedAt: string
  endedAt: string
}
