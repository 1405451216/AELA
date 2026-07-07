// AELA — Checkpoint IPC Handler
// 提供检查点（快照/回滚）的 IPC 接口

import { ipcMain } from 'electron'
import type { ServiceContainer } from '../../services/ServiceContainer'
import { SERVICE_TOKENS } from '../../services/ServiceContainer'
import type { CheckpointService } from '../../services/CheckpointService'
import { z } from 'zod'

export function registerCheckpointHandlers(container: ServiceContainer): void {
  const getService = (): CheckpointService => {
    return container.get<CheckpointService>(SERVICE_TOKENS.CHECKPOINT_SERVICE)
  }

  // 创建检查点
  const createSchema = z.object({
    sessionId: z.string().min(1),
    filePaths: z.array(z.string()),
    description: z.string().optional().default('AI 修改前快照'),
  })

  ipcMain.handle('checkpoint:create', async (_event, raw) => {
    const { sessionId, filePaths, description } = createSchema.parse(raw)
    const service = getService()
    const id = await service.createCheckpoint(sessionId, filePaths, description)
    return { id, success: true }
  })

  // 回滚到检查点
  const restoreSchema = z.object({
    checkpointId: z.string().min(1),
  })

  ipcMain.handle('checkpoint:restore', async (_event, raw) => {
    const { checkpointId } = restoreSchema.parse(raw)
    const service = getService()
    const restoredCount = await service.restoreCheckpoint(checkpointId)
    return { restoredCount, success: true }
  })

  // 获取会话检查点列表
  const listSchema = z.object({
    sessionId: z.string().min(1),
  })

  ipcMain.handle('checkpoint:list', (_event, raw) => {
    const { sessionId } = listSchema.parse(raw)
    const service = getService()
    return service.getSessionCheckpoints(sessionId)
  })

  // 获取检查点详情
  const getSchema = z.object({
    checkpointId: z.string().min(1),
  })

  ipcMain.handle('checkpoint:get', (_event, raw) => {
    const { checkpointId } = getSchema.parse(raw)
    const service = getService()
    return service.getCheckpoint(checkpointId)
  })

  // 删除检查点
  ipcMain.handle('checkpoint:delete', (_event, raw) => {
    const { checkpointId } = getSchema.parse(raw)
    const service = getService()
    const deleted = service.deleteCheckpoint(checkpointId)
    return { success: deleted }
  })

  // 清除会话所有检查点
  ipcMain.handle('checkpoint:clear', (_event, raw) => {
    const { sessionId } = listSchema.parse(raw)
    const service = getService()
    service.clearSessionCheckpoints(sessionId)
    return { success: true }
  })

  // 获取统计信息
  ipcMain.handle('checkpoint:stats', () => {
    const service = getService()
    return service.getStats()
  })
}
