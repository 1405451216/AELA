// Debugger 服务 — 可视化调试器 + HTTP Inspector
// 移植自 AP Go 核心层 debugger/inspector.go + debugger/http.go
// 提供: Trace Span 管理 / 会话追踪 / HTTP Inspector 服务器

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import type { TraceSpan, SessionTrace } from '@shared/types'
import { randomUUID } from 'crypto'

export class DebuggerService {
  private traces: TraceSpan[] = []
  private sessions: Map<string, SessionTrace> = new Map()
  private maxSpans = 10000
  private inspectorServer: Server | null = null
  private inspectorPort = 0
  private debugEvents: Array<{ type: string; message: string; timestamp: string }> = []
  // 简单 token 认证：启动时生成随机 token，请求需携带 ?token=xxx 或 Authorization 头
  private inspectorToken: string = randomUUID()

  // ===== Span 管理 =====

  startSpan(params: {
    name: string
    kind: 'agent' | 'llm' | 'tool' | 'memory'
    sessionId: string
    parentId?: string
    traceId?: string
    attributes?: Record<string, unknown>
  }): TraceSpan {
    const span: TraceSpan = {
      id: randomUUID(),
      parentId: params.parentId,
      traceId: params.traceId ?? randomUUID(),
      sessionId: params.sessionId,
      name: params.name,
      kind: params.kind,
      status: 'started',
      startTime: new Date().toISOString(),
      attributes: params.attributes,
    }

    this.traces.push(span)
    if (this.traces.length > this.maxSpans) {
      this.traces = this.traces.slice(-this.maxSpans)
    }

    let session = this.sessions.get(params.sessionId)
    if (!session) {
      session = {
        sessionId: params.sessionId,
        agentName: params.name,
        startTime: span.startTime,
        spans: [],
        totalTurns: 0,
        totalCost: 0,
      }
      this.sessions.set(params.sessionId, session)
    }
    session.spans.push(span)

    this.addDebugEvent('span_start', `${params.kind}:${params.name}`)
    return span
  }

  endSpan(span: TraceSpan, opts?: {
    status?: 'completed' | 'failed'
    error?: string
    attributes?: Record<string, unknown>
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }): void {
    span.endTime = new Date().toISOString()
    span.duration = new Date(span.endTime).getTime() - new Date(span.startTime).getTime()
    span.status = opts?.status ?? 'completed'
    if (opts?.error) span.error = opts.error
    if (opts?.attributes) span.attributes = { ...span.attributes, ...opts.attributes }
    if (opts?.promptTokens !== undefined) span.promptTokens = opts.promptTokens
    if (opts?.completionTokens !== undefined) span.completionTokens = opts.completionTokens
    if (opts?.totalTokens !== undefined) span.totalTokens = opts.totalTokens
    this.addDebugEvent('span_end', `${span.kind}:${span.name} (${span.status})`)
  }

  addSpanEvent(span: TraceSpan, name: string, attributes?: Record<string, unknown>): void {
    if (!span.events) span.events = []
    span.events.push({ name, timestamp: new Date().toISOString(), attributes })
  }

  getTraces(): TraceSpan[] {
    return [...this.traces]
  }

  getSessionTrace(sessionId: string): SessionTrace | null {
    return this.sessions.get(sessionId) ?? null
  }

  getAllSessions(): SessionTrace[] {
    return Array.from(this.sessions.values())
  }

  clear(): void {
    this.traces = []
    this.sessions.clear()
    this.debugEvents = []
  }

  // ===== 调试事件 =====

  addDebugEvent(type: string, message: string): void {
    this.debugEvents.push({ type, message, timestamp: new Date().toISOString() })
    if (this.debugEvents.length > 1000) {
      this.debugEvents = this.debugEvents.slice(-500)
    }
  }

  getDebugEvents(): Array<{ type: string; message: string; timestamp: string }> {
    return [...this.debugEvents]
  }

  // ===== HTTP Inspector =====

  startInspector(port: number = 19876): number {
    if (this.inspectorServer) return this.inspectorPort
    this.inspectorServer = createServer((req, res) => this.handleInspectorRequest(req, res))
    // 绑定 localhost，防止外部网络访问
    this.inspectorServer.listen(port, '127.0.0.1', () => {
      this.inspectorPort = port
      this.addDebugEvent('inspector', `Inspector started on 127.0.0.1:${port}`)
    })
    return port
  }

  /** 获取 Inspector 认证 token（供内部渲染进程使用）*/
  getInspectorToken(): string {
    return this.inspectorToken
  }

