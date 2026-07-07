// 多文件编辑 IPC handlers
// MULTIFILE_READ, MULTIFILE_WRITE_BATCH, MULTIFILE_LIST_CHANGES

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { MultiFileEdit } from '@shared/types'
import type { AgentService } from '../../services/AgentService'
import { wrap } from '../../utils/ipcHelpers'
import { safeResolve } from '../../services/tools/pathSafety'
import {
  validateInput,
  multiFileReadSchema,
  multiFileWriteBatchSchema,
} from '../schemas'

export function registerMultiFileHandlers(params: {
  agentService: AgentService
}): void {
  const { agentService } = params

  ipcMain.handle(IPC_CHANNELS.MULTIFILE_READ, async (_, filePath: string) => {
    const validation = validateInput(multiFileReadSchema, { filePath })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      const tm = agentService.getToolManager()
      if (!tm) throw new Error('ToolManager not available')
      const { readFile } = await import('node:fs/promises')
      const rootDir = tm.getRootDir?.() || process.cwd()
      // 使用 safeResolve 防止路径穿越：拒绝 ../ 逃逸和跨驱动器访问
      const absPath = safeResolve(rootDir, filePath)
      return readFile(absPath, 'utf-8')
    })
  })

  ipcMain.handle(IPC_CHANNELS.MULTIFILE_WRITE_BATCH, async (_, edits: MultiFileEdit[]) => {
    const validation = validateInput(multiFileWriteBatchSchema, { edits })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      const tm = agentService.getToolManager()
      if (!tm) throw new Error('ToolManager not available')
      return tm.writeBatch(edits)
    })
  })

  ipcMain.handle(IPC_CHANNELS.MULTIFILE_LIST_CHANGES, async (_, sessionId?: string) => {
    return wrap(() => agentService.getToolManager()?.getFileChanges(sessionId) || [])
  })
}
