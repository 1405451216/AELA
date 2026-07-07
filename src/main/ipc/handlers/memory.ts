// Memory IPC handlers
// MEMORY_ADD, MEMORY_SEARCH, MEMORY_GET, MEMORY_DELETE, MEMORY_LIST,
// MEMORY_STATS, MEMORY_COMPRESS, MEMORY_FTS_SEARCH, MEMORY_FTS_STATS,
// MEMORY_FTS_REBUILD, MEMORY_TAG_SEARCH, MEMORY_IMPORTANT, MEMORY_TIMELINE,
// MEMORY_CLEANUP, MEMORY_SET_IMPORTANCE, MEMORY_UPDATE_SUMMARY

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { MemoryEpisode, MemoryCompressConfig } from '@shared/types'
import type { MemoryService } from '../../services/MemoryService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericObjectSchema, genericObjectOptionalSchema } from '../schemas'

export function registerMemoryHandlers(params: {
  memoryService: MemoryService
}): void {
  const { memoryService } = params

  ipcMain.handle(IPC_CHANNELS.MEMORY_SEARCH, async (_, query: string, opts?: { sessionId?: string; limit?: number }) => {
    const v = validateInput(genericIdSchema, query)
    if (!v.success) return { success: false, error: v.error }
    const vOpts = validateInput(genericObjectOptionalSchema, opts)
    if (!vOpts.success) return { success: false, error: vOpts.error }
    return wrap(() => memoryService.hybridSearch(query, opts))
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_LIST, async (_, opts?: { sessionId?: string; limit?: number; offset?: number }) => {
    const v = validateInput(genericObjectOptionalSchema, opts)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => memoryService.list(opts))
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_ADD, async (_, episode: MemoryEpisode) => {
    const v = validateInput(genericObjectSchema, episode)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => memoryService.addEpisode(episode))
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_DELETE, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => memoryService.delete(id))
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_STATS, async () => {
    return wrap(() => memoryService.stats())
  })

  // ===== Memory 压缩 =====
  ipcMain.handle(IPC_CHANNELS.MEMORY_COMPRESS, async (_, config?: Partial<MemoryCompressConfig>) => {
    const v = validateInput(genericObjectOptionalSchema, config)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => memoryService.compress(config))
  })

  // ===== [升级 1] 记忆系统 FTS5 =====
  ipcMain.handle(IPC_CHANNELS.MEMORY_FTS_SEARCH, async (_, query: string, opts?: { sessionId?: string; limit?: number }) => {
    const v = validateInput(genericIdSchema, query)
    if (!v.success) return { success: false, error: v.error }
    const vOpts = validateInput(genericObjectOptionalSchema, opts)
    if (!vOpts.success) return { success: false, error: vOpts.error }
    return wrap(() => memoryService.ftsSearch(query, opts))
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_FTS_STATS, async () => {
    return wrap(() => memoryService.ftsStats())
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_FTS_REBUILD, async () => {
    return wrap(() => memoryService.rebuildFTSIndex())
  })
}
