// ResilientProvider IPC handlers
// RESILIENCE_GET_CONFIG, RESILIENCE_SET_CONFIG, RESILIENCE_GET_STATS, RESILIENCE_RESET_BREAKER

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { ResilienceConfig } from '@shared/types'
import type { ResilienceService } from '../../services/ResilienceService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericObjectSchema } from '../schemas'

export function registerResilienceHandlers(params: {
  resilienceService: ResilienceService
}): void {
  const { resilienceService } = params

  ipcMain.handle(IPC_CHANNELS.RESILIENCE_GET_CONFIG, async () => {
    return wrap(() => resilienceService.getConfig())
  })

  ipcMain.handle(IPC_CHANNELS.RESILIENCE_SET_CONFIG, async (_, partial: Partial<ResilienceConfig>) => {
    const v = validateInput(genericObjectSchema, partial)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => resilienceService.setConfig(partial))
  })

  ipcMain.handle(IPC_CHANNELS.RESILIENCE_GET_STATS, async () => {
    return wrap(() => resilienceService.getStats())
  })

  ipcMain.handle(IPC_CHANNELS.RESILIENCE_RESET_BREAKER, async (_, modelId: string) => {
    const v = validateInput(genericIdSchema, modelId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => resilienceService.resetBreaker(modelId))
  })
}
