// 记忆系统 API（memory, memoryCompress, memoryFTS）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  MemoryEpisode,
  MemoryStats,
  MemoryCompressConfig,
  MemoryCompressResult,
  MemoryFTSResult,
  MemoryFTSStats,
} from '@shared/types'

export const memoryApi = {
  search: (query: string, opts?: { sessionId?: string; limit?: number }): Promise<MemoryEpisode[]> =>
    invoke(IPC_CHANNELS.MEMORY_SEARCH, query, opts),
  list: (opts?: { sessionId?: string; limit?: number; offset?: number }): Promise<MemoryEpisode[]> =>
    invoke(IPC_CHANNELS.MEMORY_LIST, opts),
  add: (episode: MemoryEpisode): Promise<void> => invoke(IPC_CHANNELS.MEMORY_ADD, episode),
  delete: (id: string): Promise<void> => invoke(IPC_CHANNELS.MEMORY_DELETE, id),
  stats: (): Promise<MemoryStats> => invoke(IPC_CHANNELS.MEMORY_STATS),
}

export const memoryCompressApi = {
  compress: (config?: Partial<MemoryCompressConfig>): Promise<MemoryCompressResult> =>
    invoke(IPC_CHANNELS.MEMORY_COMPRESS, config),
}

export const memoryFTSApi = {
  search: (query: string, opts?: { sessionId?: string; limit?: number }): Promise<MemoryFTSResult[]> =>
    invoke(IPC_CHANNELS.MEMORY_FTS_SEARCH, query, opts),
  stats: (): Promise<MemoryFTSStats> => invoke(IPC_CHANNELS.MEMORY_FTS_STATS),
  rebuild: (): Promise<boolean> => invoke(IPC_CHANNELS.MEMORY_FTS_REBUILD),
}
