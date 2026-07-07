// 浏览器预览 IPC handlers
// PREVIEW_OPEN, PREVIEW_CLOSE, PREVIEW_NAVIGATE, PREVIEW_RELOAD,
// PREVIEW_GO_BACK, PREVIEW_GO_FORWARD, PREVIEW_GET_URL,
// PREVIEW_DEVTOOLS, PREVIEW_UPDATE_BOUNDS

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { PreviewService } from '../../services/PreviewService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, previewOpenSchema } from '../schemas'

export function registerPreviewHandlers(params: {
  previewService: PreviewService
}): void {
  const { previewService } = params

  ipcMain.handle(IPC_CHANNELS.PREVIEW_OPEN, async (_, url: string) => {
    const validation = validateInput(previewOpenSchema, { url })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => previewService.open(url))
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_CLOSE, async () => {
    previewService.close()
    return { success: true, data: true }
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_NAVIGATE, async (_, url: string) => {
    return wrap(() => previewService.navigate(url))
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_RELOAD, async () => {
    previewService.reload()
    return { success: true, data: true }
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_GO_BACK, async () => {
    previewService.goBack()
    return { success: true, data: true }
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_GO_FORWARD, async () => {
    previewService.goForward()
    return { success: true, data: true }
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_GET_URL, async () => {
    return wrap(() => previewService.getUrl())
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_DEVTOOLS, async () => {
    previewService.toggleDevTools()
    return { success: true, data: true }
  })

  ipcMain.handle(IPC_CHANNELS.PREVIEW_UPDATE_BOUNDS, async (_, bounds: { x: number; y: number; width: number; height: number }) => {
    previewService.setBoundsCallback(() => bounds)
    previewService.updateBounds()
    return { success: true, data: true }
  })
}
