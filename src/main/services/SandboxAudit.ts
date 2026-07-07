import { app } from 'electron'
import { join } from 'path'
import { mkdir, readdir, rm, stat, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import type { SandboxAction, RecordingSummary, PermissionRecord, RiskLevel } from '@shared/types/sandbox'

/**
 * Sandbox Recorder — Records all agent actions for audit and replay
 */
export class SandboxRecorder {
  private db: import('better-sqlite3').Database | null = null
  private currentRunId: string | null = null
  private seqCounter = 0

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
    const db = new (require('better-sqlite3'))(this.getDbPath(runId))
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

    this.db.prepare(`
      INSERT INTO action_log (seq, type, payload, result, error, duration, risk_level, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(seq, action.type, payload, result, error, action.duration || null, action.riskLevel, action.timestamp)

    // Build replay summary
    const summary = this.buildSummary(action.type, action.payload)
    this.db.prepare(`
      INSERT OR REPLACE INTO replay_index (frame_seq, summary) VALUES (?, ?)
    `).run(seq, summary)
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

    const rows = db.prepare(`
      SELECT seq, type, payload, result, error, duration, risk_level as riskLevel, timestamp
      FROM action_log ORDER BY seq
    `).all() as any[]

    db.close()

    return rows.map(row => ({
      seq: row.seq,
      runId,
      type: row.type,
      payload: JSON.parse(row.payload),
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error || undefined,
      duration: row.duration,
      riskLevel: row.riskLevel,
      timestamp: row.timestamp,
    }))
  }

  /** Get recording summary */
  getSummary(runId: string): RecordingSummary | null {
    const db = this.openReadDb(runId)
    if (!db) return null

    const count = (db.prepare('SELECT COUNT(*) as c FROM action_log').get() as any).c
    const riskRows = db.prepare(`
      SELECT risk_level, COUNT(*) as c FROM action_log GROUP BY risk_level
    `).all() as any[]

    db.close()

    const riskSummary: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const row of riskRows) {
      riskSummary[row.risk_level as RiskLevel] = row.c
    }

    return {
      runId,
      startedAt: '',
      actionCount: count,
      status: 'completed',
      riskSummary,
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
    const files = await readdir(dir)
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
    const files = await readdir(dir)
    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000

    for (const file of files) {
      const filePath = join(dir, file)
      const s = await stat(filePath)
      if (now - s.mtimeMs > thirtyDays) {
        await rm(filePath)
      }
    }
  }

  /** Stop recording */
  stopRecording(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.currentRunId = null
    this.seqCounter = 0
  }

  private openReadDb(runId: string): import('better-sqlite3').Database | null {
    try {
      const db = new (require('better-sqlite3'))(this.getDbPath(runId), { readonly: true })
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
    const now = new Date().toISOString()
    const record = this.memory.find(r => {
      if (r.expiresAt < now) return false
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
      action: action as any,
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
    const now = new Date().toISOString()
    this.memory = this.memory.filter(r => r.expiresAt > now)
  }

  /** Get all active permissions */
  getActivePermissions(): PermissionRecord[] {
    this.cleanExpired()
    return [...this.memory]
  }
}
