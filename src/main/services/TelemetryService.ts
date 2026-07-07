// OpenTelemetry 遥测服务
// 移植自 AP Go 核心层 otel/provider.go + otel/bridge.go
// 提供: Span 管理 / W3C Trace Context / OTLP 导出 / 指标导出

import type {
  TelemetryConfig,
  TelemetrySpanInfo,
  TelemetryExportResult,
  MetricsSnapshot,
} from '@shared/types'
import { randomBytes } from 'crypto'

// ===== OTel Span =====

interface OTelSpan {
  name: string
  traceId: string
  spanId: string
  parentSpanId?: string
  startTime: Date
  duration?: number
  ended: boolean
  attributes: Record<string, unknown>
  errors: string[]
  events: Array<{ name: string; timestamp: Date; attributes?: Record<string, unknown> }>
}

// ===== OTel Bridge =====

class OTelBridge {
  private spans: OTelSpan[] = []
  private maxSpans = 10000

  startSpan(name: string, parent?: OTelSpan): OTelSpan {
    const traceId = parent?.traceId ?? this.generateHexId(16)
    const span: OTelSpan = {
      name,
      traceId,
      spanId: this.generateHexId(8),
      parentSpanId: parent?.spanId,
      startTime: new Date(),
      ended: false,
      attributes: {},
      errors: [],
      events: [],
    }
    this.spans.push(span)
    if (this.spans.length > this.maxSpans) {
      this.spans = this.spans.slice(-this.maxSpans)
    }
    return span
  }

  endSpan(span: OTelSpan): void {
    if (!span.ended) {
      span.duration = Date.now() - span.startTime.getTime()
      span.ended = true
    }
  }

  setAttribute(span: OTelSpan, key: string, value: unknown): void {
    span.attributes[key] = value
  }

  recordError(span: OTelSpan, err: Error): void {
    span.errors.push(err.message)
  }

  setStatus(span: OTelSpan, code: string, description?: string): void {
    span.attributes['otel.status_code'] = code
    if (description) span.attributes['otel.status_description'] = description
  }

  addEvent(span: OTelSpan, name: string, attrs?: Record<string, unknown>): void {
    span.events.push({ name, timestamp: new Date(), attributes: attrs })
  }

  spanContext(span: OTelSpan): Record<string, string> {
    const ctx: Record<string, string> = {
      trace_id: span.traceId,
      span_id: span.spanId,
    }
    if (span.parentSpanId) ctx['parent_span_id'] = span.parentSpanId
    return ctx
  }

  w3cTraceParent(span: OTelSpan): string {
    const flags = span.ended ? '01' : '00'
    return `00-${span.traceId}-${span.spanId}-${flags}`
  }

  flushSpans(): OTelSpan[] {
    const spans = this.spans
    this.spans = []
    return spans
  }

  getSpans(): OTelSpan[] {
    return this.spans
  }

  spanCount(): number {
    return this.spans.length
  }

  clear(): void {
    this.spans = []
  }

  shutdown(): void {
    this.spans = []
  }

  private generateHexId(bytes: number): string {
    return randomBytes(bytes).toString('hex')
  }
}

// ===== OTLP Exporter (HTTP/JSON) =====
// 通过 HTTP POST 发送 OTLP JSON 格式的 trace/metric 数据到 OTLP Collector

class OTLPExporter {
  private endpoint: string
  private headers: Record<string, string>
  private totalExported = 0
  private lastError: string | null = null

