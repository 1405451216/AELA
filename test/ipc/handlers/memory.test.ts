/**
 * Memory IPC handler 单测
 *
 * 覆盖：MEMORY_SEARCH / MEMORY_ADD / MEMORY_DELETE / MEMORY_COMPRESS / MEMORY_FTS_SEARCH
 * 重点：service 调用透传 / 错误传播
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('memory IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
  })

  // ===== MEMORY_SEARCH =====
  describe('MEMORY_SEARCH', () => {
    it('passes query and opts to hybridSearch', async () => {
      const hybridSearch = vi.fn().mockResolvedValue([{ id: 'm1' }])
      const svc = makeMockMemoryService({ hybridSearch })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_SEARCH)!

      const result = await handler({}, 'hello world', { sessionId: 's1', limit: 5 })

      expect(hybridSearch).toHaveBeenCalledWith('hello world', { sessionId: 's1', limit: 5 })
      expect(result).toEqual({ success: true, data: [{ id: 'm1' }] })
    })

    it('returns error when service throws', async () => {
      const hybridSearch = vi.fn().mockRejectedValue(new Error('DB error'))
      const svc = makeMockMemoryService({ hybridSearch })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_SEARCH)!

      const result = await handler({}, 'query', undefined)
      expect(result).toEqual({ success: false, error: 'DB error' })
    })
  })

  // ===== MEMORY_ADD =====
  describe('MEMORY_ADD', () => {
    it('forwards episode to addEpisode', async () => {
      const addEpisode = vi.fn().mockResolvedValue(undefined)
      const svc = makeMockMemoryService({ addEpisode })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_ADD)!

      const episode = {
        id: 'e1',
        sessionId: 's1',
        role: 'user',
        content: 'hi',
        createdAt: new Date().toISOString(),
      }
      const result = await handler({}, episode)

      expect(addEpisode).toHaveBeenCalledWith(episode)
      expect(result).toEqual({ success: true, data: undefined })
    })
  })

  // ===== MEMORY_DELETE =====
  describe('MEMORY_DELETE', () => {
    it('forwards id to delete', async () => {
      const deleteFn = vi.fn().mockResolvedValue(undefined)
      const svc = makeMockMemoryService({ delete: deleteFn })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_DELETE)!

      const result = await handler({}, 'ep-1')
      expect(deleteFn).toHaveBeenCalledWith('ep-1')
      expect(result).toEqual({ success: true, data: undefined })
    })
  })

  // ===== MEMORY_COMPRESS =====
  describe('MEMORY_COMPRESS', () => {
    it('passes config to compress with defaults', async () => {
      const compress = vi.fn().mockResolvedValue({ compressed: 3, summary: 'merged', tags: ['a'] })
      const svc = makeMockMemoryService({ compress })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_COMPRESS)!

      const result = await handler({}, { windowSize: 10 })

      expect(compress).toHaveBeenCalledWith({ windowSize: 10 })
      expect(result).toEqual({ success: true, data: { compressed: 3, summary: 'merged', tags: ['a'] } })
    })

    it('handles missing config (undefined)', async () => {
      const compress = vi.fn().mockResolvedValue({ compressed: 0, summary: '', tags: [] })
      const svc = makeMockMemoryService({ compress })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_COMPRESS)!

      const result = await handler({}, undefined)
      expect(compress).toHaveBeenCalledWith(undefined)
      expect(result).toMatchObject({ success: true })
    })
  })

  // ===== MEMORY_FTS_SEARCH =====
  describe('MEMORY_FTS_SEARCH', () => {
    it('passes query and opts to ftsSearch', async () => {
      const ftsSearch = vi.fn().mockResolvedValue([{ episode: { id: 'f1' }, score: 0.9 }])
      const svc = makeMockMemoryService({ ftsSearch })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_FTS_SEARCH)!

      const result = await handler({}, 'keyword', { limit: 10 })
      expect(ftsSearch).toHaveBeenCalledWith('keyword', { limit: 10 })
      expect(result).toEqual({ success: true, data: [{ episode: { id: 'f1' }, score: 0.9 }] })
    })
  })

  // ===== MEMORY_FTS_STATS =====
  describe('MEMORY_FTS_STATS', () => {
    it('returns ftsStats directly', async () => {
      const ftsStats = vi.fn().mockReturnValue({ totalDocuments: 100, indexSizeKB: 256 })
      const svc = makeMockMemoryService({ ftsStats })
      registerMemoryHandlers({ memoryService: svc })
      const handler = handlers.get(IPC_CHANNELS.MEMORY_FTS_STATS)!

      const result = await handler({})
      expect(result).toEqual({ success: true, data: { totalDocuments: 100, indexSizeKB: 256 } })
    })
  })
})
