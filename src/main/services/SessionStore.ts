// 会话历史持久化服务
// 使用 SQLite (better-sqlite3) 存储会话和消息
// 替代 electron-store JSON 存储，支持 WAL 模式提升并发性能
// 自动从旧 aela-sessions.json 迁移数据

import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import type BetterSqlite3 from 'better-sqlite3'
import type { Session, ChatMessage, SessionSearchResult, SessionExportOptions, SessionExportResult, SessionContextInfo, ContextWindowConfig } from '@shared/types'
import { lazyRequire } from '../utils/nativeRequire'
import { buildSafeFTSMatch, escapeLikePattern } from '../utils/ftsQuery'

// 行类型映射
interface SessionRow {
  id: string
  title: string
  workspaceId: string | null
  modelConfigId: string | null
  systemPrompt: string
  activeSkillIds: string
  createdAt: string
  updatedAt: string
  messageCount: number
  parentId: string | null
  branchMessageId: string | null
}

interface MessageRow {
  id: string
  sessionId: string
  role: string
  content: string
  toolCalls: string | null
  toolResult: string | null
  metrics: string | null
  createdAt: string
}

/** 会话搜索 JOIN 查询返回的行 */
interface SessionSearchRow extends MessageRow {
  s_id: string
  s_title: string
  s_workspaceId: string | null
  s_modelConfigId: string | null
  s_systemPrompt: string
  s_activeSkillIds: string
  s_createdAt: string
  s_updatedAt: string
  s_messageCount: number
  s_parentId: string | null
}

function rowToSession(row: SessionRow): Session {
  return {
      id: row.id,
      title: row.title,
      workspaceId: row.workspaceId,
      modelConfigId: row.modelConfigId,
      systemPrompt: row.systemPrompt,
      activeSkillIds: JSON.parse(row.activeSkillIds),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row.messageCount,
      parentId: row.parentId ?? null,
      branchMessageId: row.branchMessageId ?? null,
    }
  }

function rowToChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role as ChatMessage['role'],
    content: row.content,
    toolCalls: row.toolCalls ? JSON.parse(row.toolCalls) : undefined,
    toolResult: row.toolResult ? JSON.parse(row.toolResult) : undefined,
    metrics: row.metrics ? JSON.parse(row.metrics) : undefined,
    createdAt: row.createdAt,
  }
}

export class SessionStore {
  private db: BetterSqlite3.Database

