export interface AuditEvent {
  timestamp: string
  actor: string
  action: string
  resource: string
  details?: Record<string, unknown>
  result: string
}

export interface AuditQueryFilter {
  actor?: string
  action?: string
  resource?: string
  start?: string
  end?: string
  limit?: number
}

export interface AuditConfig {
  enabled: boolean
  logToFile: boolean
  filePath: string
  maxEvents: number
}

export interface ComplianceReport {
  period: { start: string; end: string }
  totalEvents: number
  actorStats: Record<string, { totalActions: number; actions: Record<string, number> }>
  actionStats: Record<string, number>
}