  constructor(config: { endpoint: string; headers?: Record<string, string> }) {
    this.endpoint = config.endpoint
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    }
  }

  async exportTraces(spans: OTelSpan[]): Promise<number> {
    if (spans.length === 0) return 0

    // 构建 OTLP JSON 格式的 trace 导出 payload
    const payload = {
      resourceSpans: [{
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'aela' } }],
        },
        scopeSpans: [{
          scope: { name: 'aela.agent' },
          spans: spans.map(s => ({
            traceId: s.traceId,
            spanId: s.spanId,
            parentSpanId: s.parentSpanId,
            name: s.name,
            kind: 'SPAN_KIND_INTERNAL',
            startTimeUnixNano: String(s.startTime.getTime() * 1_000_000),
            endTimeUnixNano: String((s.startTime.getTime() + (s.duration ?? 0)) * 1_000_000),
            attributes: Object.entries(s.attributes).map(([k, v]) => ({
              key: k,
              value: typeof v === 'string' ? { stringValue: v } : typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) },
            })),
            status: s.errors.length > 0
              ? { code: 'STATUS_CODE_ERROR', message: s.errors.join('; ') }
              : { code: 'STATUS_CODE_OK' },
          })),
        }],
      }],
    }

    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) {
        this.lastError = `OTLP export failed: HTTP ${resp.status} ${resp.statusText}`
        return 0
      }
      const count = spans.length
      this.totalExported += count
      this.lastError = null
      return count
    } catch (err: unknown) {
      this.lastError = `OTLP export error: ${err instanceof Error ? err.message : String(err)}`
      return 0
    }
  }

  async exportMetrics(snapshot: MetricsSnapshot): Promise<number> {
    const payload = {
      resourceMetrics: [{
        resource: {
          attributes: [{ key: 'service.name', value: { stringValue: 'aela' } }],
        },
        scopeMetrics: [{
          scope: { name: 'aela.metrics' },
          metrics: [
            { name: 'llm.calls.total', gauge: { dataPoints: [{ asInt: snapshot.llmTotalCalls }] } },
            { name: 'llm.errors.total', gauge: { dataPoints: [{ asInt: snapshot.llmTotalErrors }] } },
            { name: 'tool.calls.total', gauge: { dataPoints: [{ asInt: snapshot.toolTotalCalls }] } },
            { name: 'tool.errors.total', gauge: { dataPoints: [{ asInt: snapshot.toolTotalErrors }] } },
            { name: 'turns.total', gauge: { dataPoints: [{ asInt: snapshot.totalTurns }] } },
            { name: 'agents.active', gauge: { dataPoints: [{ asInt: snapshot.activeAgents }] } },
            { name: 'llm.latency.avg_ms', gauge: { dataPoints: [{ asDouble: snapshot.avgLLMLatencyMs }] } },
            { name: 'tool.latency.avg_ms', gauge: { dataPoints: [{ asDouble: snapshot.avgToolLatencyMs }] } },
          ],
        }],
      }],
    }

    try {
      const resp = await fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      })
      if (!resp.ok) {
        this.lastError = `OTLP metrics export failed: HTTP ${resp.status}`
        return 0
      }
      this.totalExported++
      this.lastError = null
      return 1
    } catch (err: unknown) {
      this.lastError = `OTLP metrics export error: ${err instanceof Error ? err.message : String(err)}`
      return 0
    }
  }

  close(): void {
    // HTTP exporter 无需清理资源
  }

  getTotalExported(): number {
    return this.totalExported
  }

  getLastError(): string | null {
    return this.lastError
  }
}

// ===== Telemetry 服务 =====

export class TelemetryService {
  private config: TelemetryConfig | null = null
  private bridge: OTelBridge = new OTelBridge()
  private exporter: OTLPExporter | null = null
  private exportTimer: NodeJS.Timeout | null = null
  private activeSpans: Map<string, OTelSpan> = new Map()

  /**
   * 配置遥测
   */
  configure(config: TelemetryConfig): void {
    this.config = config

    if (config.otlpEndpoint && (config.enableTraces || config.enableMetrics)) {
      this.exporter = new OTLPExporter({
        endpoint: config.otlpEndpoint,
      })

      if (config.exportIntervalMs > 0) {
        this.startExportLoop(config.exportIntervalMs)
      }
    }
  }

  /**
   * 启动 Span
   */
  startSpan(name: string, parentSpanId?: string): string {
    const parent = parentSpanId ? this.activeSpans.get(parentSpanId) : undefined
    const span = this.bridge.startSpan(name, parent)
    this.activeSpans.set(span.spanId, span)
    return span.spanId
  }

