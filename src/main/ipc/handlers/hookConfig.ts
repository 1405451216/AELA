// 用户 Hooks 配置 IPC handlers
// HOOK_CONFIG_LIST, HOOK_CONFIG_ADD, HOOK_CONFIG_UPDATE, HOOK_CONFIG_DELETE,
// HOOK_CONFIG_TOGGLE, HOOK_CONFIG_TEST, HOOK_CONFIG_EXPORT

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { HookRule } from '@shared/types'
import type { HookConfigService } from '../../services/HookConfigService'
import { wrap } from '../../utils/ipcHelpers'
import {
  validateInput,
  hookConfigIdSchema,
  hookConfigAddSchema,
} from '../schemas'

export function registerHookConfigHandlers(params: {
  hookConfigService: HookConfigService
}): void {
  const { hookConfigService } = params

  ipcMain.handle(IPC_CHANNELS.HOOK_CONFIG_LIST, async () => {
    return wrap(() => hookConfigService.list())
  })

  ipcMain.handle(IPC_CHANNELS.HOOK_CONFIG_ADD, async (_, rule: Omit<HookRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const validation = validateInput(hookConfigAddSchema, rule)
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => hookConfigService.add(rule))
  })

  ipcMain.handle(IPC_CHANNELS.HOOK_CONFIG_UPDATE, async (_, id: string, partial: Partial<HookRule>) => {
    const validation = validateInput(hookConfigIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => hookConfigService.update(id, partial))
  })

  ipcMain.handle(IPC_CHANNELS.HOOK_CONFIG_DELETE, async (_, id: string) => {
    const validation = validateInput(hookConfigIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => hookConfigService.delete(id))
  })

  ipcMain.handle(IPC_CHANNELS.HOOK_CONFIG_TOGGLE, async (_, id: string) => {
    const validation = validateInput(hookConfigIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => hookConfigService.toggle(id))
  })

  ipcMain.handle(IPC_CHANNELS.HOOK_CONFIG_TEST, async (_, rule: HookRule, ctx: any) => {
    return wrap(() => hookConfigService.testRule(rule, ctx))
  })

  ipcMain.handle(IPC_CHANNELS.HOOK_CONFIG_EXPORT, async () => {
    return wrap(() => hookConfigService.getSummary())
  })
}
