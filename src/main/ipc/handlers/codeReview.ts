// 代码审查 IPC handlers
// CODE_REVIEW_REVIEW, CODE_REVIEW_GET, CODE_REVIEW_LIST

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import { CodeReviewService } from '../../services/CodeReviewService'
import type { CodeReviewService as CodeReviewSvc } from '../../services/CodeReviewService'
import type { ConfigStore } from '../../services/ConfigStore'
import type { AgentService } from '../../services/AgentService'
import { wrap } from '../../utils/ipcHelpers'
import { makeLlmCall } from '../../utils/llmCall'
import { validateInput, codeReviewSchema } from '../schemas'

export function registerCodeReviewHandlers(params: {
  codeReviewService: CodeReviewSvc
  configStore: ConfigStore
  agentService: AgentService
}): void {
  const { codeReviewService, configStore, agentService } = params

  ipcMain.handle(IPC_CHANNELS.CODE_REVIEW_REVIEW, async (_, files: string[], modelConfigId: string) => {
    const validation = validateInput(codeReviewSchema, { files, modelConfigId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      const llmCall = makeLlmCall(configStore, agentService)
      const ws = configStore.getWorkspaces()[0]
      const rootDir = ws?.path || process.cwd()
      const service = new CodeReviewService(rootDir, llmCall)
      const result = await service.review(files, modelConfigId)
      codeReviewService.importResult?.(result)
      return result
    })
  })

  ipcMain.handle(IPC_CHANNELS.CODE_REVIEW_GET, async (_, id: string) => {
    return wrap(() => codeReviewService.get(id))
  })

  ipcMain.handle(IPC_CHANNELS.CODE_REVIEW_LIST, async () => {
    return wrap(() => codeReviewService.list())
  })
}
