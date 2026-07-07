// 内置终端 IPC handlers
// TERMINAL_CREATE, TERMINAL_DESTROY, TERMINAL_INPUT, TERMINAL_RESIZE, TERMINAL_LIST,
// TERMINAL_LIST_TABS, TERMINAL_COMMAND_HISTORY, TERMINAL_RUN_COMMAND

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { TerminalService } from '../../services/TerminalService'
import { wrap } from '../../utils/ipcHelpers'
import {
  validateInput,
  terminalRunCommandSchema,
  terminalIdSchema,
} from '../schemas'

export function registerTerminalHandlers(params: {
  terminalService: TerminalService
}): void {
  const { terminalService } = params

  ipcMain.handle(IPC_CHANNELS.TERMINAL_CREATE, async (_, opts?: { cwd?: string; shell?: string }) => {
    return wrap(() => terminalService.create(opts))
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_DESTROY, async (_, id: string) => {
    const validation = validateInput(terminalIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => terminalService.destroy(id))
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_INPUT, async (_, id: string, data: string) => {
    const validation = validateInput(terminalIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => terminalService.input(id, data))
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RESIZE, async (_, id: string, cols: number, rows: number) => {
    const validation = validateInput(terminalIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => terminalService.resize(id, cols, rows))
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_LIST, async () => {
    return wrap(() => terminalService.list())
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_LIST_TABS, async () => {
    return wrap(() => terminalService.listTabs())
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_COMMAND_HISTORY, async (_, terminalId?: string, limit?: number) => {
    return wrap(() => terminalService.getCommandHistory(terminalId, limit))
  })

  ipcMain.handle(IPC_CHANNELS.TERMINAL_RUN_COMMAND, async (_, command: string, opts?: { cwd?: string; timeout?: number }) => {
    const validation = validateInput(terminalRunCommandSchema, { command, opts })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => terminalService.runCommand(command, opts))
  })
}
