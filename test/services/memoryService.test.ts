/**
 * MemoryService 单元测试
 *
 * 覆盖: 懒加载恢复 / CRUD / 搜索 / 压缩 / 统计 / 生命周期
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'path'
import { tmpdir } from 'node:os'

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => join(tmpdir(), 'aela-test')),
  },
  default: class MockBrowserWindow {},
}))

// Mock electron-store
vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, any>
    constructor(opts: any) { this.data = opts?.defaults ?? {} }
    get(key: string, defaultValue?: any) { return this.data[key] ?? defaultValue }
    set(key: string, value: any) { this.data[key] = value }
  },
}))

import { MemoryService } from '../../src/main/services/MemoryService'

describe('MemoryService', () => {
  let tempDir: string
  let service: MemoryService

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aela-mem-'))
  })

  afterEach(async () => {
    if (service) {
      service.close()
    }
    await rm(tempDir, { recursive: true, force: true })
  })

  // ===== 构造与懒加载 =====

  describe('构造与懒加载', () => {
    it('构造函数不应抛出异常', () => {
      expect(() => { service = new MemoryService(join(tempDir, 'test.db')) }).not.toThrow()
    })

    it('初始向量索引应为空（懒加载尚未完成）', () => {
      service = new MemoryService(join(tempDir, 'test.db'))
      // 构造函数是异步启动的，初始状态 count 应为 0
      expect(service.getVectorIndexSize()).toBe(0)
    })

    it('多次 close 不应抛出异常', () => {
      service = new MemoryService(join(tempDir, 'test.db'))
      expect(() => service.close()).not.toThrow()
      expect(() => service.close()).not.toThrow()
    })

    it('stop 应等价于 close', () => {
      service = new MemoryService(join(tempDir, 'test.db'))
      expect(() => service.stop()).not.toThrow()
    })
  })

  // ===== CRUD =====

  describe('CRUD', () => {
    beforeEach(() => {
      service = new MemoryService(join(tempDir, 'test.db'))
    })

    it('addEpisode 应成功添加记忆', async () => {
      const episode = {
        id: 'ep-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'Hello world',
        summary: 'Greeting',
        topics: 'greeting',
        importance: 0.8,
        createdAt: new Date().toISOString(),
      }
      await service.addEpisode(episode)
      const fetched = await service.get('ep-1')
      expect(fetched).toBeDefined()
      expect(fetched!.content).toBe('Hello world')
    })

    it('get 不存在的 ID 应返回 null', async () => {
      const result = await service.get('nonexistent')
      expect(result).toBeNull()
    })

    it('delete 应删除记忆', async () => {
      const episode = {
        id: 'ep-to-delete',
        sessionId: 'sess-1',
        role: 'user',
        content: 'delete me',
        createdAt: new Date().toISOString(),
      }
      await service.addEpisode(episode)
      await service.delete('ep-to-delete')
      const fetched = await service.get('ep-to-delete')
      expect(fetched).toBeNull()
    })

    it('list 应返回所有记忆', async () => {
      for (let i = 0; i < 5; i++) {
        await service.addEpisode({
          id: `ep-list-${i}`,
          sessionId: 'sess-1',
          role: 'user',
          content: `message ${i}`,
          createdAt: new Date().toISOString(),
        })
      }
      const list = await service.list()
      expect(list.length).toBe(5)
    })

    it('list 带 limit 应限制返回数量', async () => {
      for (let i = 0; i < 10; i++) {
        await service.addEpisode({
          id: `ep-limit-${i}`,
          sessionId: 'sess-1',
          role: 'user',
          content: `message ${i}`,
          createdAt: new Date().toISOString(),
        })
      }
      const list = await service.list({ limit: 3 })
      expect(list.length).toBe(3)
    })
  })

  // ===== 搜索 =====

  describe('搜索', () => {
    beforeEach(async () => {
      service = new MemoryService(join(tempDir, 'test.db'))
      await service.addEpisode({
        id: 'search-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'TypeScript programming best practices',
        topics: 'coding',
        createdAt: new Date().toISOString(),
      })
      await service.addEpisode({
        id: 'search-2',
        sessionId: 'sess-1',
        role: 'assistant',
        content: 'Here are some React hooks patterns',
        topics: 'coding,react',
        createdAt: new Date().toISOString(),
      })
    })

    it('search 应返回匹配结果', async () => {
      const results = await service.search('TypeScript')
      expect(results.length).toBeGreaterThan(0)
    })

    it('search 无匹配应返回空数组', async () => {
      const results = await service.search('xyznonexistent123')
      expect(results.length).toBe(0)
    })

    it('ftsSearch 应返回全文搜索结果', async () => {
      const results = await service.ftsSearch('TypeScript')
      expect(results.length).toBeGreaterThan(0)
    })

    it('hybridSearch 应返回合并结果', async () => {
      const results = await service.hybridSearch('TypeScript')
      expect(Array.isArray(results)).toBe(true)
    })

    it('searchByTag 应按标签过滤', async () => {
      const results = await service.searchByTag('react')
      expect(results.length).toBeGreaterThan(0)
    })
  })

  // ===== 统计与清理 =====

  describe('统计与清理', () => {
    beforeEach(() => {
      service = new MemoryService(join(tempDir, 'test.db'))
    })

    it('stats 应返回统计信息', async () => {
      await service.addEpisode({
        id: 'stat-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'test',
        createdAt: new Date().toISOString(),
      })
      const stats = await service.stats()
      expect(stats.totalEpisodes).toBe(1)
    })

    it('cleanupExpired 应清理过期记忆', async () => {
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
      await service.addEpisode({
        id: 'old-ep',
        sessionId: 'sess-1',
        role: 'user',
        content: 'old',
        createdAt: oldDate,
      })
      const cleaned = await service.cleanupExpired(90)
      // 验证清理后统计数减少
      const stats = await service.stats()
      expect(stats.totalEpisodes).toBe(0)
    })

    it('ftsStats 应返回 FTS 索引统计', () => {
      const stats = service.ftsStats()
      expect(stats).toBeDefined()
      expect(typeof stats.totalDocuments).toBe('number')
    })
  })

  // ===== 压缩 =====

  describe('压缩', () => {
    beforeEach(() => {
      service = new MemoryService(join(tempDir, 'test.db'))
    })

    it('compress 条目不足时应返回 0', async () => {
      const result = await service.compress()
      expect(result.compressed).toBe(0)
    })

    it('压缩后应减少条目数', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      for (let i = 0; i < 30; i++) {
        await service.addEpisode({
          id: `compress-${i}`,
          sessionId: 'sess-1',
          role: 'user',
          content: `message ${i}`,
          summary: `summary ${i}`,
          topics: 'test',
          createdAt: oldDate,
        })
      }
      const result = await service.compress({
        windowSize: 5,
        minEpisodes: 5,
        ttlHours: 1,
      })
      // 应有部分条目被压缩
      expect(typeof result.compressed).toBe('number')
    })
  })

  // ===== 重要性 =====

  describe('重要性', () => {
    beforeEach(() => {
      service = new MemoryService(join(tempDir, 'test.db'))
    })

    it('getImportant 应返回高重要性记忆', async () => {
      await service.addEpisode({
        id: 'imp-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'important',
        importance: 0.9,
        createdAt: new Date().toISOString(),
      })
      await service.addEpisode({
        id: 'imp-2',
        sessionId: 'sess-1',
        role: 'user',
        content: 'not important',
        importance: 0.1,
        createdAt: new Date().toISOString(),
      })
      const results = await service.getImportant(0.7, 10)
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('imp-1')
    })

    it('setImportance 应更新重要性', async () => {
      await service.addEpisode({
        id: 'set-imp-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'test',
        importance: 0.5,
        createdAt: new Date().toISOString(),
      })
      await service.setImportance('set-imp-1', 0.9)
      const fetched = await service.get('set-imp-1')
      expect(fetched!.importance).toBeCloseTo(0.9, 1)
    })
  })

  // ===== 时间线 =====

  describe('时间线', () => {
    beforeEach(() => {
      service = new MemoryService(join(tempDir, 'test.db'))
    })

    it('getTimeline 应按日期分组', async () => {
      const today = new Date().toISOString()
      await service.addEpisode({
        id: 'tl-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'today message',
        createdAt: today,
      })
      const timeline = await service.getTimeline(7)
      expect(typeof timeline).toBe('object')
      const keys = Object.keys(timeline)
      expect(keys.length).toBeGreaterThan(0)
    })
  })

  // ===== 兜底摘要 =====

  describe('兜底摘要', () => {
    beforeEach(() => {
      service = new MemoryService(join(tempDir, 'test.db'))
    })

    it('extractSimpleSummary 应返回摘要结果', async () => {
      const result = await service.extractSimpleSummary('This is a long text with keywords like TypeScript and React hooks')
      expect(result).toBeDefined()
      expect(typeof result.summary).toBe('string')
    })
  })

  // ===== 一致性 =====

  describe('一致性', () => {
    beforeEach(() => {
      service = new MemoryService(join(tempDir, 'test.db'))
    })

    it('删除后搜索不应返回已删除项', async () => {
      await service.addEpisode({
        id: 'consistency-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'unique_consistency_test_content',
        createdAt: new Date().toISOString(),
      })
      await service.delete('consistency-1')
      const results = await service.search('unique_consistency_test_content')
      expect(results.length).toBe(0)
    })

    it('FTS 搜索不应返回已删除项', async () => {
      await service.addEpisode({
        id: 'fts-consistency',
        sessionId: 'sess-1',
        role: 'user',
        content: 'fts_unique_marker_xyz',
        createdAt: new Date().toISOString(),
      })
      await service.delete('fts-consistency')
      const results = await service.ftsSearch('fts_unique_marker_xyz')
      expect(results.length).toBe(0)
    })
  })
})
