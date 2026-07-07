// 本地引擎 IPC 处理器

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import { wrap } from '../../utils/ipcHelpers'
import { LocalEngineFactory } from '../../services/LocalEngine'

let engineFactory: LocalEngineFactory | null = null

function getFactory(): LocalEngineFactory {
  if (!engineFactory) {
    engineFactory = new LocalEngineFactory()
  }
  return engineFactory
}

export function registerLocalEngineHandlers(): void {
  const factory = getFactory()

  // 状态查询
  ipcMain.handle(IPC_CHANNELS.LOCAL_ENGINE_STATUS, async () => {
    return wrap(async () => {
      const engine = factory.getOllamaEngine()
      const hasOllama = await factory.hasAvailableEngine()
      return {
        available: hasOllama,
        engine: engine.engineType,
        ready: engine.isReady,
        loading: engine.isLoading,
      }
    })
  })

  // 引擎健康检查
  ipcMain.handle(IPC_CHANNELS.LOCAL_ENGINE_HEALTH, async () => {
    return wrap(async () => {
      const engine = factory.getOllamaEngine()
      return engine.healthCheck()
    })
  })

  // 列出本地模型
  ipcMain.handle(IPC_CHANNELS.LOCAL_ENGINE_LIST, async () => {
    return wrap(async () => {
      const engine = factory.getOllamaEngine()
      if (!engine.isReady) {
        await engine.initialize()
      }
      return engine.listModels()
    })
  })

  // 初始化引擎
  ipcMain.handle(IPC_CHANNELS.LOCAL_ENGINE_INIT, async (_, config: { ollamaBaseUrl?: string; ollamaModel?: string }) => {
    return wrap(async () => {
      const engine = factory.getOllamaEngine()
      await engine.initialize(config)
      return { success: engine.isReady }
    })
  })

  // 聊天
  ipcMain.handle(IPC_CHANNELS.LOCAL_ENGINE_CHAT, async (_, messages: Array<{ role: string; content: string }>) => {
    return wrap(async () => {
      const engine = factory.getOllamaEngine()
      if (!engine.isReady) {
        await engine.initialize()
      }
      return engine.chat(messages as any)
    })
  })
}
