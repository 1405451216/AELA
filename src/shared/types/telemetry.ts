export interface TraceSpan {
  id: string
  parentId?: string
  traceId: string
  sessionId: string
  name: string
  kind: 'agent' | 'llm' | 'tool' | 'memory'
  status: 'started' | 'completed' | 'failed'
  startTime: string
  endTime?: string
  duration?: number
  attributes?: Record<string, unknown>
  events?: Array<{ name: string; timestamp: string; attributes?: Record<string, unknown> }>
  error?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface SessionTrace {
  sessionId: string
  agentName: string
  startTime: string
  endTime?: string
  spans: TraceSpan[]
  totalTurns: number
  totalCost: number
}

export interface TelemetryConfig {
  serviceName: string
  serviceVersion: string
  otlpEndpoint: string
  exportIntervalMs: number
  enableTraces: boolean
  enableMetrics: boolean
}

export interface TelemetrySpanInfo {
  name: string
  traceId: string
  spanId: string
  parentSpanId?: string
  startTime: string
  duration?: number
  ended: boolean
  attributes: Record<string, unknown>
  errors: string[]
  events: Array<{ name: string; timestamp: string; attributes?: Record<string, unknown> }>
}

export interface TelemetryExportResult {
  tracesExported: number
  metricsExported: number
  error?: string
}
