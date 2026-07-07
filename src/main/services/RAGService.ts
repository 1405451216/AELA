// RAG 管道服务
// [深度集成 SDK] 使用 SDK 原生 RAGStore（混合检索 + RRF 融合）+ RAGReranker + MMRReranker
// 替换自研 FTS / 向量搜索 / 混合融合逻辑
// 保持 AELA 公共 API 不变（文档加载 / 向量索引 / 混合检索 / 上下文注入）
// SDK 优势:
//   - RAGStore: TF-IDF FTS + 向量检索 + linear/RRF 融合 + over-fetch
//   - RAGReranker: 关键词重叠 + LLM 重排序
//   - MMRReranker: 最大边际相关性（相关性与多样性平衡）

import {
  VectorStore,
  createSplitter,
  RAGStore,
  RAGReranker,
  MMRReranker,
  // [SDK 集成] 高级文档加载器
  PDFLoader,
  DOCXLoader,
  type RAGDocument as SDKRAGDocument,
  type SplitterStrategy as SDKSplitterStrategy,
  type SplitterConfig as SDKSplitterConfig,
  type FusionMode as SDKFusionMode,
  type RAGFusionConfig as SDKRAGFusionConfig,
} from '@agentprimordia/sdk'
import type {
  RAGDocument,
  RAGChunk,
  RAGSearchResult,
  RAGConfig,
  RAGExtendedConfig,
} from '@shared/types'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { randomUUID } from 'crypto'
import Store from 'electron-store'

// RAGExtendedConfig 定义在 @shared/types/rag.ts — 此处通过 import 复用

// ===== 默认配置 =====

const DEFAULT_CONFIG: RAGExtendedConfig = {
  splitterStrategy: 'recursive',
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  enableHybrid: true,
  fusionMode: 'rrf',
  rrfK: 60,
  reranker: 'mmr',
  mmrLambda: 0.7,
  deduplicate: true,
}

// ===== 文本切分器 — 使用 SDK createSplitter =====

class TextSplitter {
  private config: RAGExtendedConfig
  private sdkSplitter: ReturnType<typeof createSplitter>

  constructor(config: RAGExtendedConfig) {
    this.config = config
    // 使用 SDK createSplitter，与 Go 端切分策略对齐
    const splitterConfig: SDKSplitterConfig = {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    }
    this.sdkSplitter = createSplitter(
      config.splitterStrategy as SDKSplitterStrategy,
      splitterConfig,
    )
  }

  split(text: string): string[] {
    // 委托给 SDK createSplitter 返回的 RAGTextSplitter
    return this.sdkSplitter.split(text)
  }
}

// ===== RAG 服务 =====

interface RAGStoreSchema {
  documents: RAGDocument[]
  chunks: Array<RAGChunk & { text: string }>
}

export class RAGService {
  private config: RAGExtendedConfig = { ...DEFAULT_CONFIG }
  private documents: Map<string, RAGDocument> = new Map()
  private chunks: Map<string, RAGChunk> = new Map()
  private chunkTexts: Map<string, string> = new Map() // chunkId -> content (for persistence)
  private vectorStore: VectorStore
  private vectorDim = 128
  private splitter: TextSplitter
  private persist: Store<RAGStoreSchema>
  private embeddingService: { embedSync: (text: string) => number[] } | null = null

  // [SDK 集成] SDK RAGStore — 混合检索引擎（TF-IDF FTS + 向量 + RRF 融合）
  private ragStore: RAGStore
  // [SDK 集成] SDK RAGReranker — 关键词重叠 + LLM 重排序
  private reranker: RAGReranker
  // [SDK 集成] SDK MMRReranker — 最大边际相关性重排序
  private mmrReranker: MMRReranker
  // [SDK 集成] SDK 文档加载器 — PDF/DOCX 格式支持
  private pdfLoader: PDFLoader
  private docxLoader: DOCXLoader

  constructor() {
    this.splitter = new TextSplitter(this.config)
    this.vectorStore = new VectorStore(this.vectorDim, {
      M: 16,
      efConstruction: 200,
      efSearch: 50,
    })
    this.persist = new Store<RAGStoreSchema>({
      name: 'aela-rag',
      defaults: { documents: [], chunks: [] },
    })

    // 初始化 SDK RAGStore — 使用与 AELA 相同的向量维度
    this.ragStore = new RAGStore(this.vectorDim, {
      topK: this.config.topK,
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap,
      fusion: {
        fusionMode: this.config.fusionMode,
        rrfK: this.config.rrfK,
      },
    })

    // 初始化 SDK 重排序器
    this.reranker = new RAGReranker() // 无 provider，使用关键词重叠模式
    this.mmrReranker = new MMRReranker({ lambda: this.config.mmrLambda })

    // [SDK 集成] 初始化 SDK 文档加载器
    this.pdfLoader = new PDFLoader()
    this.docxLoader = new DOCXLoader()

    // 从磁盘恢复
    this.restore()
  }

