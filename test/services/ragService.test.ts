/**
 * RAGService 单元测试
 *
 * 覆盖: 配置管理（getConfig/setConfig/getFusionConfig）/ 文本切分（split）
 *       上下文格式化（formatContext）/ 文档摄取（ingestText）+ 统计（stats）/ 清空（clear）
 *
 * 通过 vi.mock 隔离 @agentprimordia/sdk 与 electron-store，使测试不依赖原生/网络 Embedding，
 * 聚焦验证 RAGService 自身逻辑（切分、配置、持久化映射、格式化）。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const sdk = vi.hoisted(() => {
  class VectorStore {
    constructor(_dim: unknown, _opts: unknown) {}
    add(_id: string, _vec: number[], _meta: unknown) {}
    clear() {}
  }
  const createSplitter = (_strategy: unknown, _cfg: unknown) => ({
    split: (text: string) =>
      text
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean),
  })
  class RAGStore {
    constructor(_dim: unknown, _opts: unknown) {}
    async addDocument(_doc: unknown) {}
    stats() {
      return { totalDocuments: 0, totalChunks: 0, vectorCount: 0, vocabularySize: 0 }
    }
    getFusionConfig() {
      return { fusionMode: 'rrf', rrfK: 60, lambda: 0.7 }
    }
    clear() {}
    search(_q: string, _k: number) {
      return []
    }
  }
  class RAGReranker {
    constructor() {}
  }
  class MMRReranker {
    constructor(_opts: unknown) {}
  }
  class PDFLoader {
    constructor() {}
    async load() {
      return { content: '' }
    }
  }
  class DOCXLoader {
    constructor() {}
    async load() {
      return { content: '' }
    }
  }
  return { VectorStore, createSplitter, RAGStore, RAGReranker, MMRReranker, PDFLoader, DOCXLoader }
})

vi.mock('@agentprimordia/sdk', () => ({
  VectorStore: sdk.VectorStore,
  createSplitter: sdk.createSplitter,
  RAGStore: sdk.RAGStore,
  RAGReranker: sdk.RAGReranker,
  MMRReranker: sdk.MMRReranker,
  PDFLoader: sdk.PDFLoader,
  DOCXLoader: sdk.DOCXLoader,
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
  default: class MockBrowserWindow {},
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, unknown> = {}
    constructor(opts: { defaults?: Record<string, unknown> }) {
      this.data = { ...(opts?.defaults ?? {}) }
    }
    get(key: string, defaultValue?: unknown) {
      return key in this.data ? this.data[key] : defaultValue
    }
    set(key: string, value: unknown) {
      this.data[key] = value
    }
    clear() {
      this.data = {}
    }
  },
}))

import { RAGService } from '../../src/main/services/RAGService'
import type { RAGSearchResult } from '@shared/types'

describe('RAGService', () => {
  let service: RAGService

  beforeEach(() => {
    service = new RAGService()
  })

  afterEach(() => {
    service.clear()
  })

  // ===== 构造与配置 =====

  describe('配置管理', () => {
    it('构造函数不应抛出异常', () => {
      expect(() => new RAGService()).not.toThrow()
    })

    it('默认配置符合预期', () => {
      const cfg = service.getConfig()
      expect(cfg.chunkSize).toBe(1000)
      expect(cfg.chunkOverlap).toBe(200)
      expect(cfg.topK).toBe(5)
      expect(cfg.fusionMode).toBe('rrf')
      expect(cfg.reranker).toBe('mmr')
    })

    it('setConfig 合并部分字段', () => {
      service.setConfig({ chunkSize: 500, topK: 3 })
      const cfg = service.getConfig()
      expect(cfg.chunkSize).toBe(500)
      expect(cfg.topK).toBe(3)
      // 未覆盖字段保持默认
      expect(cfg.chunkOverlap).toBe(200)
    })

    it('getFusionConfig 返回融合参数', () => {
      const fusion = service.getFusionConfig()
      expect(fusion).toBeDefined()
      expect((fusion as { fusionMode: string }).fusionMode).toBe('rrf')
    })
  })

  // ===== 上下文格式化 =====

  describe('formatContext', () => {
    it('空结果返回空字符串', () => {
      expect(service.formatContext([])).toBe('')
    })

    it('格式化结果包含来源与内容', () => {
      const results: RAGSearchResult[] = [
        {
          content: '相关文档正文',
          score: 0.92,
          metadata: { source: 'doc-a.md' },
        } as RAGSearchResult,
      ]
      const ctx = service.formatContext(results)
      expect(ctx).toContain('=== 相关文档 ===')
      expect(ctx).toContain('=== 文档结束 ===')
      expect(ctx).toContain('doc-a.md')
      expect(ctx).toContain('相关文档正文')
      expect(ctx).toContain('0.92')
    })
  })

  // ===== 摄取与统计 =====

  describe('摄取与统计', () => {
    it('初始 stats 为空', () => {
      const s = service.stats()
      expect(s.documents).toBe(0)
      expect(s.chunks).toBe(0)
      expect(s.vectorDim).toBe(128)
    })

    it('ingestText 返回文档与块计数', async () => {
      const res = await service.ingestText('src.md', '块一\n\n块二\n\n块三')
      expect(res.documentId).toBeTruthy()
      expect(res.chunkCount).toBe(3)
    })

    it('ingestText 后 stats 反映计数', async () => {
      await service.ingestText('src.md', 'a\n\nb\n\nc\n\nd')
      const s = service.stats()
      expect(s.documents).toBe(1)
      expect(s.chunks).toBe(4)
    })

    it('clear 重置统计', async () => {
      await service.ingestText('src.md', 'a\n\nb')
      expect(service.stats().documents).toBe(1)
      service.clear()
      expect(service.stats().documents).toBe(0)
      expect(service.stats().chunks).toBe(0)
    })
  })
})
