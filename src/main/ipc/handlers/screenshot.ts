// 截图分析 IPC handlers
// SCREENSHOT_ANALYZE, SCREENSHOT_GET_RESULT, SCREENSHOT_LIST_RESULTS

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { ScreenshotAnalysisRequest } from '@shared/types'
import type { ScreenshotAnalysisService } from '../../services/ScreenshotAnalysisService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericObjectSchema } from '../schemas'

export function registerScreenshotHandlers(params: {
  screenshotAnalysisService: ScreenshotAnalysisService
}): void {
  const { screenshotAnalysisService } = params

  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_ANALYZE, async (_, request: ScreenshotAnalysisRequest) => {
    const v = validateInput(genericObjectSchema, request)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => screenshotAnalysisService.analyze(request))
  })

  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_GET_RESULT, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => screenshotAnalysisService.getResult(id))
  })

  ipcMain.handle(IPC_CHANNELS.SCREENSHOT_LIST_RESULTS, async () => {
    return wrap(() => screenshotAnalysisService.listResults())
  })
}
