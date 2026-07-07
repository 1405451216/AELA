// 审计日志 API
import { invoke, IPC_CHANNELS } from './_shared'
import type { AuditEvent, AuditQueryFilter, AuditConfig, ComplianceReport } from '@shared/types'

export const auditApi = {
  log: (event: Omit<AuditEvent, 'timestamp'> & { timestamp?: string }): Promise<boolean> => invoke(IPC_CHANNELS.AUDIT_LOG, event),
  query: (filter: AuditQueryFilter): Promise<AuditEvent[]> => invoke(IPC_CHANNELS.AUDIT_QUERY, filter),
  report: (start: string, end: string): Promise<ComplianceReport> => invoke(IPC_CHANNELS.AUDIT_REPORT, start, end),
  getConfig: (): Promise<AuditConfig> => invoke(IPC_CHANNELS.AUDIT_GET_CONFIG),
  setConfig: (config: Partial<AuditConfig>): Promise<boolean> => invoke(IPC_CHANNELS.AUDIT_SET_CONFIG, config),
  clear: (): Promise<boolean> => invoke(IPC_CHANNELS.AUDIT_CLEAR),
  count: (): Promise<number> => invoke(IPC_CHANNELS.AUDIT_COUNT),
}