  /**
   * 从磁盘恢复文档和块 — 同步到 SDK RAGStore
   */
  private restore(): void {
    try {
      const docs = this.persist.get('documents', []) as RAGDocument[]
      const chunks = this.persist.get('chunks', []) as Array<RAGChunk & { text: string }>

      for (const doc of docs) {
        this.documents.set(doc.id, doc)
      }
      for (const chunk of chunks) {
        const { text, ...chunkData } = chunk
        this.chunks.set(chunk.id, chunkData)
        this.chunkTexts.set(chunk.id, text)

        // 重建旧向量索引（保持兼容）
        const vector = this.textToVector(text)
        try {
          this.vectorStore.add(chunk.id, vector, {
            documentId: chunk.documentId,
            source: chunk.metadata?.source ?? '',
          })
        } catch (err) { /* 忽略 */ console.error('[RAGService] 恢复向量数据失败:', err) }

        // 同步到 SDK RAGStore
        try {
          this.ragStore.addDocument({
            id: chunk.id,
            content: text,
            metadata: { ...chunk.metadata, parentDoc: chunk.documentId },
            source: chunk.metadata?.source ?? chunk.documentId,
            embedding: vector,
          })
        } catch (err) {
          console.error('[RAGService] 恢复到 SDK RAGStore 失败:', err)
        }
      }
      if (docs.length > 0) {
        console.log(`[RAGService] Restored ${docs.length} documents, ${chunks.length} chunks from disk`)
      }
    } catch (err) {
      console.error('[RAGService] Failed to restore:', err)
    }
  }

  /**
   * 持久化到磁盘
   */
  private persistAll(): void {
    try {
      const docs = Array.from(this.documents.values())
      const chunks = Array.from(this.chunks.values()).map(c => ({
        ...c,
        text: this.chunkTexts.get(c.id) ?? '',
      }))
      this.persist.set('documents', docs)
      this.persist.set('chunks', chunks)
    } catch (err) {
      console.error('[RAGService] Failed to persist:', err)
    }
  }

  /**
   * 更新 RAG 配置
   */
  setConfig(config: Partial<RAGExtendedConfig>): void {
    this.config = { ...this.config, ...config }
    this.splitter = new TextSplitter(this.config)

    // 更新 SDK RAGStore 融合配置
    if (config.fusionMode || config.rrfK) {
      this.ragStore.setFusionConfig({
        fusionMode: this.config.fusionMode,
        rrfK: this.config.rrfK,
      })
    }

    // 更新 MMR 重排序器
    if (config.mmrLambda !== undefined) {
      this.mmrReranker = new MMRReranker({ lambda: this.config.mmrLambda })
    }
  }

  getConfig(): RAGExtendedConfig {
    return { ...this.config }
  }

  /**
   * 获取 SDK RAGStore 统计信息
   */
  getRAGStoreStats(): { totalDocuments: number; totalChunks: number; vectorCount: number; vocabularySize: number } {
    return this.ragStore.stats()
  }

  /**
   * 获取当前融合配置
   */
  getFusionConfig(): Required<SDKRAGFusionConfig> {
    return this.ragStore.getFusionConfig()
  }

  /**
   * 从文件加载文档
   * [SDK 集成] 使用 SDK PDFLoader/DOCXLoader 处理二进制格式文档
   */
  async ingestFile(filePath: string, metadata?: Record<string, string>): Promise<{ documentId: string; chunkCount: number }> {
    const ext = extname(filePath).toLowerCase()
    let content: string

    // 根据文件扩展名选择加载器
    if (ext === '.pdf') {
      // SDK PDFLoader — 解析 PDF 流中的文本
      const buffer = await readFile(filePath)
      const doc = await this.pdfLoader.load(buffer, filePath)
      content = doc.content
    } else if (ext === '.docx') {
      // SDK DOCXLoader — 解析 DOCX XML 中的文本
      const buffer = await readFile(filePath)
      const doc = await this.docxLoader.load(buffer, filePath)
      content = doc.content
    } else {
      // 纯文本格式 (.txt/.md/.json/.code 等) 直接读取
      content = await readFile(filePath, 'utf-8')
    }

    const ragDoc: RAGDocument = {
      id: randomUUID(),
      source: filePath,
      content,
      metadata: { ...metadata, ext },
    }
    return this.ingestDocument(ragDoc)
  }

