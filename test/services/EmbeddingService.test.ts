/**
 * EmbeddingService 单元测试
 *
 * 覆盖: hash 模式嵌入 / OpenAI 模式降级 / 缓存 / 批量嵌入 / 配置切换 / 单例
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EmbeddingService, getEmbeddingService, initEmbeddingService } from '../../src/main/services/EmbeddingService'

describe('EmbeddingService', () => {
  let service: EmbeddingService

  beforeEach(() => {
    service = new EmbeddingService()
  })

  // ===== 基本嵌入 =====

  describe('基本嵌入 (hash 模式)', () => {
    it('应返回指定维度的向量', () => {
      const vector = service.embedSync('hello world')
      expect(vector).toBeDefined()
      expect(vector.length).toBe(384) // 默认维度
    })

    it('相同文本应产生相同向量', () => {
      const v1 = service.embedSync('test text')
      const v2 = service.embedSync('test text')
      expect(v1).toEqual(v2)
    })

    it('不同文本应产生不同向量', () => {
      const v1 = service.embedSync('hello world test')
      const v2 = service.embedSync('completely different text input')
      // 至少有一些维度不同
      const isEqual = v1.every((val, i) => val === v2[i])
      expect(isEqual).toBe(false)
    })

    it('空文本应返回零向量', () => {
      const vector = service.embedSync('')
      expect(vector.length).toBe(384)
      expect(vector.every(v => v === 0)).toBe(true)
    })

    it('向量应被 L2 归一化', () => {
      const vector = service.embedSync('test normalization')
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
      // 非零向量的模应接近 1
      expect(norm).toBeGreaterThan(0)
      expect(Math.abs(norm - 1)).toBeLessThan(0.001)
    })
  })

  // ===== 异步嵌入 =====

  describe('异步嵌入', () => {
    it('embed 应返回与 embedSync 相同结果（hash 模式）', async () => {
      const syncVec = service.embedSync('async test')
      const asyncVec = await service.embed('async test')
      expect(asyncVec).toEqual(syncVec)
    })

    it('embed 应缓存结果', async () => {
      const v1 = await service.embed('cache test')
      const v2 = await service.embed('cache test')
      expect(v1).toEqual(v2)
      expect(service.getInfo().cached).toBeGreaterThan(0)
    })
  })

  // ===== 批量嵌入 =====

  describe('批量嵌入', () => {
    it('embedBatch 应返回正确数量', async () => {
      const texts = ['one', 'two', 'three', 'four']
      const vectors = await service.embedBatch(texts)
      expect(vectors.length).toBe(4)
      vectors.forEach(v => {
        expect(v.length).toBe(384)
      })
    })

    it('embedBatch 结果应与单独嵌入一致', async () => {
      const texts = ['batch', 'test']
      const batch = await service.embedBatch(texts)
      const individual = texts.map(t => service.embedSync(t))
      expect(batch[0]).toEqual(individual[0])
      expect(batch[1]).toEqual(individual[1])
    })

    it('空数组应返回空结果', async () => {
      const result = await service.embedBatch([])
      expect(result).toEqual([])
    })
  })

  // ===== 配置管理 =====

  describe('配置管理', () => {
    it('默认 provider 应为 hash', () => {
      expect(service.getProvider()).toBe('hash')
    })

    it('configureApiKey 应切换到 openai provider', () => {
      service.configureApiKey('sk-valid-api-key-12345')
      expect(service.getProvider()).toBe('openai')
      expect(service.getDimensions()).toBe(384)
    })

    it('短 API Key 应保持 hash provider', () => {
      service.configureApiKey('short')
      expect(service.getProvider()).toBe('hash')
      expect(service.getDimensions()).toBe(128)
    })

    it('空 API Key 应保持 hash provider', () => {
      service.configureApiKey('')
      expect(service.getProvider()).toBe('hash')
    })

    it('configureApiKey 应清空缓存', async () => {
      await service.embed('cache clear test')
      const cachedBefore = service.getInfo().cached
      expect(cachedBefore).toBeGreaterThan(0)

      service.configureApiKey('sk-new-api-key-12345')
      expect(service.getInfo().cached).toBe(0)
    })

    it('getInfo 应返回完整信息', () => {
      const info = service.getInfo()
      expect(info).toHaveProperty('provider')
      expect(info).toHaveProperty('model')
      expect(info).toHaveProperty('dimensions')
      expect(info).toHaveProperty('cached')
    })

    it('clearCache 应清空缓存', async () => {
      await service.embed('clear me')
      expect(service.getInfo().cached).toBeGreaterThan(0)
      service.clearCache()
      expect(service.getInfo().cached).toBe(0)
    })
  })

  // ===== OpenAI 模式降级 =====

  describe('OpenAI 模式降级', () => {
    it('无网络时应降级到 hash', async () => {
      // 使用无效 API Key 触发降级
      service.configureApiKey('sk-invalid-key-for-fallback')

      // fetch 会失败，应降级到 hash
      const vector = await service.embed('fallback test')
      expect(vector).toBeDefined()
      expect(vector.length).toBe(384)
    })
  })

  // ===== 单例模式 =====

  describe('单例模式', () => {
    it('getEmbeddingService 应返回相同实例', () => {
      const s1 = getEmbeddingService()
      const s2 = getEmbeddingService()
      expect(s1).toBe(s2)
    })

    it('initEmbeddingService 应创建新实例', () => {
      const s1 = getEmbeddingService()
      const s2 = initEmbeddingService({ provider: 'hash', dimensions: 256 })
      expect(s2).not.toBe(s1)
      expect(s2.getDimensions()).toBe(256)
    })
  })

  // ===== 自定义维度 =====

  describe('自定义维度', () => {
    it('应支持自定义维度', () => {
      const custom = new EmbeddingService({ dimensions: 256 })
      const vec = custom.embedSync('custom dim')
      expect(vec.length).toBe(256)
    })
  })
})


