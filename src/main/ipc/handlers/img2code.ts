// 图片转代码工作流 IPC handlers
// IMG2CODE_ANALYZE, IMG2CODE_GENERATE, IMG2CODE_REFINE,
// IMG2CODE_GET_RESULT, IMG2CODE_LIST_FRAMEWORKS

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { ImageToCodeRequest } from '@shared/types'
import type { ImageToCodeService } from '../../services/ImageToCodeService'
import { wrap } from '../../utils/ipcHelpers'
import {
  validateInput,
  img2CodeAnalyzeSchema,
  img2CodeRefineSchema,
} from '../schemas'

export function registerImg2CodeHandlers(params: {
  imageToCodeService: ImageToCodeService
}): void {
  const { imageToCodeService } = params

  ipcMain.handle(IPC_CHANNELS.IMG2CODE_ANALYZE, async (_, imagePath: string, modelConfigId: string) => {
    const validation = validateInput(img2CodeAnalyzeSchema, { imagePath, modelConfigId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => imageToCodeService.analyze(imagePath, modelConfigId))
  })

  ipcMain.handle(IPC_CHANNELS.IMG2CODE_GENERATE, async (_, request: ImageToCodeRequest) => {
    return wrap(() => imageToCodeService.generate(request))
  })

  ipcMain.handle(IPC_CHANNELS.IMG2CODE_REFINE, async (_, resultId: string, feedback: string, modelConfigId: string) => {
    const validation = validateInput(img2CodeRefineSchema, { resultId, feedback, modelConfigId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => imageToCodeService.refine(resultId, feedback, modelConfigId))
  })

  ipcMain.handle(IPC_CHANNELS.IMG2CODE_GET_RESULT, async (_, id: string) => {
    return wrap(() => imageToCodeService.getResult(id))
  })

  ipcMain.handle(IPC_CHANNELS.IMG2CODE_LIST_FRAMEWORKS, async () => {
    return wrap(() => imageToCodeService.listFrameworks())
  })
}
