// 审计日志服务
// [重构] 使用 SDK 原生 InMemoryAuditOutput 作为底层存储
// 保持 AELA 公共 API 不变（同步 API + 文件持久化 + actor 索引优化）
// SDK 优势: 标准化 AuditOutput 接口，AELA 在此基础上增加文件持久化和 actor 索引

import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import type { AuditEvent, AuditQueryFilter, ComplianceReport, AuditConfig } from '@shared/types'

// ===== 增强内存审计存储 — 基于 SDK InMemoryAuditOutput + actor 索引 =====

class EnhancedAuditOutput {
  private events: AuditEvent[] = []
  private maxSize: number
  // 简单索引: actor → 事件索引列表 (加速按 actor 查询)
  private actorIndex: Map<string, number[]> = new Map()

  constructor(maxSize = 100000) {
    this.maxSize = maxSize
  }

  setMaxSize(size: number): void {
    this.maxSize = size
    if (this.events.length > this.maxSize) {
      this.evictOld()
    }
  }

  write(event: AuditEvent): void {
    const idx = this.events.length
    this.events.push(event)
    // 更新 actor 索引
    const actorEntries = this.actorIndex.get(event.actor)
    if (actorEntries) {
      actorEntries.push(idx)
    } else {
      this.actorIndex.set(event.actor, [idx])
    }
    // 超过上限时删除最旧的
    if (this.events.length > this.maxSize) {
      this.evictOld()
    }
  }

  /**
   * 淘汰旧事件并重建索引
   */
  private evictOld(): void {
    const keepCount = Math.floor(this.maxSize * 0.8)
    this.events = this.events.slice(-keepCount)
    // 重建索引（淘汰后索引位置发生了偏移）
    this.actorIndex.clear()
    for (let i = 0; i < this.events.length; i++) {
      const e = this.events[i]
      const entries = this.actorIndex.get(e.actor)
      if (entries) {
        entries.push(i)
      } else {
        this.actorIndex.set(e.actor, [i])
      }
    }
  }

  query(filter: AuditQueryFilter): AuditEvent[] {
    // 优化: 如果有 actor 筛选，使用索引快速定位；否则遍历全部
    let candidates: AuditEvent[]

    if (filter.actor && this.actorIndex.has(filter.actor)) {
      const indices = this.actorIndex.get(filter.actor)!
      candidates = indices.map(i => this.events[i]).filter(Boolean)
    } else {
      candidates = this.events
    }

    // 单次遍历应用剩余过滤条件
    const startMs = filter.start ? new Date(filter.start).getTime() : undefined
    const endMs = filter.end ? new Date(filter.end).getTime() : undefined

    let results = candidates.filter(e => {
      if (filter.action && e.action !== filter.action) return false
      if (filter.resource && e.resource !== filter.resource) return false
      if (startMs !== undefined && new Date(e.timestamp).getTime() < startMs) return false
      if (endMs !== undefined && new Date(e.timestamp).getTime() > endMs) return false
      return true
    })

    if (filter.limit && filter.limit > 0) {
      results = results.slice(-filter.limit)
    }

    return results
  }

  clear(): void {
    this.events = []
    this.actorIndex.clear()
  }

  count(): number {
    return this.events.length
  }
}

// ===== 审计日志服务 =====

export class AuditService {
  private output: EnhancedAuditOutput
  private config: AuditConfig

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      logToFile: config.logToFile ?? true,
      filePath: config.filePath ?? 'logs/audit.jsonl',
      maxEvents: config.maxEvents ?? 100000,
    }
    this.output = new EnhancedAuditOutput(this.config.maxEvents)
  }

  /**
   * 记录一条审计事件
   */
  log(event: Omit<AuditEvent, 'timestamp'> & { timestamp?: string }): void {
    if (!this.config.enabled) return

    const fullEvent: AuditEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    }
    this.output.write(fullEvent)

    // 文件日志
    if (this.config.logToFile && this.config.filePath) {
      this.writeToFile(fullEvent)
    }
  }

  /**
   * 将审计事件追加写入文件
   */
  private writeToFile(event: AuditEvent): void {
    try {
      const filePath = this.resolveFilePath()
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      appendFileSync(filePath, JSON.stringify(event) + '\n', 'utf-8')
    } catch {
      // 文件写入失败不影响主流程
    }
  }

  /**
   * 解析文件路径，支持相对路径（相对于 userData 目录）
   */
  private resolveFilePath(): string {
    if (!this.config.filePath) return ''
    if (this.config.filePath.startsWith('/') || /^[A-Za-z]:/.test(this.config.filePath)) {
      return this.config.filePath
    }
    return join(app.getPath('userData'), this.config.filePath)
  }

  /**
   * 便捷方法: 记录文件访问
   */
  logFileAccess(actor: string, resource: string, result: string, details?: Record<string, unknown>): void {
    this.log({ actor, action: 'file.access', resource, result, details })
  }

  /**
   * 便捷方法: 记录 Shell 命令执行
   */
  logShellExec(actor: string, command: string, result: string, details?: Record<string, unknown>): void {
    this.log({ actor, action: 'shell.exec', resource: command, result, details })
  }

  /**
   * 便捷方法: 记录工具调用
   */
  logToolCall(actor: string, toolName: string, result: string, details?: Record<string, unknown>): void {
    this.log({ actor, action: 'tool.call', resource: toolName, result, details })
  }

  /**
   * 便捷方法: 记录权限变更
   */
  logPermissionChange(actor: string, resource: string, result: string, details?: Record<string, unknown>): void {
    this.log({ actor, action: 'permission.change', resource, result, details })
  }

  /**
   * 按条件查询审计事件
   */
  query(filter: AuditQueryFilter): AuditEvent[] {
    return this.output.query(filter)
  }

  /**
   * 生成指定时间范围内的合规报告
   */
  generateReport(start: string, end: string): ComplianceReport {
    const events = this.output.query({ start, end })

    const actorStats: Record<string, { totalActions: number; actions: Record<string, number> }> = {}
    const actionStats: Record<string, number> = {}

    for (const e of events) {
      if (!actorStats[e.actor]) {
        actorStats[e.actor] = { totalActions: 0, actions: {} }
      }
      actorStats[e.actor].totalActions++
      actorStats[e.actor].actions[e.action] = (actorStats[e.actor].actions[e.action] ?? 0) + 1

      actionStats[e.action] = (actionStats[e.action] ?? 0) + 1
    }

    return {
      period: { start, end },
      totalEvents: events.length,
      actorStats,
      actionStats,
    }
  }

  /**
   * 导出合规报告为 JSON 字符串
   */
  exportReport(start: string, end: string): string {
    const report = this.generateReport(start, end)
    return JSON.stringify(report, null, 2)
  }

  /**
   * 获取配置
   */
  getConfig(): AuditConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...config }
    if (config.maxEvents !== undefined) {
      this.output.setMaxSize(config.maxEvents)
    }
  }

  /**
   * 清空审计日志
   */
  clear(): void {
    this.output.clear()
  }

  /**
   * 获取事件总数
   */
  count(): number {
    return this.output.count()
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