  /**
   * 结束 Span
   */
  endSpan(spanId: string): void {
    const span = this.activeSpans.get(spanId)
    if (span) {
      this.bridge.endSpan(span)
      this.activeSpans.delete(spanId)
    }
  }

  /**
   * 设置 Span 属性
   */
  setAttribute(spanId: string, key: string, value: unknown): void {
    const span = this.activeSpans.get(spanId)
    if (span) this.bridge.setAttribute(span, key, value)
  }

  /**
   * 记录 Span 错误
   */
  recordError(spanId: string, err: Error): void {
    const span = this.activeSpans.get(spanId)
    if (span) this.bridge.recordError(span, err)
  }

  /**
   * 添加 Span 事件
   */
  addEvent(spanId: string, name: string, attrs?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId)
    if (span) this.bridge.addEvent(span, name, attrs)
  }

  /**
   * 获取所有 Span 信息
   */
  getSpans(): TelemetrySpanInfo[] {
    return this.bridge.getSpans().map(s => ({
      name: s.name,
      traceId: s.traceId,
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      startTime: s.startTime.toISOString(),
      duration: s.duration,
      ended: s.ended,
      attributes: { ...s.attributes },
      errors: [...s.errors],
      events: s.events.map(e => ({
        name: e.name,
        timestamp: e.timestamp.toISOString(),
        attributes: e.attributes,
      })),
    }))
  }

  /**
   * 立即导出
   */
  async exportNow(metricsSnapshot?: MetricsSnapshot): Promise<TelemetryExportResult> {
    if (!this.exporter) {
      return { tracesExported: 0, metricsExported: 0, error: 'No OTLP exporter configured' }
    }

    let tracesExported = 0
    let metricsExported = 0

    if (this.config?.enableTraces) {
      const spans = this.bridge.flushSpans()
      tracesExported = await this.exporter.exportTraces(spans)
    }

    if (this.config?.enableMetrics && metricsSnapshot) {
      metricsExported = await this.exporter.exportMetrics(metricsSnapshot)
    }

    const lastError = this.exporter.getLastError()
    return { tracesExported, metricsExported, error: lastError ?? undefined }
  }

  /**
   * 获取遥测状态
   */
  getStatus(): {
    configured: boolean
    enableTraces: boolean
    enableMetrics: boolean
    otlpEndpoint: string
    activeSpans: number
    totalSpans: number
    totalExported: number
  } {
    return {
      configured: this.config !== null,
      enableTraces: this.config?.enableTraces ?? false,
      enableMetrics: this.config?.enableMetrics ?? false,
      otlpEndpoint: this.config?.otlpEndpoint ?? '',
      activeSpans: this.activeSpans.size,
      totalSpans: this.bridge.spanCount(),
      totalExported: this.exporter?.getTotalExported() ?? 0,
    }
  }

  /**
   * 获取当前配置（未配置时返回默认值）
   */
  getConfig(): TelemetryConfig {
    return this.config ?? {
      serviceName: 'aela',
      serviceVersion: '1.0.0',
      otlpEndpoint: '',
      exportIntervalMs: 5000,
      enableTraces: false,
      enableMetrics: false,
    }
  }

  /**
   * 清除所有 Span
   */
  clear(): void {
    this.bridge.clear()
    this.activeSpans.clear()
  }

  /** 生命周期停止方法，别名调用 shutdown() */
  stop(): void {
    this.shutdown()
  }

  /**
   * 关闭
   */
  shutdown(): void {
    if (this.exportTimer) {
      clearInterval(this.exportTimer)
      this.exportTimer = null
    }
    this.exporter?.close()
    this.bridge.shutdown()
    this.activeSpans.clear()
  }

  private startExportLoop(intervalMs: number): void {
    if (this.exportTimer) clearInterval(this.exportTimer)
    this.exportTimer = setInterval(async () => {
      try {
        await this.exportNow()
      } catch (err) {
        console.error('[TelemetryService] export loop failed:', err)
      }
    }, intervalMs)
  }
}
