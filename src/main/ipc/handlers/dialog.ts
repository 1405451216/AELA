// Dialog IPC handler — 原生对话框
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { OpenDialogOptions } from '../../preload/api/dialog'

export function registerDialogHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG_SHOW_OPEN, async (_event, options: OpenDialogOptions) => {
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win ?? undefined, {
      title: options.title,
      defaultPath: options.defaultPath,
      properties: options.properties as ('openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles')[],
      filters: options.filters,
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: true, data: null }
    }
    return { success: true, data: result.filePaths }
  })
}
