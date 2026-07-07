// 安全沙箱 IPC 处理器

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import { wrap } from '../../utils/ipcHelpers'
import { SandboxRecorder, PermissionManager } from '../../services/SandboxAudit'

let recorder: SandboxRecorder | null = null
let permissionManager: PermissionManager | null = null

function getRecorder(): SandboxRecorder {
  if (!recorder) recorder = new SandboxRecorder()
  return recorder
}

function getPermissionManager(): PermissionManager {
  if (!permissionManager) permissionManager = new PermissionManager()
  return permissionManager
}

export function registerSandboxHandlers(): void {
  // 列出所有录制
  ipcMain.handle(IPC_CHANNELS.SANDBOX_LIST, async () => {
    return wrap(async () => {
      const rec = getRecorder()
      const recordings = await rec.listRecordings()
      return recordings
    })
  })

  // 获取录制的操作列表
  ipcMain.handle(IPC_CHANNELS.SANDBOX_REPLAY, async (_, runId: string) => {
    return wrap(async () => {
      const rec = getRecorder()
      return rec.getActions(runId)
    })
  })

  // 导出录制为 JSONL
  ipcMain.handle(IPC_CHANNELS.SANDBOX_EXPORT, async (_, runId: string, destPath: string) => {
    return wrap(async () => {
      const rec = getRecorder()
      await rec.exportRecording(runId, destPath)
      return { success: true }
    })
  })

  // 检查权限
  ipcMain.handle(IPC_CHANNELS.SANDBOX_PERMISSION, async (_, action: string, type: string) => {
    return wrap(async () => {
      const pm = getPermissionManager()
      return pm.check(action, type)
    })
  })

  // 授予权限
  ipcMain.handle(IPC_CHANNELS.SANDBOX_GRANT, async (_, pattern: string, action: string, scope: string, durationMs?: number) => {
    return wrap(async () => {
      const pm = getPermissionManager()
      return pm.grant(pattern, action, scope, durationMs)
    })
  })

  // 撤销权限
  ipcMain.handle(IPC_CHANNELS.SANDBOX_REVOKE, async (_, id: string) => {
    return wrap(async () => {
      const pm = getPermissionManager()
      pm.revoke(id)
      return { success: true }
    })
  })
}
