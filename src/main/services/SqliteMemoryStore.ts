// SQLite 记忆存储 — 基于 better-sqlite3 + FTS5 全文索引
// 替代 InMemoryStore + electron-store + 自定义 FTSIndex
// 优势:
//   1. 持久化: SQLite WAL 模式，数据落盘，重启不丢失
//   2. 全文搜索: FTS5 虚拟表 + BM25 排序，O(log n) 查询
//   3. CJK 支持: 预处理中文文本，unicode61 分词器逐字索引
//   4. 事务安全: add/delete/update 原子操作

import type BetterSqlite3 from 'better-sqlite3'
import type { MemoryEpisode, MemoryStats, MemoryFTSResult, MemoryFTSStats } from '@shared/types'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const DatabaseConstructor: typeof BetterSqlite3 = require('better-sqlite3')

interface EpisodeRow {
  id: string
  session_id: string
  role: string
  content: string
  summary: string | null
  topics: string | null
  importance: number | null
  metadata: string | null
  created_at: string
}

/** COUNT 聚合查询行 */
interface CountRow { cnt: number }

/** 标量聚合查询行 (string) */
interface AggRow { val?: string }

/** 标量聚合查询行 (integer) */
interface TotalRow { total?: number }

/** FTS 索引大小查询行 */
interface SizeRow { total_size?: number }

/** AVG 聚合查询行 */
interface AvgRow { avg_len?: number }

/** ID 查询行 */
interface IdRow { id: string }

/**
 * 预处理文本以支持 CJK 分词
 * unicode61 分词器默认将连续的 CJK 字符视为一个 token
 * 通过在 CJK 字符之间插入空格，使每个中文字符成为独立 token
 * 这样搜索"错误分析"时，FTS5 会匹配同时包含"错""误""分""析"的文档
 */
function preprocessForFTS(text: string): string {
  if (!text) return ''
  // 在 CJK 字符两侧插入空格
  return text.replace(/([\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af])/g, ' $1 ')
}

/**
 * 将用户查询转义为安全的 FTS5 MATCH 表达式
 *
 * FTS5 MATCH 语法中，双引号包裹的是「字符串字面量」(phrase)，
 * 不会被解释为 FTS5 操作符（AND, OR, NOT, NEAR, *, ^, : 等）。
 * 我们将每个 token 用双引号包裹，并将 token 内部的双引号替换为空格。
 *
 * 例如:
 *   输入: error) "test"
 *   预处理后: error )  test
 *   安全 MATCH: "error" ")" "test"
 */
