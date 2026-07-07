// AELA — 统一 Embedding 提供者
// 支持 OpenAI text-embedding-3-small（384 维）和本地降级到 HashEmbedding（128 维）
//
// 设计原则：
//   1. 统一接口：所有模块（SkillRouter / ToolRecommender / RAGService / MemoryService）共用
//   2. 自动降级：无 API Key 或网络失败时降级到 HashEmbedding，保证离线可用
//   3. 缓存：相同文本的嵌入结果缓存到内存，避免重复 API 调用
//   4. 批量处理：支持批量嵌入以减少 API 往返

import { HashEmbedding } from './HashEmbedding'

export type EmbeddingProvider = 'openai' | 'hash'

export interface EmbeddingConfig {
  provider: EmbeddingProvider
  /** OpenAI API Key（如果使用 openai provider） */
  apiKey?: string
  /** OpenAI API Base URL（支持兼容 API 如 Azure / 自建） */
  baseUrl?: string
  /** 嵌入模型名称 */
  model: string
  /** 向量维度 */
  dimensions: number
}

const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'hash',
  model: 'text-embedding-3-small',
  dimensions: 384,
}

// OpenAI 嵌入 API 的响应类型
interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>
  usage?: { prompt_tokens: number; total_tokens: number }
}

export class EmbeddingService {
  private config: EmbeddingConfig
  private hashEmbedding: HashEmbedding
  private cache = new Map<string, number[]>()
  private initialized = false

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    // HashEmbedding 始终初始化作为降级方案
    this.hashEmbedding = new HashEmbedding(this.config.dimensions)
  }

  /**
   * 设置 API Key 并切换到 OpenAI provider
   * 如果 API Key 无效或为空，保持 hash 模式
   */
  configureApiKey(apiKey: string, baseUrl?: string): void {
    if (apiKey && apiKey.length > 10) {
      this.config.apiKey = apiKey
      this.config.baseUrl = baseUrl
      this.config.provider = 'openai'
      this.config.dimensions = 384
      // 重新初始化 HashEmbedding 以匹配维度（降级时使用）
      this.hashEmbedding = new HashEmbedding(this.config.dimensions)
    } else {
      this.config.provider = 'hash'
      this.config.dimensions = 128
      this.hashEmbedding = new HashEmbedding(this.config.dimensions)
    }
    // 配置变更后清空缓存
    this.cache.clear()
    this.initialized = true
  }

  /**
   * 获取当前 provider 类型
   */
  getProvider(): EmbeddingProvider {
    return this.config.provider
  }

  /**
   * 获取向量维度
   */
  getDimensions(): number {
    return this.config.dimensions
  }

  /**
   * 嵌入单个文本
   * 自动缓存结果
   */
  async embed(text: string): Promise<number[]> {
    // 检查缓存
    const cacheKey = `${this.config.provider}:${text}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    let vector: number[]

    if (this.config.provider === 'openai' && this.config.apiKey) {
      try {
        vector = await this.embedWithOpenAI(text)
      } catch {
        // API 失败时降级到 hash
        vector = this.hashEmbedding.embed(text)
      }
    } else {
      // 默认使用 hash
      vector = this.hashEmbedding.embed(text)
    }

    // 缓存（限制缓存大小）
    if (this.cache.size > 10000) {
      // 简单的 LRU：清空前一半
      const keys = Array.from(this.cache.keys())
      for (let i = 0; i < keys.length / 2; i++) {
        this.cache.delete(keys[i])
      }
    }
    this.cache.set(cacheKey, vector)

    return vector
  }

  /**
   * 批量嵌入文本（OpenAI 支持批量 API，减少往返）
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.config.provider === 'openai' && this.config.apiKey) {
      // 检查哪些在缓存中
      const results: number[][] = new Array(texts.length)
      const uncachedIndices: number[] = []
      const uncachedTexts: string[] = []

      for (let i = 0; i < texts.length; i++) {
        const cacheKey = `${this.config.provider}:${texts[i]}`
        if (this.cache.has(cacheKey)) {
          results[i] = this.cache.get(cacheKey)!
        } else {
          uncachedIndices.push(i)
          uncachedTexts.push(texts[i])
        }
      }

      // 批量嵌入未缓存的
      if (uncachedTexts.length > 0) {
        try {
          const vectors = await this.embedBatchWithOpenAI(uncachedTexts)
          for (let i = 0; i < vectors.length; i++) {
            const idx = uncachedIndices[i]
            results[idx] = vectors[i]
            const cacheKey = `${this.config.provider}:${uncachedTexts[i]}`
            this.cache.set(cacheKey, vectors[i])
          }
        } catch {
          // 降级到逐个 hash
          for (let i = 0; i < uncachedTexts.length; i++) {
            const idx = uncachedIndices[i]
            results[idx] = this.hashEmbedding.embed(uncachedTexts[i])
          }
        }
      }

      return results
    }

    // Hash 模式：逐个嵌入（很快，无需批量优化）
    return texts.map(t => this.hashEmbedding.embed(t))
  }

  /**
   * 同步嵌入（仅 hash 模式可用）
   * 用于不方便改为 async 的调用点
   */
  embedSync(text: string): number[] {
    const cacheKey = `hash:${text}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    const vector = this.hashEmbedding.embed(text)
    this.cache.set(cacheKey, vector)
    return vector
  }

  /**
   * 获取配置信息（用于 UI 展示）
   */
  getInfo(): { provider: EmbeddingProvider; model: string; dimensions: number; cached: number } {
    return {
      provider: this.config.provider,
      model: this.config.model,
      dimensions: this.config.dimensions,
      cached: this.cache.size,
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  // ===== 私有方法 =====

  /**
   * 调用 OpenAI Embedding API
   */
  private async embedWithOpenAI(text: string): Promise<number[]> {
    const url = `${this.config.baseUrl || 'https://api.openai.com/v1'}/embeddings`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: text,
        dimensions: this.config.dimensions,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI Embedding API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse
    return data.data[0].embedding
  }

  /**
   * 批量调用 OpenAI Embedding API
   */
  private async embedBatchWithOpenAI(texts: string[]): Promise<number[][]> {
    const url = `${this.config.baseUrl || 'https://api.openai.com/v1'}/embeddings`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
        dimensions: this.config.dimensions,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI Embedding API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as OpenAIEmbeddingResponse
    return data.data.map(d => d.embedding)
  }
}

// 全局单例
let globalEmbeddingService: EmbeddingService | null = null

export function getEmbeddingService(): EmbeddingService {
  if (!globalEmbeddingService) {
    globalEmbeddingService = new EmbeddingService()
  }
  return globalEmbeddingService
}

export function initEmbeddingService(config: Partial<EmbeddingConfig>): EmbeddingService {
  globalEmbeddingService = new EmbeddingService(config)
  return globalEmbeddingService
}
