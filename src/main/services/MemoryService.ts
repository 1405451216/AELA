// 情景记忆服务
// 基于 SQLiteStore (better-sqlite3) + FTS5 全文索引 + VectorStore (HNSW) 语义检索
// [重构] 集成 SDK LongTermMemory 的混合搜索评分策略（lexical + semantic + recency + importance）
// 提供跨会话记忆: 情景存储 / FTS5 全文搜索 / 向量语义检索 / 重要性 / 时间线 / 自动过期 / 混合搜索

import { VectorStore } from '@agentprimordia/sdk'
import type { Memory, Provider } from '@agentprimordia/sdk'
// [SDK 集成] 记忆摘要 + 压缩器
import { SimpleSummarizer, LLMSummarizer, Compressor, LLMCompressSummarizer, type SummaryResult } from '@agentprimordia/sdk'
import type { MemoryEpisode, MemoryStats, MemoryCompressConfig, MemoryCompressResult, MemoryFTSResult, MemoryFTSStats } from '@shared/types'
import { SqliteMemoryStore } from './SqliteMemoryStore'
import { randomUUID } from 'crypto'
import Store from 'electron-store'
import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export class MemoryService {
  private store: SqliteMemoryStore
  private vectorStore: VectorStore
  private vectorDim = 128
  // [SDK 集成] Embedding 服务（注入后使用 OpenAI 语义嵌入替代 hash trick）
  private embeddingService: { embedSync: (text: string) => number[] } | null = null
  // [SDK 集成] 简单摘要器（无 LLM，正则提取关键词）
  private simpleSummarizer: SimpleSummarizer
  // [SDK 集成] SDK Compressor 实例（懒初始化，需要 Provider）
  private sdkCompressor: Compressor | null = null

  /** 启动时仅加载最近 N 条到向量索引，剩余在后台懒加载 */
  private static readonly STARTUP_LOAD_LIMIT = 1000

  constructor(dbPath?: string) {
    const dbFile = dbPath ?? join(app.getPath('userData'), 'aela-memory.db')
    this.store = new SqliteMemoryStore(dbFile)
    this.vectorStore = new VectorStore(this.vectorDim, {
      M: 16,
      efConstruction: 200,
      efSearch: 50,
    })
    this.simpleSummarizer = new SimpleSummarizer(200)

    // 异步启动：迁移 + 加载最近批次，不阻塞构造函数
    this.startupRestore()
  }

  /**
   * 启动恢复：迁移旧数据 + 加载最近批次到向量索引
   * 剩余数据在后台异步加载，不阻塞窗口渲染
   */
  private startupRestore(): void {
    this.migrateFromElectronStore()
      .then(() => this.store.list({ limit: MemoryService.STARTUP_LOAD_LIMIT, ascending: false }))
      .then(episodes => {
        for (const ep of episodes) {
          const vector = this.textToVector(ep.content)
          try {
            this.vectorStore.add(ep.id, vector, {
              sessionId: ep.sessionId,
              role: ep.role,
              summary: ep.summary ?? '',
            })
          } catch (err) { console.error('[MemoryService] 恢复记忆向量失败:', err) }
        }
        const ftsStats = this.store.ftsStats()
        console.log(`[MemoryService] Startup: loaded ${episodes.length} recent episodes, FTS5: ${ftsStats.totalDocuments} docs, ${ftsStats.indexSizeKB} KB`)
        // 后台加载剩余数据
        this.backgroundRestore()
      })
      .catch(err => console.error('[MemoryService] Startup restore failed:', err))
  }

  /**
   * 后台懒加载：分批加载剩余记忆到向量索引
   * 每批 5000 条，批次间让出事件循环避免阻塞
   */
  private async backgroundRestore(): Promise<void> {
    try {
      const stats = await this.store.stats()
      const total = stats.totalEpisodes
      const loaded = this.vectorStore.count()

      if (loaded >= total) return

      const batchSize = 5000
      let offset = loaded

      while (offset < total) {
        const batch = await this.store.list({ limit: batchSize, offset, ascending: true })
        if (batch.length === 0) break

        for (const ep of batch) {
          const vector = this.textToVector(ep.content)
          try {
            this.vectorStore.add(ep.id, vector, {
              sessionId: ep.sessionId,
              role: ep.role,
              summary: ep.summary ?? '',
            })
          } catch { /* ignore */ }
        }

        offset += batch.length
        // 让出事件循环，避免阻塞 UI
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      console.log(`[MemoryService] Background restore complete: ${this.vectorStore.count()}/${total} episodes in vector index`)
    } catch (err) {
      console.error('[MemoryService] Background restore failed:', err)
    }
  }

  /** 获取向量索引当前大小 */
  getVectorIndexSize(): number {
    return this.vectorStore.count()
  }

  /**
   * 从旧版 electron-store 迁移数据到 SQLite（一次性）
   * 检测条件: electron-store 数据文件存在且 SQLite 中无数据
   */
  private async migrateFromElectronStore(): Promise<void> {
    try {
      const stats = await this.store.stats()
      if (stats.totalEpisodes > 0) {
        // SQLite 已有数据，无需迁移
        return
      }

      // 检查 electron-store 数据文件是否存在
      const oldStorePath = join(app.getPath('userData'), 'aela-memory.json')
      if (!existsSync(oldStorePath)) {
        return
      }

      // 读取旧数据
      const oldStore = new Store<{ episodes: MemoryEpisode[] }>({
        name: 'aela-memory',
        defaults: { episodes: [] },
      })
      const oldEpisodes = oldStore.get('episodes', [])

      if (oldEpisodes.length === 0) {
        return
      }

      console.log(`[MemoryService] Migrating ${oldEpisodes.length} episodes from electron-store to SQLite...`)

      // 批量导入到 SQLite
      const imported = await this.store.batchImport(oldEpisodes)

      console.log(`[MemoryService] Migration complete: ${imported} episodes imported to SQLite`)

      // 标记旧文件已迁移（重命名而非删除，以防需要回滚）
      try {
        renameSync(oldStorePath, oldStorePath + '.migrated')
      } catch {
        // 重命名失败不影响主流程
      }
    } catch (err) {
      console.error('[MemoryService] Migration from electron-store failed:', err)
    }
  }

  /**
   * 添加情景记忆
   * SQLite 存储 + FTS5 自动同步 + 向量索引
   */
  async addEpisode(episode: MemoryEpisode): Promise<void> {
    await this.store.add(episode)

    // 生成简化向量 (hash-based bag-of-words) 加入 HNSW 索引
    const vector = this.textToVector(episode.content)
    try {
      this.vectorStore.add(episode.id, vector, {
        sessionId: episode.sessionId,
        role: episode.role,
        summary: episode.summary ?? '',
      })
    } catch (err) {
      console.error('[MemoryService] vector index add failed:', err)
    }
  }

  /**
   * 全文搜索 (LIKE 模糊匹配，兼容旧接口)
   * 推荐使用 ftsSearch 获得更好的性能和相关性排序
   */
  async search(query: string, opts?: {
    sessionId?: string
    limit?: number
    offset?: number
    roleFilter?: string
  }): Promise<MemoryEpisode[]> {
    return this.store.search(query, opts)
  }

  // ===== FTS5 全文搜索 =====

  /**
   * FTS5 全文搜索（BM25 评分 + CJK 分词）
   * 基于 SQLite FTS5 虚拟表，O(log n) 查询
   */
  async ftsSearch(query: string, opts?: {
    sessionId?: string
    limit?: number
  }): Promise<MemoryFTSResult[]> {
    return this.store.ftsSearch(query, opts)
  }

  /**
   * FTS 索引统计
   */
  ftsStats(): MemoryFTSStats {
    return this.store.ftsStats()
  }

  /**
   * 手动重建 FTS 索引
   */
  async rebuildFTSIndex(): Promise<MemoryFTSStats> {
    return this.store.rebuildFTS()
  }

  /**
   * 语义向量搜索 (HNSW O(log n))
   */
  async vectorSearch(query: string, topK: number = 5): Promise<Array<{
    id: string
    score: number
    metadata?: Record<string, string>
  }>> {
    const queryVector = this.textToVector(query)
    return this.vectorStore.search(queryVector, topK)
  }

  /**
   * 混合搜索: FTS5 + 向量
   * FTS5 提供精确匹配 + BM25 排序，向量搜索补充语义相关结果
   */
  async hybridSearch(query: string, opts?: {
    sessionId?: string
    limit?: number
  }): Promise<MemoryEpisode[]> {
    const limit = opts?.limit ?? 10

    // 1. FTS5 全文搜索（BM25 排序）
    const ftsResults = await this.ftsSearch(query, { ...opts, limit })

    // 2. 向量搜索
    const vectorResults = await this.vectorSearch(query, limit)

    // 3. 合并去重 (向量结果补充 FTS 结果)
    const seen = new Set(ftsResults.map(e => e.id))
    const result: MemoryEpisode[] = ftsResults.map(r => r.episode)

    for (const vr of vectorResults) {
      if (seen.has(vr.id)) continue
      const episode = await this.store.get(vr.id)
      if (episode && (!opts?.sessionId || episode.sessionId === opts.sessionId)) {
        result.push(episode)
        seen.add(vr.id)
      }
    }

    return result.slice(0, limit)
  }

  /**
   * 获取单条记忆
   */
  async get(id: string): Promise<MemoryEpisode | null> {
    return this.store.get(id)
  }

  /**
   * 删除记忆
   * SQLite + FTS5 自动同步删除 + 向量索引删除
   */
  async delete(id: string): Promise<void> {
    await this.store.delete(id)
    this.vectorStore.delete(id)
  }

  /**
   * 列出记忆
   */
  async list(opts?: {
    sessionId?: string
    limit?: number
    offset?: number
    ascending?: boolean
  }): Promise<MemoryEpisode[]> {
    return this.store.list(opts)
  }

  /**
   * 按标签搜索
   */
  async searchByTag(tag: string, opts?: {
    sessionId?: string
    limit?: number
  }): Promise<MemoryEpisode[]> {
    return this.store.searchByTag(tag, opts)
  }

  /**
   * 获取重要记忆
   */
  async getImportant(threshold: number = 0.7, limit: number = 10): Promise<MemoryEpisode[]> {
    return this.store.getImportant(threshold, limit)
  }

  /**
   * 获取时间线
   */
  async getTimeline(days: number = 30): Promise<Record<string, MemoryEpisode[]>> {
    return this.store.getTimeline(days)
  }

  /**
   * 更新摘要 — SQLite + FTS5 自动同步
   */
  async updateSummary(id: string, summary: string, topics: string): Promise<void> {
    await this.store.updateSummary(id, summary, topics)
  }

  /**
   * 设置重要性
   */
  async setImportance(id: string, importance: number): Promise<void> {
    await this.store.setImportance(id, importance)
  }

  /**
   * 清理过期记忆 — SQLite + FTS5 自动同步删除
   */
  async cleanupExpired(maxAgeDays: number = 90): Promise<number> {
    return this.store.cleanupExpired(maxAgeDays)
  }

  /**
   * 压缩旧记忆 — 移植自 AP Go 核心层 memory/compressor.go
   * 将超过窗口期的旧条目合并为摘要, 保留最近 N 条不压缩
   * [SDK 集成] 可选使用 SDK Compressor + LLMSummarizer 进行 LLM 驱动的智能压缩
   */
  async compress(config?: Partial<MemoryCompressConfig>): Promise<MemoryCompressResult> {
    const cfg: MemoryCompressConfig = {
      windowSize: config?.windowSize ?? 20,
      minEpisodes: config?.minEpisodes ?? 10,
      ttlHours: config?.ttlHours ?? 24,
    }

    const allEpisodes = await this.store.list({ limit: 10000 })
    if (allEpisodes.length < cfg.minEpisodes) {
      return { compressed: 0, summary: '', tags: [] }
    }

    // 按时间排序 (旧 -> 新)
    const sorted = [...allEpisodes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // 分离可压缩和保留的
    const cutoff = sorted.length - cfg.windowSize
    if (cutoff <= 0) {
      return { compressed: 0, summary: '', tags: [] }
    }

    // TTL 过滤: 只压缩超过 TTL 的条目
    const ttlMs = cfg.ttlHours * 60 * 60 * 1000
    const now = Date.now()
    const toCompress = sorted.slice(0, cutoff).filter(
      ep => now - new Date(ep.createdAt).getTime() > ttlMs
    )

    if (toCompress.length < 2) {
      return { compressed: 0, summary: '', tags: [] }
    }

    // 生成摘要 (简化版: 提取关键内容)
    const summaryParts = toCompress.map(ep => {
      const content = ep.summary || ep.content
      return `[${ep.role}] ${content.slice(0, 100)}`
    })
    const summary = `压缩了 ${toCompress.length} 条记忆:\n${summaryParts.join('\n')}`

    // 提取标签
    const tagSet = new Set<string>()
    for (const ep of toCompress) {
      if (ep.topics) {
        ep.topics.split(',').forEach(t => tagSet.add(t.trim()))
      }
    }
    const tags = Array.from(tagSet)

    // 删除旧条目 (SQLite + FTS5 自动同步)
    for (const ep of toCompress) {
      await this.store.delete(ep.id)
      this.vectorStore.delete(ep.id)
    }

    // 将摘要存为一条新记忆
    const compressedEpisode: MemoryEpisode = {
      id: randomUUID(),
      sessionId: 'compressed',
      role: 'system',
      content: summary,
      summary,
      topics: tags.join(', '),
      importance: 0.5,
      metadata: { type: 'compressed', originalCount: String(toCompress.length) },
      createdAt: new Date().toISOString(),
    }
    await this.store.add(compressedEpisode)

    return { compressed: toCompress.length, summary, tags }
  }

  // ===== [增强] 重要性衰减 — 对齐 SDK LongTermMemory.applyImportanceDecay() =====

  /**
   * 应用重要性衰减 — 随时间推移降低旧记忆的重要性
   *
   * 移植自 SDK LongTermMemory.applyImportanceDecay()，适配 AELA 的 SQLite 存储。
   * 每条记忆的重要性按指数衰减：decayedImportance = importance * (decayFactor ^ ageDays)
   * 仅当衰减幅度超过 0.01 时才更新，避免无意义的写入。
   *
   * @param decayFactor 每天衰减比例（默认 0.95，即每天衰减 5%）
   */
  async applyImportanceDecay(decayFactor: number = 0.95): Promise<{ processed: number; updated: number }> {
    const allEpisodes = await this.store.list({ limit: 100000 })
    const now = Date.now()
    let updated = 0

    for (const ep of allEpisodes) {
      if (ep.importance === undefined || ep.importance === null) continue

      const ageDays = (now - new Date(ep.createdAt).getTime()) / 86400000
      const decayedImportance = ep.importance * Math.pow(decayFactor, ageDays)

      if (Math.abs(decayedImportance - ep.importance) > 0.01) {
        await this.store.setImportance(ep.id, decayedImportance)
        updated++
      }
    }

    console.log(`[MemoryService] Importance decay applied: ${updated}/${allEpisodes.length} episodes updated (decayFactor=${decayFactor})`)
    return { processed: allEpisodes.length, updated }
  }

  // ===== [SDK 集成] SDK Compressor + Summarizer =====

  /**
   * 使用 SDK SimpleSummarizer 提取摘要（无 LLM，正则关键词提取）
   * 适用于离线场景或降级策略
   */
  async extractSimpleSummary(content: string): Promise<SummaryResult> {
    return this.simpleSummarizer.extractSummary(content)
  }

  /**
   * 创建 SDK LLM 驱动的摘要器
   * @param provider LLM Provider 实例
   * @param model 模型名（建议用 flash/mini 版本降低成本）
   */
  createLLMSummarizer(provider: Provider, model?: string): LLMSummarizer {
    return new LLMSummarizer({ provider, model, maxRetries: 1, maxSummaryLen: 500 })
  }

  /**
   * 使用 SDK Compressor 进行 LLM 驱动的记忆压缩
   * 比自研 compress 方法更智能：使用 LLM 提取摘要和标签
   * @param provider LLM Provider 实例
   * @param config 压缩配置
   */
  async compressWithSDK(
    provider: Provider,
    config?: { windowSize?: number; minEpisodes?: number; model?: string },
  ): Promise<MemoryCompressResult> {
    // 创建 Compressor（LLM 驱动的摘要器）
    const summarizer = new LLMSummarizer({
      provider,
      model: config?.model,
      maxRetries: 1,
      maxSummaryLen: 500,
    })
    const compressor = new Compressor({
      windowSize: config?.windowSize ?? 20,
      minEpisodes: config?.minEpisodes ?? 10,
      summarizer: new LLMCompressSummarizer(summarizer),
    })

    // 使用 SDK Compressor 压缩
    // 注意：SDK Compressor 操作 Memory 接口，AELA 的 store 实现了该接口
    const result = await compressor.compress(this.store as unknown as Memory)
    if (!result) {
      return { compressed: 0, summary: '', tags: [] }
    }

    // 重建向量索引
    const allEpisodes = await this.store.list({ limit: 100000 })
    for (const ep of allEpisodes) {
      if (ep.metadata?.compressed === 'true') {
        const vector = this.textToVector(ep.content)
        try {
          this.vectorStore.add(ep.id, vector, {
            sessionId: ep.sessionId,
            role: ep.role,
            summary: ep.summary ?? '',
          })
        } catch (err) {
          console.error('[MemoryService] vectorStore.add failed:', err)
        }
      }
    }

    return {
      compressed: parseInt((allEpisodes.find(e => e.metadata?.compressed === 'true')?.metadata?.originalCount as string) ?? '0'),
      summary: result.text,
      tags: result.tags,
    }
  }

  /**
   * 统计
   */
  async stats(): Promise<MemoryStats> {
    return this.store.stats()
  }

  /**
   * 获取底层 Memory 接口 (供 OrchestrationService 等复用)
   *
   * 注：SqliteMemoryStore 实际实现了 Memory 接口的全部方法，
   * 但 @shared/types 的 MemoryEpisode.role 是 string，
   * SDK 的同名类型是字面量联合，存在类型演进差异。
   * 此处通过 unknown 边界转换保留运行期契约。
   */
  getStore(): Memory {
    return this.store as unknown as Memory
  }

  /**
   * [SDK 集成] 混合搜索 — 融合 FTS 全文搜索 + 向量语义搜索 + 时间衰减 + 重要性加成
   * 对齐 SDK LongTermMemory.hybridSearch 的评分策略
   */
  async hybridSearchScored(query: string, limit = 10, options?: {
    lexicalWeight?: number
    semanticWeight?: number
    recencyWeight?: number
    importanceWeight?: number
  }): Promise<Array<{
    episode: MemoryEpisode
    score: number
    components: { lexical: number; semantic: number; recency: number; importance: number }
  }>> {
    const w = {
      lexical: options?.lexicalWeight ?? 0.3,
      semantic: options?.semanticWeight ?? 0.4,
      recency: options?.recencyWeight ?? 0.15,
      importance: options?.importanceWeight ?? 0.15,
    }

    // 1. FTS 全文搜索
    const ftsResults = await this.store.ftsSearch(query, { limit: limit * 3 })
    const ftsMap = new Map(ftsResults.map(r => [r.episode.id, r.score]))

    // 2. 向量语义搜索
    const queryVector = this.textToVector(query)
    const vectorResults = this.vectorStore.search(queryVector, limit * 3)
    const semanticMap = new Map(vectorResults.map(r => [r.id, r.score]))

    // 3. 合并候选集
    const candidateIds = new Set([...ftsMap.keys(), ...semanticMap.keys()])
    const allEpisodes = await this.store.list({ limit: 100000 })
    const episodeMap = new Map(allEpisodes.map(e => [e.id, e]))

    // 4. 计算混合评分
    const now = Date.now()
    const results: Array<{
      episode: MemoryEpisode
      score: number
      components: { lexical: number; semantic: number; recency: number; importance: number }
    }> = []

    for (const id of candidateIds) {
      const ep = episodeMap.get(id)
      if (!ep) continue

      const lexical = ftsMap.get(id) ?? 0
      const semantic = semanticMap.get(id) ?? 0

      // 时间衰减：半衰期 7 天
      const ageDays = (now - new Date(ep.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      const recency = Math.exp(-ageDays / 7)

      // 重要性加成
      const importance = ep.importance ?? 0.5

      const score = w.lexical * lexical + w.semantic * semantic + w.recency * recency + w.importance * importance

      results.push({
        episode: ep,
        score,
        components: { lexical, semantic, recency, importance },
      })
    }

    // 5. 按综合得分排序
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  /**
   * 设置 Embedding 服务（由 ServiceBootstrap 注入）
   */
  setEmbeddingService(service: { embedSync: (text: string) => number[] }): void {
    this.embeddingService = service
  }

  /**
   * 将文本转为向量
   * 优先使用 EmbeddingService（OpenAI 语义嵌入），降级到本地 hash trick
   */
  private textToVector(text: string): number[] {
    if (this.embeddingService) {
      return this.embeddingService.embedSync(text)
    }
    // 降级：简单 hash trick
    const vector = new Array(this.vectorDim).fill(0)
    const tokens = text.toLowerCase().split(/[\s\p{P}]+/u).filter(t => t.length > 0)
    for (const token of tokens) {
      let hash = 0
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0
      }
      vector[Math.abs(hash) % this.vectorDim] += 1
    }
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
    return norm > 0 ? vector.map(v => v / norm) : vector
  }

  /** 生命周期停止方法，别名调用 close() */
  stop(): void {
    this.close()
  }

  close(): void {
    this.store.close()
  }
}
