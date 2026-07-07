/**
 * Memory IPC handler 单测（.memory.handlers.test.ts）
 *
 * 覆盖核心 handler：memory:search / memory:list / memory:add / memory:stats
 * 重点：handler 存在 + 调用正确的 service（MemoryService）方法 + 参数透传
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron 模块 =====
const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn)
    },
  },
}))

import { registerMemoryHandlers } from '../../../src/main/ipc/handlers/memory'
import { IPC_CHANNELS } from '../../../src/shared/types'

// ===== Mock 服务 =====

function makeMockMemoryService(overrides: Partial<{
  hybridSearch: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  addEpisode: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  stats: ReturnType<typeof vi.fn>
  compress: ReturnType<typeof vi.fn>
  ftsSearch: ReturnType<typeof vi.fn>
  ftsStats: ReturnType<typeof vi.fn>
  rebuildFTSIndex: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    hybridSearch: overrides.hybridSearch ?? vi.fn().mockResolvedValue([]),
    list: overrides.list ?? vi.fn().mockResolvedValue([]),
    addEpisode: overrides.addEpisode ?? vi.fn().mockResolvedValue(undefined),
    delete: overrides.delete ?? vi.fn().mockResolvedValue(undefined),
    stats: overrides.stats ?? vi.fn().mockResolvedValue({ totalEpisodes: 0 }),
    compress: overrides.compress ?? vi.fn().mockResolvedValue({ compressed: 0, summary: '', tags: [] }),
    ftsSearch: overrides.ftsSearch ?? vi.fn().mockResolvedValue([]),
    ftsStats: overrides.ftsStats ?? vi.fn().mockReturnValue({ totalDocuments: 0, indexSizeKB: 0 }),
    rebuildFTSIndex: overrides.rebuildFTSIndex ?? vi.fn().mockResolvedValue({ totalDocuments: 0, indexSizeKB: 0 }),
  } as never
}

// ===== 测试用例 =====
describe('Memory IPC Handlers (.handlers)', () => {
  let mockMemoryService: ReturnType<typeof makeMockMemoryService>

  beforeEach(() => {
    handlers.clear()
    mockMemoryService = makeMockMemoryService()
    registerMemoryHandlers({ memoryService: mockMemoryService })
  })

  // ===== memory:search =====
  describe('memory:search', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.MEMORY_SEARCH)).toBeDefined()
    })

    it('调用 memoryService.hybridSearch 并传入 query 与 opts', async () => {
      const hybridSearch = vi.fn().mockResolvedValue([{ id: 'm1', score: 0.9 }])
      Object.assign(mockMemoryService, { hybridSearch })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_SEARCH)!

      const result = await handler({}, 'hello world', { sessionId: 's1', limit: 5 })
      expect(hybridSearch).toHaveBeenCalledWith('hello world', { sessionId: 's1', limit: 5 })
      expect(result).toEqual({ success: true, data: [{ id: 'm1', score: 0.9 }] })
    })

    it('无 opts 时也能正常调用', async () => {
      const hybridSearch = vi.fn().mockResolvedValue([])
      Object.assign(mockMemoryService, { hybridSearch })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_SEARCH)!

      const result = await handler({}, 'query', undefined)
      expect(hybridSearch).toHaveBeenCalledWith('query', undefined)
      expect(result).toEqual({ success: true, data: [] })
    })

    it('service 异常时返回 error', async () => {
      const hybridSearch = vi.fn().mockRejectedValue(new Error('DB error'))
      Object.assign(mockMemoryService, { hybridSearch })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_SEARCH)!

      const result = await handler({}, 'query')
      expect(result).toEqual({ success: false, error: 'DB error' })
    })
  })

  // ===== memory:list =====
  describe('memory:list', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.MEMORY_LIST)).toBeDefined()
    })

    it('调用 memoryService.list 并传入 opts', async () => {
      const list = vi.fn().mockResolvedValue([{ id: 'e1' }, { id: 'e2' }])
      Object.assign(mockMemoryService, { list })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_LIST)!

      const result = await handler({}, { sessionId: 's1', limit: 10, offset: 0 })
      expect(list).toHaveBeenCalledWith({ sessionId: 's1', limit: 10, offset: 0 })
      expect(result).toEqual({ success: true, data: [{ id: 'e1' }, { id: 'e2' }] })
    })

    it('无 opts 时也能正常调用', async () => {
      const list = vi.fn().mockResolvedValue([])
      Object.assign(mockMemoryService, { list })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_LIST)!

      await handler({}, undefined)
      expect(list).toHaveBeenCalledWith(undefined)
    })
  })

  // ===== memory:add =====
  describe('memory:add', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.MEMORY_ADD)).toBeDefined()
    })

    it('调用 memoryService.addEpisode 并传入 episode', async () => {
      const addEpisode = vi.fn().mockResolvedValue(undefined)
      Object.assign(mockMemoryService, { addEpisode })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_ADD)!

      const episode = {
        id: 'e1',
        sessionId: 's1',
        role: 'user',
        content: 'hi',
        createdAt: '2025-01-01T00:00:00Z',
      }
      const result = await handler({}, episode)
      expect(addEpisode).toHaveBeenCalledWith(episode)
      expect(result).toEqual({ success: true, data: undefined })
    })
  })

  // ===== memory:stats =====
  describe('memory:stats', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.MEMORY_STATS)).toBeDefined()
    })

    it('调用 memoryService.stats 并返回统计结果', async () => {
      const stats = vi.fn().mockResolvedValue({ totalEpisodes: 100, bySession: { s1: 50 } })
      Object.assign(mockMemoryService, { stats })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_STATS)!

      const result = await handler({})
      expect(stats).toHaveBeenCalled()
      expect(result).toEqual({ success: true, data: { totalEpisodes: 100, bySession: { s1: 50 } } })
    })
  })
})