function sanitizeFTSQuery(preprocessedQuery: string): string {
  const tokens = preprocessedQuery
    .split(/[\s]+/)
    .filter(t => t.length > 0)
    .map(t => '"' + t.replace(/"/g, ' ') + '"')
  return tokens.join(' ')
}

/**
 * 从 FTS5 MATCH 查询中提取匹配的 token 列表
 */
function extractMatchedTokens(query: string): string[] {
  // 预处理查询并分词
  const preprocessed = preprocessForFTS(query)
  return preprocessed
    .split(/[\s,.!?:;]+/)
    .filter(t => t.length > 0)
    .slice(0, 20) // 限制返回数量
}

/**
 * SQLite 记忆存储 - 实现 SDK 的 Memory 接口。
 *
 * 注：类级别未添加 implements 子句，以保持与 SDK Memory 接口的柔性边界。
 * MemoryService.getStore() 在边界处负责类型转换。
 */
export class SqliteMemoryStore {
  private db: BetterSqlite3.Database

  constructor(dbPath: string) {
    this.db = new DatabaseConstructor(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')

    // 主表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS episodes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        topics TEXT,
        importance REAL,
        metadata TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_session ON episodes(session_id);
      CREATE INDEX IF NOT EXISTS idx_episodes_created ON episodes(created_at);
      CREATE INDEX IF NOT EXISTS idx_episodes_importance ON episodes(importance);
    `)

    // FTS5 虚拟表（独立存储，非 external content，以支持 CJK 预处理）
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
        episode_id UNINDEXED,
        content,
        summary,
        topics,
        tokenize='unicode61 remove_diacritics 2'
      );
    `)
  }

  // ===== Memory 接口实现 =====

  add(episode: MemoryEpisode): void {
    if (!episode.id?.trim()) throw new Error('Episode ID is required')
    if (!episode.content?.trim()) throw new Error('Episode content is required')

    const tx = this.db.transaction(() => {
      this.db.prepare(
        `INSERT OR REPLACE INTO episodes (id, session_id, role, content, summary, topics, importance, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        episode.id,
        episode.sessionId,
        episode.role,
        episode.content,
        episode.summary ?? null,
        episode.topics ?? null,
        episode.importance ?? null,
        episode.metadata ? JSON.stringify(episode.metadata) : null,
        episode.createdAt
      )

      // 同步 FTS 索引: 先删旧记录，再插新记录
      this.db.prepare('DELETE FROM episodes_fts WHERE episode_id = ?').run(episode.id)
      this.db.prepare(
        `INSERT INTO episodes_fts (episode_id, content, summary, topics)
         VALUES (?, ?, ?, ?)`
      ).run(
        episode.id,
        preprocessForFTS(episode.content),
        preprocessForFTS(episode.summary ?? ''),
        preprocessForFTS(episode.topics ?? '')
      )
    })
    tx()
  }

  search(query: string, opts?: {
    sessionId?: string
    limit?: number
    offset?: number
    roleFilter?: string
  }): MemoryEpisode[] {
    let sql = 'SELECT * FROM episodes WHERE (content LIKE ? OR summary LIKE ? OR topics LIKE ?)'
    const params: unknown[] = [`%${query}%`, `%${query}%`, `%${query}%`]
    if (opts?.sessionId) {
      sql += ' AND session_id = ?'
      params.push(opts.sessionId)
    }
    if (opts?.roleFilter) {
      sql += ' AND role = ?'
      params.push(opts.roleFilter)
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(opts?.limit ?? 10, opts?.offset ?? 0)
    const stmt = this.db.prepare(sql)
    return (stmt.all(...params) as EpisodeRow[]).map(rowToEpisode)
  }

  get(id: string): MemoryEpisode | null {
    const row = this.db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as EpisodeRow | undefined
    return row ? rowToEpisode(row) : null
  }

  delete(id: string): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM episodes WHERE id = ?').run(id)
      this.db.prepare('DELETE FROM episodes_fts WHERE episode_id = ?').run(id)
    })
    tx()
  }

  count(sessionId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM episodes WHERE session_id = ?').get(sessionId) as CountRow | undefined
    return row?.cnt ?? 0
  }

  list(opts?: {
    sessionId?: string
    limit?: number
    offset?: number
    ascending?: boolean
  }): MemoryEpisode[] {
    let sql = 'SELECT * FROM episodes'
    const params: unknown[] = []
    if (opts?.sessionId) {
      sql += ' WHERE session_id = ?'
      params.push(opts.sessionId)
    }
    const order = opts?.ascending ? 'ASC' : 'DESC'
    sql += ` ORDER BY created_at ${order} LIMIT ? OFFSET ?`
    params.push(opts?.limit ?? 10, opts?.offset ?? 0)
    const stmt = this.db.prepare(sql)
    return (stmt.all(...params) as EpisodeRow[]).map(rowToEpisode)
  }

  updateSummary(id: string, summary: string, topics: string): void {
    const tx = this.db.transaction(() => {
      const result = this.db.prepare(
        'UPDATE episodes SET summary = ?, topics = ? WHERE id = ?'
      ).run(summary, topics, id)
      if (result.changes === 0) throw new Error(`Episode ${id} not found`)

      // 同步 FTS 索引
      const row = this.db.prepare('SELECT content FROM episodes WHERE id = ?').get(id) as EpisodeRow | undefined
      if (row) {
        this.db.prepare('DELETE FROM episodes_fts WHERE episode_id = ?').run(id)
        this.db.prepare(
          `INSERT INTO episodes_fts (episode_id, content, summary, topics)
           VALUES (?, ?, ?, ?)`
        ).run(id, preprocessForFTS(row.content), preprocessForFTS(summary), preprocessForFTS(topics))
      }
    })
    tx()
  }

  setImportance(id: string, importance: number): void {
    if (importance < 0 || importance > 1) throw new Error('Importance must be between 0 and 1')
    const result = this.db.prepare('UPDATE episodes SET importance = ? WHERE id = ?').run(importance, id)
    if (result.changes === 0) throw new Error(`Episode ${id} not found`)
  }

  searchByTag(tag: string, opts?: {
    sessionId?: string
    limit?: number
  }): MemoryEpisode[] {
    let sql = 'SELECT * FROM episodes WHERE topics LIKE ?'
    const params: unknown[] = [`%${tag}%`]
    if (opts?.sessionId) {
      sql += ' AND session_id = ?'
      params.push(opts.sessionId)
    }
    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(opts?.limit ?? 10)
    const stmt = this.db.prepare(sql)
    return (stmt.all(...params) as EpisodeRow[]).map(rowToEpisode)
  }

  getImportant(threshold: number, limit: number): MemoryEpisode[] {
    const rows = this.db.prepare(
      'SELECT * FROM episodes WHERE importance >= ? ORDER BY importance DESC LIMIT ?'
    ).all(threshold, limit) as EpisodeRow[]
    return rows.map(rowToEpisode)
  }

  getTimeline(days: number): Record<string, MemoryEpisode[]> {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString()
    const rows = this.db.prepare(
      'SELECT * FROM episodes WHERE created_at >= ? ORDER BY created_at DESC'
    ).all(cutoff) as EpisodeRow[]
    const timeline: Record<string, MemoryEpisode[]> = {}
    for (const row of rows) {
      const date = row.created_at.slice(0, 10)
      if (!timeline[date]) timeline[date] = []
      timeline[date].push(rowToEpisode(row))
    }
    return timeline
  }

  cleanupExpired(maxAgeDays: number): number {
    const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString()
    const tx = this.db.transaction(() => {
      // 先获取要删除的 ID
      const ids = this.db.prepare(
        'SELECT id FROM episodes WHERE created_at < ?'
      ).all(cutoff) as IdRow[]

      if (ids.length > 0) {
        const idValues = ids.map(r => r.id)
        const placeholders = idValues.map(() => '?').join(',')
        this.db.prepare(`DELETE FROM episodes_fts WHERE episode_id IN (${placeholders})`).run(...idValues)
        this.db.prepare('DELETE FROM episodes WHERE created_at < ?').run(cutoff)
      }
      return ids.length
    })
    return tx()
  }

  stats(): MemoryStats {
    const totalRow = this.db.prepare('SELECT COUNT(*) as cnt FROM episodes').get() as CountRow | undefined
    const total = totalRow?.cnt ?? 0
    const sessionsRow = this.db.prepare('SELECT COUNT(DISTINCT session_id) as cnt FROM episodes').get() as CountRow | undefined
    const sessions = sessionsRow?.cnt ?? 0
    const oldestRow = this.db.prepare('SELECT MIN(created_at) as val FROM episodes').get() as AggRow | undefined
    const oldest = oldestRow?.val
    const newestRow = this.db.prepare('SELECT MAX(created_at) as val FROM episodes').get() as AggRow | undefined
    const newest = newestRow?.val
    return {
      totalEpisodes: total,
      totalSessions: sessions,
      oldestEpisode: oldest ?? undefined,
      newestEpisode: newest ?? undefined,
      avgEpisodesPerSession: sessions > 0 ? total / sessions : 0,
    }
  }

  // ===== FTS5 全文搜索 =====

  /**
   * FTS5 全文搜索 — BM25 排序
   * 返回带评分和匹配 token 的结果
   */
  ftsSearch(query: string, opts?: {
    sessionId?: string
    limit?: number
  }): MemoryFTSResult[] {
    const limit = opts?.limit ?? 10
    const preprocessedQuery = preprocessForFTS(query).trim()

    if (!preprocessedQuery) return []

    // 转义为安全的 FTS5 MATCH 表达式（防止特殊字符导致语法错误）
    const safeMatch = sanitizeFTSQuery(preprocessedQuery)
    if (!safeMatch) return []

    // FTS5 MATCH 查询
    let sql = `
      SELECT
        f.episode_id as id,
        bm25(episodes_fts) as bm25_score,
        e.session_id,
        e.role,
        e.content,
        e.summary,
        e.topics,
        e.importance,
        e.metadata,
        e.created_at
      FROM episodes_fts f
      JOIN episodes e ON e.id = f.episode_id
      WHERE episodes_fts MATCH ?
    `
    const params: unknown[] = [safeMatch]

    if (opts?.sessionId) {
      sql += ' AND e.session_id = ?'
      params.push(opts.sessionId)
    }

    // bm25() 返回负值，越负表示越相关，所以 ASC 排序 = 最相关在前
    sql += ' ORDER BY bm25_score ASC LIMIT ?'
    params.push(limit)

    const ftsRowSql = this.db.prepare(sql)
    const rows = ftsRowSql.all(...params) as Array<{
      id: string
      bm25_score: number
      session_id: string
      role: string
      content: string
      summary: string | null
      topics: string | null
      importance: number | null
      metadata: string | null
      created_at: string
    }>
    const matchedTokens = extractMatchedTokens(query)

    return rows.map((row) => ({
      id: row.id,
      score: -row.bm25_score,
      matchedTokens,
      episode: rowToEpisode(row),
    }))
  }

  /**
   * FTS 索引统计
   */
  ftsStats(): MemoryFTSStats {
    const docRow = this.db.prepare('SELECT COUNT(*) as cnt FROM episodes').get() as CountRow | undefined
    const totalDocuments = docRow?.cnt ?? 0
    const avgLenRow = this.db.prepare(
      'SELECT AVG(LENGTH(content)) as avg_len FROM episodes'
    ).get() as AvgRow | undefined
    const avgDocumentLength = Math.round(avgLenRow?.avg_len ?? 0)

    let indexSizeKB = 0
    try {
      const indexSizeRow = this.db.prepare(`
        SELECT SUM(pgsize) as total_size
        FROM dbstat
        WHERE name LIKE 'episodes_fts%'
      `).get() as SizeRow | undefined
      indexSizeKB = Math.round((indexSizeRow?.total_size ?? 0) / 1024)
    } catch {
      try {
        const shadowRow = this.db.prepare(`
          SELECT COUNT(*) as cnt FROM episodes_fts_row
        `).get() as CountRow | undefined
        indexSizeKB = Math.round((shadowRow?.cnt ?? 0) * 0.1)
      } catch (err) {
        // shadow 表统计失败时忽略，indexSizeKB 保持上一轮估算值
        console.error('[SqliteMemoryStore] shadow table size estimation failed:', err)
      }
    }

    const totalContentRow = this.db.prepare(
      'SELECT SUM(LENGTH(content)) as total FROM episodes'
    ).get() as TotalRow | undefined
    const totalContentLen = totalContentRow?.total ?? 0
    const totalTokens = Math.round(totalContentLen / 5)

    let uniqueTokens = 0
    try {
      const vocabRow = this.db.prepare(`
        SELECT COUNT(*) as cnt FROM episodes_fts_v
      `).get() as CountRow | undefined
      uniqueTokens = vocabRow?.cnt ?? 0
    } catch {
      // FTS5 词汇表不可用，保持 0
    }

    return {
      totalDocuments,
      totalTokens,
      uniqueTokens,
      avgDocumentLength,
      indexSizeKB,
    }
  }

  /**
   * 重建 FTS 索引 — 从 episodes 表重建
   */
  rebuildFTS(): MemoryFTSStats {
    const tx = this.db.transaction(() => {
      this.db.exec("DELETE FROM episodes_fts")
      const rows = this.db.prepare('SELECT id, content, summary, topics FROM episodes').all() as EpisodeRow[]
      const insertStmt = this.db.prepare(
        `INSERT INTO episodes_fts (episode_id, content, summary, topics)
         VALUES (?, ?, ?, ?)`
      )
      for (const row of rows) {
        insertStmt.run(
          row.id,
          preprocessForFTS(row.content ?? ''),
          preprocessForFTS(row.summary ?? ''),
          preprocessForFTS(row.topics ?? '')
        )
      }
    })
    tx()
    return this.ftsStats()
  }

  /**
   * 批量导入（用于数据迁移）
   */
  batchImport(episodes: MemoryEpisode[]): number {
    let count = 0
    const tx = this.db.transaction(() => {
      const insertEpisode = this.db.prepare(
        `INSERT OR REPLACE INTO episodes (id, session_id, role, content, summary, topics, importance, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const deleteFts = this.db.prepare('DELETE FROM episodes_fts WHERE episode_id = ?')
      const insertFts = this.db.prepare(
        `INSERT INTO episodes_fts (episode_id, content, summary, topics)
         VALUES (?, ?, ?, ?)`
      )
      for (const ep of episodes) {
        insertEpisode.run(
          ep.id,
          ep.sessionId,
          ep.role,
          ep.content,
          ep.summary ?? null,
          ep.topics ?? null,
          ep.importance ?? null,
          ep.metadata ? JSON.stringify(ep.metadata) : null,
          ep.createdAt
        )
        // 先删旧 FTS 记录（防止重复导入时出现重复索引）
        deleteFts.run(ep.id)
        insertFts.run(
          ep.id,
          preprocessForFTS(ep.content),
          preprocessForFTS(ep.summary ?? ''),
          preprocessForFTS(ep.topics ?? '')
        )
        count++
      }
    })
    tx()
    return count
  }

  /**
   * 获取底层 db 对象（供外部查询用）
   */
  getDb(): BetterSqlite3.Database {
    return this.db!
  }

  close(): void {
    this.db.close()
    // db 字段保持非空类型，因为 SqliteMemoryStore 设计为单例长期存活
  }
}

function rowToEpisode(row: EpisodeRow): MemoryEpisode {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    summary: row.summary ?? undefined,
    topics: row.topics ?? undefined,
    importance: row.importance ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    createdAt: row.created_at,
  }
}