  /**
   * 从文本加载文档
   */
  async ingestText(source: string, content: string, metadata?: Record<string, string>): Promise<{ documentId: string; chunkCount: number }> {
    const doc: RAGDocument = {
      id: randomUUID(),
      source,
      content,
      metadata,
    }
    return this.ingestDocument(doc)
  }

  /**
   * 加载文档 (内部方法)
   * 文档同时存入 AELA Maps + 旧 VectorStore + SDK RAGStore
   */
  async ingestDocument(doc: RAGDocument): Promise<{ documentId: string; chunkCount: number }> {
    // 存储文档
    this.documents.set(doc.id, doc)

    // 切分文本
    const chunkTexts = this.splitter.split(doc.content)
    let chunkCount = 0

    for (let i = 0; i < chunkTexts.length; i++) {
      const chunkId = randomUUID()
      const chunkContent = chunkTexts[i]
      const chunk: RAGChunk = {
        id: chunkId,
        documentId: doc.id,
        content: chunkContent,
        index: i,
        metadata: {
          ...doc.metadata,
          source: doc.source,
        },
      }
      this.chunks.set(chunkId, chunk)
      this.chunkTexts.set(chunkId, chunkContent)

      // 向量化
      const vector = this.textToVector(chunkContent)

      // 存入旧向量索引（保持兼容）
      try {
        this.vectorStore.add(chunkId, vector, {
          documentId: doc.id,
          source: doc.source,
        })
      } catch (err) {
        console.error('[RAGService] vectorStore.add failed:', err)
      }

      // [SDK 集成] 存入 SDK RAGStore — 同时建立 FTS 倒排索引 + 向量索引
      try {
        await this.ragStore.addDocument({
          id: chunkId,
          content: chunkContent,
          metadata: { ...doc.metadata, parentDoc: doc.id, chunkIndex: String(i), source: doc.source },
          source: doc.source,
          embedding: vector,
        })
      } catch (err) {
        console.error('[RAGService] SDK RAGStore addDocument 失败:', err)
      }

      chunkCount++
    }

    this.persistAll()

    return { documentId: doc.id, chunkCount }
  }

  /**
   * 搜索 — [SDK 集成] 使用 SDK RAGStore.hybridSearch + RAGReranker/MMRReranker
   */
  async search(query: string, topK?: number): Promise<RAGSearchResult[]> {
    const k = topK ?? this.config.topK

    if (this.config.enableHybrid) {
      return this.sdkHybridSearch(query, k)
    }
    // 非混合模式：仅向量搜索
    return this.vectorSearch(query, k)
  }

  /**
   * [SDK 集成] SDK RAGStore 混合搜索 + 重排序
   * 使用 SDK 的 TF-IDF FTS + 向量检索 + linear/RRF 融合
   * 然后用 RAGReranker 或 MMRReranker 进行重排序
   */
  private async sdkHybridSearch(query: string, topK: number): Promise<RAGSearchResult[]> {
    // 1. 向量化查询
    const queryEmbedding = this.textToVector(query)

    // 2. SDK RAGStore 混合搜索（over-fetch 以提升重排序召回率）
    const fetchK = Math.min(topK * 3, topK + 10)
    let sdkResults: SDKRAGDocument[]
    try {
      sdkResults = await this.ragStore.hybridSearch(query, fetchK, queryEmbedding)
    } catch (err) {
      console.error('[RAGService] SDK RAGStore hybridSearch 失败，回退到自研搜索:', err)
      return this.fallbackHybridSearch(query, topK)
    }

    if (sdkResults.length === 0) {
      // SDK 搜索无结果，回退到自研
      return this.fallbackHybridSearch(query, topK)
    }

    // 3. 重排序
    let reranked = sdkResults
    const reranker = this.config.reranker ?? 'mmr'
    const deduplicate = this.config.deduplicate ?? true

    if (reranker === 'mmr') {
      // MMR 重排序：平衡相关性与多样性
      try {
        reranked = await this.mmrReranker.rerank(query, sdkResults, {
          topK,
          deduplicate,
        })
      } catch (err) {
        console.error('[RAGService] MMR 重排序失败，跳过:', err)
      }
    } else if (reranker === 'simple') {
      // 简单关键词重叠重排序
      try {
        reranked = await this.reranker.rerank(query, sdkResults, {
          topK,
          deduplicate,
        })
      } catch (err) {
        console.error('[RAGService] RAGReranker 重排序失败，跳过:', err)
      }
    }

    // 4. 转换为 AELA RAGSearchResult 格式
    return reranked.slice(0, topK).map(doc => {
      const chunkId = doc.id
      const chunk = this.chunks.get(chunkId)
      return {
        chunkId,
        documentId: chunk?.documentId ?? doc.metadata?.parentDoc ?? '',
        content: doc.content,
        score: doc.score ?? 0,
        sources: doc.sources ?? [],
        metadata: chunk?.metadata ?? doc.metadata,
      }
    })
  }

