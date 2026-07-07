// 可观测性 API（metrics, telemetry, debugger, observability）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  MetricsSnapshot,
  MetricsTrend,
  TelemetryConfig,
  TelemetrySpanInfo,
  TelemetryExportResult,
  TraceSpan,
  SessionTrace,
  CostAnalysisReport,
  AnomalyAlert,
} from '@shared/types'

export const metricsApi = {
  snapshot: (): Promise<MetricsSnapshot> => invoke(IPC_CHANNELS.METRICS_SNAPSHOT),
  reset: (): Promise<boolean> => invoke(IPC_CHANNELS.METRICS_RESET),
}

export const telemetryApi = {
  configure: (config: TelemetryConfig): Promise<boolean> => invoke(IPC_CHANNELS.TELEMETRY_CONFIGURE, config),
  export: (): Promise<TelemetryExportResult> => invoke(IPC_CHANNELS.TELEMETRY_EXPORT),
  spans: (): Promise<TelemetrySpanInfo[]> => invoke(IPC_CHANNELS.TELEMETRY_SPANS),
  status: (): Promise<{ configured: boolean; enableTraces: boolean; enableMetrics: boolean; otlpEndpoint: string; activeSpans: number; totalSpans: number; totalExported: number }> =>
    invoke(IPC_CHANNELS.TELEMETRY_STATUS),
  getConfig: (): Promise<TelemetryConfig> => invoke(IPC_CHANNELS.TELEMETRY_GET_CONFIG),
}

export const debuggerApi = {
  status: (): Promise<{ enabled: boolean; logEntries: number; subscriberCount: number; inspectorRunning: boolean; inspectorPort: number; totalSpans: number; totalSessions: number }> =>
    invoke(IPC_CHANNELS.DEBUGGER_STATUS),
  traces: (limit?: number): Promise<TraceSpan[]> => invoke(IPC_CHANNELS.DEBUGGER_TRACES, { limit }),
  sessionTrace: (sessionId: string): Promise<SessionTrace | null> => invoke(IPC_CHANNELS.DEBUGGER_SESSION_TRACE, sessionId),
  clear: (): Promise<boolean> => invoke(IPC_CHANNELS.DEBUGGER_CLEAR),
  startInspector: (port?: number): Promise<{ port: number; running: boolean }> => invoke(IPC_CHANNELS.DEBUGGER_INSPECTOR_START, port),
  stopInspector: (): Promise<boolean> => invoke(IPC_CHANNELS.DEBUGGER_INSPECTOR_STOP),
}

export const observabilityApi = {
  trend: (hours?: number): Promise<MetricsTrend> => invoke(IPC_CHANNELS.METRICS_TREND, hours),
  costAnalysis: (): Promise<CostAnalysisReport> => invoke(IPC_CHANNELS.COST_ANALYSIS),
  anomalyList: (includeAcknowledged?: boolean): Promise<AnomalyAlert[]> => invoke(IPC_CHANNELS.ANOMALY_LIST, includeAcknowledged),
  anomalyAcknowledge: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.ANOMALY_ACKNOWLEDGE, id),
  anomalyCheck: (): Promise<AnomalyAlert[]> => invoke(IPC_CHANNELS.ANOMALY_CHECK),
}