  stopInspector(): void {
    if (this.inspectorServer) {
      this.inspectorServer.close()
      this.inspectorServer = null
      this.inspectorPort = 0
      this.addDebugEvent('inspector', 'Inspector stopped')
    }
  }

  isInspectorRunning(): boolean {
    return this.inspectorServer !== null
  }

  getInspectorPort(): number {
    return this.inspectorPort
  }

  private handleInspectorRequest(req: IncomingMessage, res: ServerResponse): void {
    // 简单 token 认证：防止未授权访问会话数据
    const urlObj = new URL(req.url ?? '/', `http://localhost`)
    const token = urlObj.searchParams.get('token') || req.headers['authorization']?.replace('Bearer ', '')
    if (token !== this.inspectorToken) {
      res.writeHead(401)
      res.end('{"error":"unauthorized"}')
      return
    }

    const url = urlObj.pathname
    if (url === '/api/traces') { this.sendJSON(res, this.traces); return }
    if (url === '/api/sessions') { this.sendJSON(res, Array.from(this.sessions.values())); return }
    if (url.startsWith('/api/session/')) {
      const sid = url.replace('/api/session/', '')
      const s = this.sessions.get(sid)
      if (s) { this.sendJSON(res, s) } else { res.writeHead(404); res.end('{"error":"not found"}') }
      return
    }
    if (url === '/api/events') { this.sendJSON(res, this.debugEvents); return }
    if (url === '/api/stats') {
      this.sendJSON(res, {
        totalSpans: this.traces.length,
        totalSessions: this.sessions.size,
        events: this.debugEvents.length,
      })
      return
    }
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(this.inspectorHTML())
      return
    }
    res.writeHead(404); res.end('{"error":"not found"}')
  }

  private sendJSON(res: ServerResponse, data: unknown): void {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
  }

  /** 生命周期停止方法，停止 Inspector 并清理资源 */
  stop(): void {
    this.stopInspector()
    this.traces.length = 0
    this.sessions.clear()
    this.debugEvents.length = 0
  }

  private inspectorHTML(): string {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>AELA Debugger</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9;padding:20px}.header{background:linear-gradient(135deg,#667eea,#764ba2);padding:20px;border-radius:12px;margin-bottom:20px}.header h1{font-size:24px;color:#fff}.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:16px}.card h2{font-size:16px;margin-bottom:12px;color:#58a6ff}table{width:100%;border-collapse:collapse}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #21262d;font-size:13px}th{color:#8b949e;font-weight:600}.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}.badge-agent{background:#1f6feb;color:#fff}.badge-llm{background:#238636;color:#fff}.badge-tool{background:#d29922;color:#000}.badge-memory{background:#8957e5;color:#fff}.badge-started{background:#1f6feb33;color:#58a6ff}.badge-completed{background:#23863633;color:#3fb950}.badge-failed{background:#da363333;color:#f85149}#refresh{background:#238636;color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:13px}</style></head><body><div class="header"><h1>AELA Agent Debugger</h1><p style="color:#c9d1d9aa;margin-top:4px">Trace Inspector &amp; Visual Debugger</p></div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="color:#58a6ff">Spans</h2><button id="refresh" onclick="load()">Refresh</button></div><div class="card"><table><thead><tr><th>Name</th><th>Kind</th><th>Status</th><th>Session</th><th>Duration</th><th>Start</th></tr></thead><tbody id="spans"></tbody></table></div><div class="card"><h2>Events</h2><table><thead><tr><th>Timestamp</th><th>Type</th><th>Message</th></tr></thead><tbody id="events"></tbody></table></div><script>async function load(){try{const tr=await fetch('/api/traces').then(r=>r.json());document.getElementById('spans').innerHTML=tr.slice(-200).reverse().map(s=>'<tr><td>'+s.name+'</td><td><span class="badge badge-'+s.kind+'">'+s.kind+'</span></td><td><span class="badge badge-'+s.status+'">'+s.status+'</span></td><td>'+s.sessionId.slice(0,8)+'</td><td>'+(s.duration?(s.duration+'ms'):'-')+'</td><td>'+new Date(s.startTime).toLocaleTimeString()+'</td></tr>').join('');const ev=await fetch('/api/events').then(r=>r.json());document.getElementById('events').innerHTML=ev.slice(-100).reverse().map(e=>'<tr><td>'+new Date(e.timestamp).toLocaleTimeString()+'</td><td>'+e.type+'</td><td>'+e.message+'</td></tr>').join('')}catch(e){console.error(e)}}load();setInterval(load,3000)</script></body></html>`
  }
}