  /**
   * 回退到自研混合搜索（SDK 不可用时）
   */
  private async fallbackHybridSearch(query: string, topK: number): Promise<RAGSearchResult[]> {
    // 1. FTS 全文搜索
    const ftsResults = this.ftsSearch(query, topK)
    const resultMap = new Map<string, RAGSearchResult>()

    for (let i = 0; i < ftsResults.length; i++) {
      const r = ftsResults[i]
      const score = 0.7 * (1.0 - i * 0.05)
      resultMap.set(r.chunkId, {
        ...r,
        score: Math.max(score, 0.3),
        sources: ['fts'],
      })
    }

    // 2. 向量搜索
    const vecResults = this.vectorSearch(query, topK)
    for (const vr of vecResults) {
      const existing = resultMap.get(vr.chunkId)
      if (existing) {
        existing.score = existing.score * 0.4 + vr.score * 0.6
        existing.sources.push('vector')
      } else {
        resultMap.set(vr.chunkId, {
          ...vr,
          score: vr.score * 0.6,
          sources: ['vector'],
        })
      }
    }

    // 排序并截取
    const results = Array.from(resultMap.values()).sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  /**
   * 全文搜索 (简单关键词匹配) — 仅作回退使用
   */
  private ftsSearch(query: string, topK: number): RAGSearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)
    const scored: Array<{ chunkId: string; score: number }> = []

    for (const [chunkId, text] of this.chunkTexts) {
      const lowerText = text.toLowerCase()
      let score = 0
      for (const term of terms) {
        const count = (lowerText.match(new RegExp(term, 'g')) ?? []).length
        score += count
      }
      if (score > 0) {
        scored.push({ chunkId, score: score / terms.length })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK).map(s => {
      const chunk = this.chunks.get(s.chunkId)!
      return {
        chunkId: s.chunkId,
        documentId: chunk.documentId,
        content: chunk.content,
        score: s.score,
        sources: [],
        metadata: chunk.metadata,
      }
    })
  }

  /**
   * 向量搜索 — 仅作回退使用
   */
  private vectorSearch(query: string, topK: number): RAGSearchResult[] {
    const queryVector = this.textToVector(query)
    try {
      const results = this.vectorStore.search(queryVector, topK)
      return results.map(r => {
        const chunk = this.chunks.get(r.id)
        return {
          chunkId: r.id,
          documentId: chunk?.documentId ?? '',
          content: chunk?.content ?? '',
          score: r.score,
          sources: [],
          metadata: chunk?.metadata,
        }
      })
    } catch {
      return []
    }
  }

  /**
   * 清空所有文档
   */
  clear(): void {
    this.documents.clear()
    this.chunks.clear()
    this.chunkTexts.clear()
    // 重建向量存储
    this.vectorStore = new VectorStore(this.vectorDim, {
      M: 16,
      efConstruction: 200,
      efSearch: 50,
    })
    // 重建 SDK RAGStore
    this.ragStore.clear()
    this.persist.clear()
  }

  /**
   * 统计
   */
  stats(): { documents: number; chunks: number; vectorDim: number } {
    return {
      documents: this.documents.size,
      chunks: this.chunks.size,
      vectorDim: this.vectorDim,
    }
  }

  /**
   * 格式化 RAG 上下文
   */
  formatContext(results: RAGSearchResult[]): string {
    if (results.length === 0) return ''
    const header = '=== 相关文档 ===\n'
    const footer = '=== 文档结束 ===\n'
    const body = results.map((r, i) => {
      const source = r.metadata?.source ?? 'unknown'
      return `[${i + 1}] (相关度: ${r.score.toFixed(2)}, 来源: ${source})\n${r.content}`
    }).join('\n\n')
    return header + body + '\n' + footer
  }

  /**
   * 设置 Embedding 服务（由 ServiceBootstrap 注入）
   */
  setEmbeddingService(service: { embedSync: (text: string) => number[] }): void {
    this.embeddingService = service
  }

  /**
   * 向量化 — 优先使用 EmbeddingService，降级到 hash trick
   */
  private textToVector(text: string): number[] {
    if (this.embeddingService) {
      return this.embeddingService.embedSync(text)
    }
    // 降级：hash-based bag-of-words
    const vector = new Array(this.vectorDim).fill(0)
    const tokens = text.toLowerCase().split(/[\s\p{P}]+/u).filter(t => t.length > 0)

    for (const token of tokens) {
      let hash = 0
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0
      }
      const idx = Math.abs(hash) % this.vectorDim
      vector[idx] += 1
    }

    // L2 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm
      }
    }

    return vector
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
