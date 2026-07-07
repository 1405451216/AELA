// 配置 IPC handlers
// CONFIG_GET, CONFIG_SET

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { AppConfig } from '@shared/types'
import type { ConfigStore } from '../../services/ConfigStore'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, setConfigSchema } from '../schemas'

export function registerConfigHandlers(params: {
  configStore: ConfigStore
}): void {
  const { configStore } = params

  // ===== 配置 =====
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async () => {
    return wrap(() => configStore.getConfig())
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_, partial: Partial<AppConfig>) => {
    const validation = validateInput(setConfigSchema, partial)
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => configStore.setConfig(validation.data))
  })

  // 查询 API Key 是否使用 OS 级加密存储（供渲染进程显示安全告警）
  ipcMain.handle(IPC_CHANNELS.CONFIG_IS_API_KEY_SECURE, async () => {
    return wrap(() => configStore.isApiKeyStorageSecure())
  })
}
