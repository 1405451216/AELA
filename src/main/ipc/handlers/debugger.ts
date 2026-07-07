// 调试器 IPC handlers
// DEBUGGER_STATUS, DEBUGGER_TRACES, DEBUGGER_SESSION_TRACE, DEBUGGER_CLEAR,
// DEBUGGER_INSPECTOR_START, DEBUGGER_INSPECTOR_STOP

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { DebuggerService } from '../../services/DebuggerService'
import type { ObservabilityService } from '../../services/ObservabilityService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericObjectOptionalSchema, genericNumberOptionalSchema } from '../schemas'

export function registerDebuggerHandlers(params: {
  debuggerService: DebuggerService
  observabilityService: ObservabilityService
}): void {
  const { debuggerService, observabilityService } = params

  ipcMain.handle(IPC_CHANNELS.DEBUGGER_STATUS, async () => {
    return wrap(() => ({
      ...observabilityService.getDebugStatus(),
      inspectorRunning: debuggerService.isInspectorRunning(),
      inspectorPort: debuggerService.getInspectorPort(),
      totalSpans: debuggerService.getTraces().length,
      totalSessions: debuggerService.getAllSessions().length,
    }))
  })

  ipcMain.handle(IPC_CHANNELS.DEBUGGER_TRACES, async (_, opts?: { limit?: number }) => {
    const v = validateInput(genericObjectOptionalSchema, opts)
    if (!v.success) return { success: false, error: v.error }
    const traces = debuggerService.getTraces()
    const limit = opts?.limit ?? 200
    return wrap(() => traces.slice(-limit))
  })

  ipcMain.handle(IPC_CHANNELS.DEBUGGER_SESSION_TRACE, async (_, sessionId: string) => {
    const v = validateInput(genericIdSchema, sessionId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => debuggerService.getSessionTrace(sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.DEBUGGER_CLEAR, async () => {
    debuggerService.clear()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.DEBUGGER_INSPECTOR_START, async (_, port?: number) => {
    const v = validateInput(genericNumberOptionalSchema, port)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      const p = debuggerService.startInspector(port ?? 19876)
      return { port: p, running: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.DEBUGGER_INSPECTOR_STOP, async () => {
    debuggerService.stopInspector()
    return { success: true }
  })
}
