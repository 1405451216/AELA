// OpenTelemetry 遥测 IPC handlers
// TELEMETRY_CONFIGURE, TELEMETRY_EXPORT, TELEMETRY_SPANS, TELEMETRY_STATUS, TELEMETRY_GET_CONFIG

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { TelemetryConfig } from '@shared/types'
import type { TelemetryService } from '../../services/TelemetryService'
import type { ObservabilityService } from '../../services/ObservabilityService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericObjectSchema } from '../schemas'

export function registerTelemetryHandlers(params: {
  telemetryService: TelemetryService
  observabilityService: ObservabilityService
}): void {
  const { telemetryService, observabilityService } = params

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_CONFIGURE, async (_, config: TelemetryConfig) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    telemetryService.configure(config)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_EXPORT, async () => {
    return wrap(() => telemetryService.exportNow(observabilityService.getSnapshot()))
  })

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_SPANS, async () => {
    return wrap(() => telemetryService.getSpans())
  })

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_STATUS, async () => {
    return wrap(() => telemetryService.getStatus())
  })

  ipcMain.handle(IPC_CHANNELS.TELEMETRY_GET_CONFIG, async () => {
    return wrap(() => telemetryService.getConfig())
  })
}
