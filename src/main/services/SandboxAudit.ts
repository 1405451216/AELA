import { app } from 'electron'
import { join } from 'path'
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import type BetterSqlite3 from 'better-sqlite3'
import type { SandboxAction, RecordingSummary, PermissionRecord, RiskLevel } from '@shared/types/sandbox'
import { lazyRequire } from '../utils/nativeRequire'

/** action_log 查询返回的行类型 */
interface ActionLogRow {
  seq: number
  type: string
  payload: string
  result: string | null
  error: string | null
  duration: number | null
  risk_level: string
  timestamp: string
}

/** COUNT 聚合查询行 */
interface CountRow { c: number }

/** 风险统计查询行 */
interface RiskCountRow {
  risk_level: string
  c: number
}

/**
 * Sandbox Recorder — Records all agent actions for audit and replay
 */
export class SandboxRecorder {
  private db: import('better-sqlite3').Database | null = null
  private currentRunId: string | null = null
  private seqCounter = 0
  /** 预编译语句缓存 */
  private stmts: {
    insertAction?: import('better-sqlite3').Statement
    insertReplay?: import('better-sqlite3').Statement
  } = {}

  private getRecordingsDir(): string {
    return join(app.getPath('userData'), 'sandbox-recordings')
  }

  private getSnapshotsDir(): string {
    return join(app.getPath('userData'), 'sandbox-snapshots')
  }

  private getDbPath(runId: string): string {
    return join(this.getRecordingsDir(), `recording_${runId}.db`)
  }

  private async ensureDirs(): Promise<void> {
    await mkdir(this.getRecordingsDir(), { recursive: true })
    await mkdir(this.getSnapshotsDir(), { recursive: true })
  }

  private initDb(runId: string): import('better-sqlite3').Database {
    const db = new (lazyRequire<typeof BetterSqlite3>('better-sqlite3'))(this.getDbPath(runId))
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS action_log (
        seq INTEGER PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        result TEXT,
        error TEXT,
        duration INTEGER,
        risk_level TEXT NOT NULL DEFAULT 'low',
        timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS replay_index (
        frame_seq INTEGER PRIMARY KEY,
        summary TEXT NOT NULL
      );
    `)
    // 预编译高频语句
    this.stmts.insertAction = db.prepare(`
      INSERT INTO action_log (seq, type, payload, result, error, duration, risk_level, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    this.stmts.insertReplay = db.prepare(`
      INSERT OR REPLACE INTO replay_index (frame_seq, summary) VALUES (?, ?)
    `)
    return db
  }

  /** Start recording a new run */
  async startRecording(runId: string): Promise<void> {
    await this.ensureDirs()
    this.currentRunId = runId
    this.seqCounter = 0
    this.db = this.initDb(runId)
  }

  /** Record an action */
  async record(action: Omit<SandboxAction, 'seq'>): Promise<void> {
    if (!this.db || !this.currentRunId) return

    const seq = ++this.seqCounter
    const payload = JSON.stringify(action.payload)
    const result = action.result ? JSON.stringify(action.result) : null
    const error = action.error || null

    this.stmts.insertAction!.run(seq, action.type, payload, result, error, action.duration || null, action.riskLevel, action.timestamp)

    // Build replay summary
    const summary = this.buildSummary(action.type, action.payload)
    this.stmts.insertReplay!.run(seq, summary)
  }

  private buildSummary(type: string, payload: Record<string, unknown>): string {
    switch (type) {
      case 'terminal_exec':
        return `💻 ${(payload as { command: string }).command}`
      case 'file_read':
        return `📖 ${(payload as { path: string }).path}`
      case 'file_write':
        return `✏️ ${(payload as { path: string }).path}`
      case 'tool_call':
        return `🔧 ${(payload as { tool_name: string }).tool_name}`
      case 'llm_complete':
        return `🧠 ${(payload as { model: string }).model}`
      default:
        return type
    }
  }

  /** Get all actions for a recording */
  getActions(runId: string): SandboxAction[] {
    const db = this.openReadDb(runId)
    if (!db) return []

    try {
      const rows = db.prepare(`
        SELECT seq, type, payload, result, error, duration, risk_level as riskLevel, timestamp
        FROM action_log ORDER BY seq
      `).all() as ActionLogRow[]

      return rows.map(row => ({
        seq: row.seq,
        runId,
        type: row.type as SandboxAction['type'],
        payload: JSON.parse(row.payload),
        result: row.result ? JSON.parse(row.result) : undefined,
        error: row.error || undefined,
        duration: row.duration ?? undefined,
        riskLevel: row.riskLevel as RiskLevel,
        timestamp: row.timestamp,
      }))
    } finally {
      db.close()
    }
  }

  /** Get recording summary */
  getSummary(runId: string): RecordingSummary | null {
    const db = this.openReadDb(runId)
    if (!db) return null

    try {
      const countRow = db.prepare('SELECT COUNT(*) as c FROM action_log').get() as CountRow | undefined
      const count = countRow?.c ?? 0
      const riskRows = db.prepare(`
        SELECT risk_level, COUNT(*) as c FROM action_log GROUP BY risk_level
      `).all() as RiskCountRow[]

      // 获取第一条记录的时间戳作为 startedAt
      const firstRow = db.prepare('SELECT timestamp FROM action_log ORDER BY seq LIMIT 1').get() as { timestamp: string } | undefined
      const startedAt = firstRow?.timestamp ?? ''

      const riskSummary: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 }
      for (const row of riskRows) {
        riskSummary[row.risk_level as RiskLevel] = row.c
      }

      return {
        runId,
        startedAt,
        actionCount: count,
        status: 'completed',
        riskSummary,
      }
    } finally {
      db.close()
    }
  }

  /** Export recording as JSONL */
  async exportRecording(runId: string, destPath: string): Promise<void> {
    const actions = this.getActions(runId)
    const lines = actions.map(a => JSON.stringify({
      seq: a.seq,
      type: a.type,
      payload: a.payload,
      result: a.result,
      error: a.error,
      duration: a.duration,
      riskLevel: a.riskLevel,
      timestamp: a.timestamp,
    }))
    await writeFile(destPath, lines.join('\n') + '\n', 'utf-8')
  }

  /** List all recordings */
  async listRecordings(): Promise<RecordingSummary[]> {
    const dir = this.getRecordingsDir()
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return [] // 目录不存在
    }
    const recordings: RecordingSummary[] = []

    for (const file of files) {
      if (!file.startsWith('recording_') || !file.endsWith('.db')) continue
      const runId = file.replace('recording_', '').replace('.db', '')
      const summary = this.getSummary(runId)
      if (summary) recordings.push(summary)
    }

    return recordings
  }

