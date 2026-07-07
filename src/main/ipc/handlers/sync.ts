import { ipcMain } from 'electron'
import type { ServiceContainer } from '../../services/ServiceContainer'
import { SERVICE_TOKENS } from '../../services/ServiceContainer'
import type { SyncService } from '../../services/SyncService'
import type { SyncConfig, ConflictResolution } from '@shared/types/sync'
import { z } from 'zod'

const connectSchema = z.object({
  serverUrl: z.string().url(),
  roomId: z.string().min(1).max(128),
  apiKey: z.string().min(1).max(512),
  autoSync: z.boolean(),
  syncIntervalMs: z.number().int().min(1000).max(60000),
})

const syncFileSchema = z.object({
  filePath: z.string().min(1).max(1024),
})

const resolveSchema = z.object({
  filePath: z.string().min(1).max(1024),
  resolution: z.enum(['local', 'remote', 'merge']) as z.ZodType<ConflictResolution>,
})

export function registerSyncHandlers(container: ServiceContainer): void {
  const getService = (): SyncService => {
    return container.get<SyncService>(SERVICE_TOKENS.SYNC_SERVICE)
  }

  ipcMain.handle('sync:connect', async (_event, raw) => {
    const { success, data, error } = connectSchema.safeParse(raw)
    if (!success) return { success: false, error: error.message }
    const service = getService()
    try {
      await service.connect(data as SyncConfig)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Connection failed' }
    }
  })

  ipcMain.handle('sync:disconnect', async () => {
    const service = getService()
    await service.disconnect()
    return { success: true }
  })

  ipcMain.handle('sync:status', () => {
    const service = getService()
    return service.getState()
  })

  ipcMain.handle('sync:file:sync', async (_event, raw) => {
    const { success, data, error } = syncFileSchema.safeParse(raw)
    if (!success) return { success: false, error: error.message }
    const service = getService()
    try {
      await service.syncFile(data.filePath)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Sync failed' }
    }
  })

  ipcMain.handle('sync:resolve', async (_event, raw) => {
    const { success, data, error } = resolveSchema.safeParse(raw)
    if (!success) return { success: false, error: error.message }
    const service = getService()
    try {
      await service.resolveConflict(data.filePath, data.resolution)
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Resolve failed' }
    }
  })

  ipcMain.handle('sync:conflicts', () => {
    const service = getService()
    return service.getConflicts()
  })
}