  constructor() {
    const dbPath = join(app.getPath('userData'), 'aela-sessions.db')
    this.db = new (lazyRequire<typeof BetterSqlite3>('better-sqlite3'))(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.db.pragma('foreign_keys = ON')

    this.createTables()
    this.migrateColumns()
    this.migrateFromJson()
    // 迁移后再构建 FTS 索引（确保迁移数据也被索引）
    this.rebuildFtsIndex()
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '新对话',
        workspaceId TEXT,
        modelConfigId TEXT,
        systemPrompt TEXT DEFAULT '',
        activeSkillIds TEXT DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        messageCount INTEGER DEFAULT 0,
        parentId TEXT,
        branchMessageId TEXT
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        toolCalls TEXT,
        toolResult TEXT,
        metrics TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(sessionId);

      -- FTS5 全文搜索虚拟表：解决 LOWER(content) LIKE '%..%' 全表扫描问题
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content,
        content='messages',
        content_rowid='rowid',
        tokenize='unicode61'
      );

      -- 触发器保持 FTS 索引与 messages 表同步
      CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
        INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
      END;
    `)
  }

  /** 为旧版数据库补齐新增列（CREATE TABLE IF NOT EXISTS 不会修改已存在的表） */
  private migrateColumns(): void {
    const cols = this.db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>
    const colNames = new Set(cols.map(c => c.name))
    if (!colNames.has('parentId')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN parentId TEXT')
    }
    if (!colNames.has('branchMessageId')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN branchMessageId TEXT')
    }
  }

  /** 为已有数据构建 FTS 索引（迁移后或索引损坏时调用） */
  private rebuildFtsIndex(): void {
    try {
      this.db.exec(`INSERT INTO messages_fts(messages_fts) VALUES('rebuild')`);
    } catch {
      // FTS 索引可能不存在或已损坏，忽略错误
    }
  }

  /**
   * 从旧的 aela-sessions.json (electron-store) 迁移数据到 SQLite
   * 迁移成功后删除 JSON 文件
   */
  private migrateFromJson(): void {
    const jsonPath = join(app.getPath('userData'), 'aela-sessions.json')
    if (!existsSync(jsonPath)) return

    try {
      // 动态导入 electron-store 以读取旧数据
      const Store = lazyRequire<typeof import('electron-store')['default']>('electron-store')
      const oldStore = new Store({
        name: 'aela-sessions',
        defaults: { sessions: [], messages: {} }
      })

      const sessions: Session[] = oldStore.store?.sessions || []
      const messages: Record<string, ChatMessage[]> = oldStore.store?.messages || {}

      if (sessions.length === 0 && Object.keys(messages).length === 0) {
        // 没有数据可迁移，直接删除 JSON 文件
        unlinkSync(jsonPath)
        return
      }

      const tx = this.db.transaction(() => {
        const insertSession = this.db.prepare(
          `INSERT OR IGNORE INTO sessions (id, title, workspaceId, modelConfigId, systemPrompt, activeSkillIds, createdAt, updatedAt, messageCount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        const insertMessage = this.db.prepare(
          `INSERT OR IGNORE INTO messages (id, sessionId, role, content, toolCalls, toolResult, metrics, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )

        for (const s of sessions) {
          insertSession.run(
            s.id,
            s.title,
            s.workspaceId ?? null,
            s.modelConfigId ?? null,
            s.systemPrompt || '',
            JSON.stringify(Array.isArray(s.activeSkillIds) ? s.activeSkillIds : []),
            s.createdAt,
            s.updatedAt,
            s.messageCount || 0
          )
        }

        for (const sessionId of Object.keys(messages)) {
          for (const msg of messages[sessionId]) {
            insertMessage.run(
              msg.id,
              msg.sessionId,
              msg.role,
              msg.content,
              msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
              msg.toolResult ? JSON.stringify(msg.toolResult) : null,
              msg.metrics ? JSON.stringify(msg.metrics) : null,
              msg.createdAt
            )
          }
        }
      })

      tx()
      // 迁移成功，删除旧 JSON 文件
      unlinkSync(jsonPath)
    } catch {
      // 迁移失败不影响启动，保留 JSON 文件以便下次重试
    }
  }

  // ===== 会话分支 =====

  branchFrom(params: {
    parentSessionId: string
    branchMessageId: string
    title?: string
  }): Session | null {
    const parent = this.getSession(params.parentSessionId)
    if (!parent) return null

    const parentMessages = this.getMessages(params.parentSessionId)
    const branchIdx = parentMessages.findIndex(m => m.id === params.branchMessageId)
    if (branchIdx < 0) return null

    const slicedMessages = parentMessages.slice(0, branchIdx + 1)
    const newTitle = params.title || `${parent.title} (branch)`

    const session = this.createSession({
      title: newTitle,
      workspaceId: parent.workspaceId,
      modelConfigId: parent.modelConfigId,
      systemPrompt: parent.systemPrompt,
      activeSkillIds: parent.activeSkillIds,
      parentId: params.parentSessionId,
      branchMessageId: params.branchMessageId,
    })

    const tx = this.db.transaction(() => {
      const insertMsg = this.db.prepare(
        `INSERT INTO messages (id, sessionId, role, content, toolCalls, toolResult, metrics, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const msg of slicedMessages) {
        insertMsg.run(
          msg.id,
          session.id,
          msg.role,
          msg.content,
          msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
          msg.toolResult ? JSON.stringify(msg.toolResult) : null,
          msg.metrics ? JSON.stringify(msg.metrics) : null,
          msg.createdAt
        )
      }
      this.db.prepare(
        `UPDATE sessions SET messageCount = ?, updatedAt = ? WHERE id = ?`
      ).run(slicedMessages.length, new Date().toISOString(), session.id)
    })
    tx()

    return session
  }

  getChildSessions(parentId: string): Session[] {
    const rows = this.db.prepare(
      'SELECT * FROM sessions WHERE parentId = ? ORDER BY createdAt ASC'
    ).all(parentId) as SessionRow[]
    return rows.map(rowToSession)
  }

  // ===== 会话操作 =====