  /** Clean up recordings older than 30 days */
  async cleanOldRecordings(): Promise<void> {
    const dir = this.getRecordingsDir()
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return // 目录不存在
    }
    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    for (const file of files) {
      const filePath = join(dir, file)
      try {
        const s = await stat(filePath)
        if (now - s.mtimeMs > thirtyDays) {
          await rm(filePath)
        }
      } catch {
        // 文件可能已被删除或不可访问，跳过
      }
    }
  }

  /** Stop recording */
  stopRecording(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.stmts = {}
    this.currentRunId = null
    this.seqCounter = 0
  }

  /** 生命周期停止方法（兼容 ServiceContainer） */
  stop(): void {
    this.stopRecording()
  }

  private openReadDb(runId: string): import('better-sqlite3').Database | null {
    try {
      const db = new (lazyRequire<typeof BetterSqlite3>('better-sqlite3'))(this.getDbPath(runId), { readonly: true })
      return db
    } catch {
      return null
    }
  }
}

/**
 * Permission Manager — Progressive permission prompting with memory
 */
export class PermissionManager {
  private memory: PermissionRecord[] = []

  /** Check if action is allowed */
  check(action: string, type: string): { allowed: boolean; reason: string; expiresAt?: string } {
    // Check memory for matching permission
    const now = Date.now()
    const record = this.memory.find(r => {
      if (new Date(r.expiresAt).getTime() < now) return false
      if (r.action !== type && r.action !== '*') return false
      // Simple pattern match (substring)
      return action.includes(r.pattern) || r.pattern === '*'
    })

    if (record) {
      return { allowed: true, reason: `Previously granted (${record.scope})`, expiresAt: record.expiresAt }
    }

    return { allowed: false, reason: 'Requires user confirmation' }
  }

  /** Grant permission */
  grant(pattern: string, action: string, scope: string, durationMs: number = 3600000): PermissionRecord {
    const now = new Date()
    const record: PermissionRecord = {
      id: createHash('sha256').update(`${pattern}-${action}-${Date.now()}`).digest('hex').slice(0, 16),
      pattern,
      action: action as PermissionRecord['action'],
      scope,
      grantedBy: 'user',
      expiresAt: new Date(now.getTime() + durationMs).toISOString(),
      createdAt: now.toISOString(),
    }
    this.memory.push(record)
    return record
  }

  /** Revoke permission */
  revoke(id: string): void {
    this.memory = this.memory.filter(r => r.id !== id)
  }

  /** Clean expired permissions */
  cleanExpired(): void {
    const now = Date.now()
    this.memory = this.memory.filter(r => new Date(r.expiresAt).getTime() > now)
  }

  /** Get all active permissions */
  getActivePermissions(): PermissionRecord[] {
    this.cleanExpired()
    return [...this.memory]
  }
}
