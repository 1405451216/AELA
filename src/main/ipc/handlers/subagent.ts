// Sub-Agent 并行隔离 IPC handlers
// SUBAGENT_RUN, SUBAGENT_STOP, SUBAGENT_STATUS, SUBAGENT_LIST_PRESETS

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { SubAgentRunConfig } from '@shared/types'
import type { SubAgentIsolationService } from '../../services/SubAgentIsolationService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericObjectSchema } from '../schemas'

export function registerSubAgentHandlers(params: {
  subAgentIsolationService: SubAgentIsolationService
}): void {
  const { subAgentIsolationService } = params

  ipcMain.handle(IPC_CHANNELS.SUBAGENT_RUN, async (_, config: SubAgentRunConfig) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => subAgentIsolationService.run(config))
  })

  ipcMain.handle(IPC_CHANNELS.SUBAGENT_STOP, async (_, runId: string) => {
    const v = validateInput(genericIdSchema, runId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => subAgentIsolationService.stop(runId))
  })

  ipcMain.handle(IPC_CHANNELS.SUBAGENT_STATUS, async (_, runId: string) => {
    const v = validateInput(genericIdSchema, runId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => subAgentIsolationService.getStatus(runId))
  })

  ipcMain.handle(IPC_CHANNELS.SUBAGENT_LIST_PRESETS, async () => {
    return wrap(() => subAgentIsolationService.listPresets())
  })
}