  createSession(params: {
    title?: string
    workspaceId?: string | null
    modelConfigId?: string | null
    systemPrompt?: string
    activeSkillIds?: string[]
    parentId?: string | null
    branchMessageId?: string | null
  }): Session {
    const now = new Date().toISOString()
    const session: Session = {
      id: randomUUID(),
      title: params.title || '新对话',
      workspaceId: params.workspaceId ?? null,
      modelConfigId: params.modelConfigId ?? null,
      systemPrompt: params.systemPrompt || '',
      activeSkillIds: params.activeSkillIds || [],
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      parentId: params.parentId ?? null,
    }

    this.db.prepare(
      `INSERT INTO sessions (id, title, workspaceId, modelConfigId, systemPrompt, activeSkillIds, createdAt, updatedAt, messageCount, parentId, branchMessageId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      session.id,
      session.title,
      session.workspaceId,
      session.modelConfigId,
      session.systemPrompt,
      JSON.stringify(session.activeSkillIds),
      session.createdAt,
      session.updatedAt,
      session.messageCount,
      params.parentId ?? null,
      params.branchMessageId ?? null
    )

    return session
  }

  listSessions(workspaceId?: string | null): Session[] {
    let rows: SessionRow[]
    if (workspaceId !== undefined) {
      rows = this.db.prepare(
        'SELECT * FROM sessions WHERE workspaceId = ? ORDER BY updatedAt DESC'
      ).all(workspaceId) as SessionRow[]
    } else {
      rows = this.db.prepare('SELECT * FROM sessions ORDER BY updatedAt DESC').all() as SessionRow[]
    }
    return rows.map(rowToSession)
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined
    return row ? rowToSession(row) : null
  }

  updateSession(id: string, partial: Partial<Session>): void {
    const existing = this.getSession(id)
    if (!existing) return

    const updated = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString()
    }

    this.db.prepare(
      `UPDATE sessions SET title = ?, workspaceId = ?, modelConfigId = ?, systemPrompt = ?, activeSkillIds = ?, updatedAt = ?, messageCount = ?, parentId = ?, branchMessageId = ?
       WHERE id = ?`
    ).run(
      updated.title,
      updated.workspaceId,
      updated.modelConfigId,
      updated.systemPrompt,
      JSON.stringify(updated.activeSkillIds),
      updated.updatedAt,
      updated.messageCount,
      updated.parentId ?? null,
      updated.branchMessageId ?? existing.branchMessageId ?? null,
      id
    )
  }

  deleteSession(id: string): void {
    // ON DELETE CASCADE 会自动删除关联消息
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  }

  /**
   * 增量更新会话激活的 skills
   */
  updateActiveSkillIds(id: string, skillIds: string[]): void {
    this.db.prepare(
      `UPDATE sessions SET activeSkillIds = ?, updatedAt = ? WHERE id = ?`
    ).run(JSON.stringify([...new Set(skillIds)]), new Date().toISOString(), id)
  }

  // ===== 消息操作 =====

  addMessage(msg: ChatMessage): void {
    const tx = this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO messages (id, sessionId, role, content, toolCalls, toolResult, metrics, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        msg.id,
        msg.sessionId,
        msg.role,
        msg.content,
        msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        msg.toolResult ? JSON.stringify(msg.toolResult) : null,
        msg.metrics ? JSON.stringify(msg.metrics) : null,
        msg.createdAt
      )

      // 更新会话计数和时间
      const session = this.getSession(msg.sessionId)
      if (session) {
        const newCount = (session.messageCount || 0) + 1
        const now = new Date().toISOString()
        // 如果是第一条用户消息且标题为默认值，自动设置标题
        let title = session.title
        if (msg.role === 'user' && title === '新对话') {
          title = msg.content.slice(0, 50)
        }
        this.db.prepare(
          `UPDATE sessions SET messageCount = ?, updatedAt = ?, title = ? WHERE id = ?`
        ).run(newCount, now, title, msg.sessionId)
      }
    })
    tx()
  }

  getMessages(sessionId: string): ChatMessage[] {
    const rows = this.db.prepare(
      'SELECT * FROM messages WHERE sessionId = ? ORDER BY createdAt ASC'
    ).all(sessionId) as MessageRow[]
    return rows.map(rowToChatMessage)
  }

  // 搜索所有会话中的消息 — 使用 FTS5 全文索引替代 LOWER(content) LIKE 全表扫描
  searchMessages(query: string, limit: number = 20): Array<{ session: Session; message: ChatMessage }> {
    // 使用共享工具函数转义 FTS5 查询，防止特殊字符导致语法错误或注入
    const safeMatch = buildSafeFTSMatch(query)
    if (!safeMatch) return []

    const rows = this.db.prepare(
      `SELECT m.*, s.id as s_id, s.title as s_title, s.workspaceId as s_workspaceId,
              s.modelConfigId as s_modelConfigId, s.systemPrompt as s_systemPrompt,
              s.activeSkillIds as s_activeSkillIds, s.createdAt as s_createdAt,
              s.updatedAt as s_updatedAt, s.messageCount as s_messageCount,
              s.parentId as s_parentId
       FROM messages_fts f
       JOIN messages m ON m.rowid = f.rowid
       JOIN sessions s ON m.sessionId = s.id
       WHERE messages_fts MATCH ?
       ORDER BY s.updatedAt DESC
       LIMIT ?`
    ).all(safeMatch, limit) as SessionSearchRow[]

    return rows.map((row) => ({
      session: rowToSession({
        id: row.s_id,
        title: row.s_title,
        workspaceId: row.s_workspaceId,
        modelConfigId: row.s_modelConfigId,
        systemPrompt: row.s_systemPrompt,
        activeSkillIds: row.s_activeSkillIds,
        createdAt: row.s_createdAt,
        updatedAt: row.s_updatedAt,
        messageCount: row.s_messageCount,
      } as SessionRow),
      message: rowToChatMessage({
        id: row.id,
        sessionId: row.sessionId,
        role: row.role,
        content: row.content,
        toolCalls: row.toolCalls,
        toolResult: row.toolResult,
        metrics: row.metrics,
        createdAt: row.createdAt,
      }),
    }))
  }

  // ===== [升级] 会话搜索（增强版） =====

  /**
   * 搜索会话（返回匹配的消息和摘要）
   */
  searchSessions(query: string, opts?: {
    workspaceId?: string
    limit?: number
  }): SessionSearchResult[] {
    const limit = opts?.limit ?? 10
    const lowerQuery = query.toLowerCase()
    const results: SessionSearchResult[] = []

    // 先搜索标题匹配的会话
    let sessionRows: SessionRow[]
    if (opts?.workspaceId) {
      sessionRows = this.db.prepare(
        'SELECT * FROM sessions WHERE workspaceId = ? ORDER BY updatedAt DESC'
      ).all(opts.workspaceId) as SessionRow[]
    } else {
      sessionRows = this.db.prepare(
        'SELECT * FROM sessions ORDER BY updatedAt DESC'
      ).all() as SessionRow[]
    }

    // 收集需要搜索消息的会话（标题未匹配的）
    const sessionsToCheck = sessionRows.filter(r => !r.title.toLowerCase().includes(lowerQuery))

    // 单次批量查询替代 N+1：用 IN 子句一次拉取所有候选消息
    // 转义 LIKE 通配符（% 和 _）防止通配符注入
    if (sessionsToCheck.length > 0) {
      const placeholders = sessionsToCheck.map(() => '?').join(',')
      const escapedQuery = escapeLikePattern(lowerQuery)
      const allMsgRows = this.db.prepare(
        `SELECT * FROM messages WHERE sessionId IN (${placeholders}) AND LOWER(content) LIKE ? ESCAPE '\\'`
      ).all(...sessionsToCheck.map(s => s.id), `%${escapedQuery}%`) as MessageRow[]

      // 按 sessionId 分组
      const msgsBySession = new Map<string, MessageRow[]>()
      for (const msgRow of allMsgRows) {
        const list = msgsBySession.get(msgRow.sessionId)
        if (list) list.push(msgRow)
        else msgsBySession.set(msgRow.sessionId, [msgRow])
      }

      for (const row of sessionRows) {
        const session = rowToSession(row)

        // 搜索标题
        if (session.title.toLowerCase().includes(lowerQuery)) {
          results.push({ session, matchedMessages: [], matchCount: 1 })
          continue
        }

        const msgRows = msgsBySession.get(session.id) ?? []
        const matched: Array<{ message: ChatMessage; snippet: string }> = []

        for (const msgRow of msgRows) {
          const msg = rowToChatMessage(msgRow)
          const lowerContent = msg.content.toLowerCase()
          const idx = lowerContent.indexOf(lowerQuery)
          if (idx >= 0) {
            const start = Math.max(0, idx - 50)
            const end = Math.min(msg.content.length, idx + query.length + 50)
            const snippet = (start > 0 ? '...' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '...' : '')
            matched.push({ message: msg, snippet })
          }
        }

        if (matched.length > 0) {
          results.push({ session, matchedMessages: matched.slice(0, 5), matchCount: matched.length })
        }
      }
    } else {
      // 所有会话标题都匹配
      for (const row of sessionRows) {
        results.push({ session: rowToSession(row), matchedMessages: [], matchCount: 1 })
      }
    }

    return results
      .sort((a, b) => b.session.updatedAt.localeCompare(a.session.updatedAt))
      .slice(0, limit)
  }

  // ===== [升级] 会话导出 =====

  /**
   * 导出会话为 Markdown 或 JSON
   */
  exportSession(sessionId: string, options: SessionExportOptions): SessionExportResult | null {
    const session = this.getSession(sessionId)
    if (!session) return null

    const messages = this.getMessages(sessionId)

    let content = ''
    let filename = ''

    if (options.format === 'markdown') {
      content = this.exportToMarkdown(session, messages, options)
      filename = `${session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.md`
    } else {
      content = JSON.stringify({ session, messages }, null, 2)
      filename = `${session.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.json`
    }

    return {
      content,
      format: options.format,
      filename,
      messageCount: messages.length,
    }
  }

  /**
   * 将会话导出为 Markdown 格式
   */
  private exportToMarkdown(session: Session, messages: ChatMessage[], options: SessionExportOptions): string {
    const lines: string[] = []

    lines.push(`# ${session.title}`)
    lines.push('')
    lines.push(`> 创建时间: ${session.createdAt}`)
    lines.push(`> 更新时间: ${session.updatedAt}`)
    lines.push(`> 消息数: ${messages.length}`)
    lines.push('')
    lines.push('---')
    lines.push('')

    for (const msg of messages) {
      // 过滤系统消息
      if (!options.includeSystemMessages && msg.role === 'system') continue

      const roleLabel = {
        user: '👤 **用户**',
        assistant: '🤖 **助手**',
        system: '⚙️ **系统**',
        tool: '🔧 **工具**',
      }[msg.role] || msg.role

      lines.push(`### ${roleLabel}`)
      lines.push(`> ${msg.createdAt}`)
      lines.push('')
      lines.push(msg.content)
      lines.push('')

      // 工具调用
      if (options.includeToolCalls && msg.toolCalls && msg.toolCalls.length > 0) {
        lines.push('<details><summary>工具调用</summary>')
        lines.push('')
        for (const tc of msg.toolCalls) {
          lines.push(`- **${tc.name}**: \`\`\`${tc.arguments}\`\`\``)
        }
        lines.push('')
        lines.push('</details>')
        lines.push('')
      }

      // 工具结果
      if (options.includeToolCalls && msg.toolResult) {
        lines.push('<details><summary>工具结果</summary>')
        lines.push('')
        lines.push('```')
        lines.push(msg.toolResult.content.slice(0, 500))
        lines.push('```')
        lines.push('')
        lines.push('</details>')
        lines.push('')
      }

      // 指标
      if (options.includeMetrics && msg.metrics) {
        lines.push(`<sup>⏱ ${msg.metrics.duration}ms | 🔄 ${msg.metrics.totalTurns}轮 | 🔧 ${msg.metrics.totalTools}工具</sup>`)
        lines.push('')
      }

      lines.push('---')
      lines.push('')
    }

    return lines.join('\n')
  }

  // ===== [升级] 上下文窗口可视化 =====

  /**
   * 获取会话的上下文窗口信息
   */
  getSessionContextInfo(sessionId: string, contextWindowConfig: ContextWindowConfig): SessionContextInfo | null {
    const session = this.getSession(sessionId)
    if (!session) return null

    const messages = this.getMessages(sessionId)

    // 按角色统计
    const messagesByRole: Record<string, number> = {}
    let estimatedTokens = 0

    for (const msg of messages) {
      messagesByRole[msg.role] = (messagesByRole[msg.role] ?? 0) + 1
      // 粗略估算 token 数（1 token ≈ 4 字符）
      estimatedTokens += Math.ceil(msg.content.length / 4)
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          estimatedTokens += Math.ceil(tc.arguments.length / 4)
        }
      }
    }

    // 计算最旧消息的年龄
    const oldestMsg = messages[0]
    const oldestMessageAge = oldestMsg
      ? `${Math.floor((Date.now() - new Date(oldestMsg.createdAt).getTime()) / (1000 * 60 * 60))}小时前`
      : '无'

    // 判断是否需要压缩
    const wouldTriggerCompression =
      messages.length > contextWindowConfig.maxMessages &&
      contextWindowConfig.strategy === 'compress'

    return {
      sessionId,
      totalMessages: messages.length,
      estimatedTokens,
      contextWindowConfig,
      messagesByRole,
      oldestMessageAge,
      wouldTriggerCompression,
    }
  }

  /** 生命周期停止方法，别名调用 close() */
  stop(): void {
    this.close()
  }

  close(): void {
    this.db.close()
    // db 字段保持非空类型，因为 SessionStore 设计为单例长期存活
  }
}
