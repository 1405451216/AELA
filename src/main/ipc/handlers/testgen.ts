// 自动测试生成 IPC handlers
// TESTGEN_ANALYZE, TESTGEN_GENERATE, TESTGEN_RUN

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import { TestGenService } from '../../services/TestGenService'
import type { TestGenService as TestGenSvc } from '../../services/TestGenService'
import type { ConfigStore } from '../../services/ConfigStore'
import type { AgentService } from '../../services/AgentService'
import { wrap } from '../../utils/ipcHelpers'
import { makeLlmCall } from '../../utils/llmCall'
import { validateInput, testgenGenerateSchema } from '../schemas'

export function registerTestGenHandlers(params: {
  testGenService: TestGenSvc
  configStore: ConfigStore
  agentService: AgentService
}): void {
  const { testGenService, configStore, agentService } = params

  ipcMain.handle(IPC_CHANNELS.TESTGEN_ANALYZE, async (_, filePath: string) => {
    return wrap(() => testGenService.analyze(filePath))
  })

  ipcMain.handle(IPC_CHANNELS.TESTGEN_GENERATE, async (_, filePath: string, modelConfigId: string) => {
    const validation = validateInput(testgenGenerateSchema, { filePath, modelConfigId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      const llmCall = makeLlmCall(configStore, agentService)
      // 重新构造 service 带 LLM 回调
      const service = new TestGenService(testGenService.getRootDir?.() || process.cwd(), llmCall)
      return service.generate(filePath, modelConfigId)
    })
  })

  ipcMain.handle(IPC_CHANNELS.TESTGEN_RUN, async (_, testFilePath: string) => {
    return wrap(() => testGenService.run(testFilePath))
  })
}
