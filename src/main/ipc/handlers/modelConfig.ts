// Model configuration IPC handlers
// MODEL_ADD, MODEL_UPDATE, MODEL_DELETE, MODEL_LIST, MODEL_TEST, MODEL_GET,
// MODEL_SET_DEFAULT, MODEL_GET_PRICING, MODEL_SET_PRICING, MODEL_ROUTER routes

import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '@shared/types'
import type { ModelConfig, ModelRouteConfig, ModelPricing } from '@shared/types'
import type { ConfigStore } from '../../services/ConfigStore'
import type { AgentService } from '../../services/AgentService'
import type { ModelRouter } from '../../services/ModelRouter'
import type { CostTrackerService } from '../../services/CostTrackerService'
import { validateInput } from '../schemas'
import { wrap } from '../../utils/ipcHelpers'

export function registerModelConfigHandlers(params: {
  configStore: ConfigStore
  agentService: AgentService
  modelRouter: ModelRouter
  costTrackerService: CostTrackerService
}): void {
  const { configStore, agentService, modelRouter, costTrackerService } = params

  ipcMain.handle(IPC_CHANNELS.MODEL_LIST, async () => {
    return wrap(() => configStore.getModels())
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_ADD, async (_, model: Omit<ModelConfig, 'id' | 'createdAt'>) => {
    const validation = validateInput(modelConfigSchema, model)
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      const newModel: ModelConfig = {
        ...model,
        id: randomUUID(),
        createdAt: new Date().toISOString()
      }
      configStore.addModel(newModel)
      // 如果是第一个模型，设为默认
      if (configStore.getModels().length === 1) {
        configStore.setDefaultModelId(newModel.id)
      }
      return newModel
    })
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_UPDATE, async (_, id: string, partial: Partial<ModelConfig>) => {
    return wrap(() => {
      configStore.updateModel(id, partial)
      agentService.invalidateProvider(id)
      return configStore.getModel(id)
    })
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_DELETE, async (_, id: string) => {
    return wrap(() => {
      configStore.deleteModel(id)
      agentService.invalidateProvider(id)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_SET_DEFAULT, async (_, id: string) => {
    return wrap(() => {
      configStore.setDefaultModelId(id)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_TEST_MODEL, async (_, config: ModelConfig) => {
    return wrap(() => agentService.testModel(config))
  })

  // ===== 模型智能路由 =====
  // 初始化模型列表
  modelRouter.updateModels(configStore.getModels())

  ipcMain.handle(IPC_CHANNELS.MODEL_ROUTE_SUGGEST, async (_, taskType: string, input: string) => {
    return wrap(() => modelRouter.suggest(taskType, input))
  })

  ipcMain.handle(IPC_CHANNELS.MODEL_ROUTE_CONFIG, async (_, config?: Partial<ModelRouteConfig>) => {
    if (config) {
      return wrap(() => modelRouter.setConfig(config))
    }
    return wrap(() => modelRouter.getConfig())
  })

  // ===== Model Pricing (handled here as it's model-cost related) =====
  ipcMain.handle(IPC_CHANNELS.COST_LIST_PRICING, async (_, modelId: string) => {
    return wrap(() => costTrackerService.getPricing(modelId))
  })

  ipcMain.handle(IPC_CHANNELS.COST_SET_PRICING, async (_, modelId: string, pricing: ModelPricing) => {
    costTrackerService.setPricing(modelId, pricing)
    return { success: true }
  })
}

// Need to import modelConfigSchema from schemas
import { modelConfigSchema } from '../schemas'
