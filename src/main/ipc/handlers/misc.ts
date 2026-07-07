// Miscellaneous IPC handlers — truly cross-cutting channels that don't fit
// a dedicated domain handler file:
// builtin tools, context window, multimodal, metrics (observability),
// adaptive learning, agent config, SDK info
//
// Domain-specific channels previously here have been split into:
//   configHandlers.ts, costHandlers.ts, hitlHandlers.ts,
//   promptHandlers.ts, planningHandlers.ts, ragHandlers.ts

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type {
  ContextWindowConfig, CustomAgentConfig,
} from '@shared/types'
import type { ContextWindowService } from '../../services/ContextWindowService'
import type { MultimodalService } from '../../services/MultimodalService'
import type { AgentConfigService } from '../../services/AgentConfigService'
import type { AdaptiveLearningService } from '../../services/AdaptiveLearningService'
import type { ObservabilityService } from '../../services/ObservabilityService'
import type { ConfigStore } from '../../services/ConfigStore'
import type { AgentService } from '../../services/AgentService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericIdOptionalSchema, genericBooleanSchema, genericNumberOptionalSchema, genericObjectSchema, genericObjectOptionalSchema, genericArraySchema } from '../schemas'
import type { Message } from '@agentprimordia/sdk'

export function registerMiscHandlers(params: {
  contextWindowService: ContextWindowService
  multimodalService: MultimodalService
  agentConfigService: AgentConfigService
  adaptiveLearningService: AdaptiveLearningService
  observabilityService: ObservabilityService
  configStore: ConfigStore
  agentService: AgentService
}): void {
  const {
    contextWindowService, multimodalService,
    agentConfigService, adaptiveLearningService,
    observabilityService, configStore, agentService,
  } = params
  const toolManager = agentService.getToolManager()

  // ===== 内置工具集 =====
  ipcMain.handle(IPC_CHANNELS.BUILTIN_TOOLS_LIST, async () => {
    return wrap(() => toolManager?.listBuiltinTools() ?? [])
  })

  ipcMain.handle(IPC_CHANNELS.BUILTIN_TOOLS_TOGGLE, async (_, name: string, enabled: boolean) => {
    const vName = validateInput(genericIdSchema, name)
    if (!vName.success) return { success: false, error: vName.error }
    const vEnabled = validateInput(genericBooleanSchema, enabled)
    if (!vEnabled.success) return { success: false, error: vEnabled.error }
    toolManager?.toggleBuiltinTool(name, enabled)
    return { success: true }
  })

  // ===== Context Window 上下文窗口管理 =====
  ipcMain.handle(IPC_CHANNELS.CONTEXT_WINDOW_GET_CONFIG, async () => {
    return wrap(() => contextWindowService.getConfig())
  })

  ipcMain.handle(IPC_CHANNELS.CONTEXT_WINDOW_SET_CONFIG, async (_, config: Partial<ContextWindowConfig>) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    contextWindowService.setConfig(config)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.CONTEXT_WINDOW_TRIM, async (_, messages: Array<{ role: string; content: string }>) => {
    const v = validateInput(genericArraySchema, messages)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => contextWindowService.trim(messages as Message[]))
  })

  ipcMain.handle(IPC_CHANNELS.CONTEXT_WINDOW_COMPRESS, async (_, messages: Array<{ role: string; content: string }>, modelConfigId: string) => {
    const vMessages = validateInput(genericArraySchema, messages)
    if (!vMessages.success) return { success: false, error: vMessages.error }
    const vId = validateInput(genericIdSchema, modelConfigId)
    if (!vId.success) return { success: false, error: vId.error }
    return wrap(async () => {
      const modelConfig = configStore.getModel(modelConfigId)
      if (!modelConfig) {
        throw new Error(`未找到模型配置: ${modelConfigId}`)
      }
      const provider = agentService.getProviderManager().createProvider(modelConfig)
      return contextWindowService.compressAsync(messages as Message[], provider)
    })
  })

  // ===== Multimodal 多模态 =====
  ipcMain.handle(IPC_CHANNELS.MULTIMODAL_FROM_FILE, async (_, filePath: string, text?: string) => {
    const v = validateInput(genericIdSchema, filePath)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => multimodalService.fromFile(filePath, text))
  })

  ipcMain.handle(IPC_CHANNELS.MULTIMODAL_CREATE_IMAGE_URL, async (_, text: string, imageURL: string, detail?: 'low' | 'high' | 'auto') => {
    const vText = validateInput(genericIdSchema, text)
    if (!vText.success) return { success: false, error: vText.error }
    const vUrl = validateInput(genericIdSchema, imageURL)
    if (!vUrl.success) return { success: false, error: vUrl.error }
    return wrap(() => multimodalService.createImageURLMessage(text, imageURL, detail))
  })

  ipcMain.handle(IPC_CHANNELS.MULTIMODAL_CREATE_IMAGE_B64, async (_, text: string, imageBase64: string, mimeType: string, detail?: 'low' | 'high' | 'auto') => {
    const vText = validateInput(genericIdSchema, text)
    if (!vText.success) return { success: false, error: vText.error }
    const vB64 = validateInput(genericIdSchema, imageBase64)
    if (!vB64.success) return { success: false, error: vB64.error }
    const vMime = validateInput(genericIdSchema, mimeType)
    if (!vMime.success) return { success: false, error: vMime.error }
    return wrap(() => multimodalService.createImageB64Message(text, imageBase64, mimeType, detail))
  })

  ipcMain.handle(IPC_CHANNELS.MULTIMODAL_CREATE_AUDIO, async (_, text: string, audioBase64: string, mimeType: string) => {
    const vText = validateInput(genericIdSchema, text)
    if (!vText.success) return { success: false, error: vText.error }
    const vB64 = validateInput(genericIdSchema, audioBase64)
    if (!vB64.success) return { success: false, error: vB64.error }
    const vMime = validateInput(genericIdSchema, mimeType)
    if (!vMime.success) return { success: false, error: vMime.error }
    return wrap(() => multimodalService.createAudioMessage(text, audioBase64, mimeType))
  })

  ipcMain.handle(IPC_CHANNELS.MULTIMODAL_CREATE_VIDEO, async (_, text: string, videoBase64: string, mimeType: string) => {
    const vText = validateInput(genericIdSchema, text)
    if (!vText.success) return { success: false, error: vText.error }
    const vB64 = validateInput(genericIdSchema, videoBase64)
    if (!vB64.success) return { success: false, error: vB64.error }
    const vMime = validateInput(genericIdSchema, mimeType)
    if (!vMime.success) return { success: false, error: vMime.error }
    return wrap(() => multimodalService.createVideoMessage(text, videoBase64, mimeType))
  })

  ipcMain.handle(IPC_CHANNELS.MULTIMODAL_TO_LLM_CONTENT, async (_, msg: any) => {
    const v = validateInput(genericObjectSchema, msg)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => multimodalService.toLLMContent(msg))
  })

  ipcMain.handle(IPC_CHANNELS.MULTIMODAL_SUPPORTED_MIME, async () => {
    return wrap(() => multimodalService.getSupportedMimeTypes())
  })

  // ===== [升级 3] 可观测性增强 — 运行时指标 =====
  ipcMain.handle(IPC_CHANNELS.METRICS_TREND, async (_, hours?: number) => {
    const v = validateInput(genericNumberOptionalSchema, hours)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => observabilityService.getTrend(hours ?? 1))
  })

  // ===== 运行时指标 =====
  ipcMain.handle(IPC_CHANNELS.METRICS_SNAPSHOT, async () => {
    return wrap(() => observabilityService.getSnapshot())
  })

  ipcMain.handle(IPC_CHANNELS.METRICS_RESET, async () => {
    observabilityService.resetMetrics()
    return { success: true }
  })

  // ===== [进化 1] Agent 自适应学习 =====
  ipcMain.handle(IPC_CHANNELS.ADAPTIVE_GET_PROFILE, async (_, agentId?: string) => {
    const v = validateInput(genericIdOptionalSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => adaptiveLearningService.getProfile(agentId))
  })

  ipcMain.handle(IPC_CHANNELS.ADAPTIVE_GET_HINTS, async (_, agentId?: string) => {
    const v = validateInput(genericIdOptionalSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => adaptiveLearningService.getHints(agentId))
  })

  ipcMain.handle(IPC_CHANNELS.ADAPTIVE_GET_PROGRESS, async (_, agentId?: string) => {
    const v = validateInput(genericIdOptionalSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => adaptiveLearningService.getProgress(agentId))
  })

  ipcMain.handle(IPC_CHANNELS.ADAPTIVE_RECORD_INTERACTION, async (_, interactionParams) => {
    const v = validateInput(genericObjectSchema, interactionParams)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => adaptiveLearningService.recordInteraction(interactionParams))
  })

  ipcMain.handle(IPC_CHANNELS.ADAPTIVE_EXTRACT_RULES, async (_, agentId?: string) => {
    const v = validateInput(genericIdOptionalSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => adaptiveLearningService.extractRules(agentId))
  })

  ipcMain.handle(IPC_CHANNELS.ADAPTIVE_CLEAR_PROFILE, async (_, agentId?: string) => {
    const v = validateInput(genericIdOptionalSchema, agentId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      adaptiveLearningService.clearProfile(agentId)
      return true
    })
  })

  // ===== 自定义 Agent 配置 =====
  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIG_LIST, async () => {
    return wrap(() => agentConfigService.list())
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIG_GET, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => agentConfigService.get(id))
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIG_ADD, async (_, config: Omit<CustomAgentConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => agentConfigService.add(config))
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIG_UPDATE, async (_, id: string, partial: Partial<CustomAgentConfig>) => {
    const vId = validateInput(genericIdSchema, id)
    if (!vId.success) return { success: false, error: vId.error }
    const vPartial = validateInput(genericObjectOptionalSchema, partial)
    if (!vPartial.success) return { success: false, error: vPartial.error }
    return wrap(() => agentConfigService.update(id, partial))
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_CONFIG_DELETE, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => agentConfigService.delete(id))
  })

  // ===== SDK 信息与错误码 =====
  ipcMain.handle(IPC_CHANNELS.SDK_GET_INFO, async () => {
    return wrap(async () => {
      const sdk = await import('@agentprimordia/sdk')
      return {
        version: sdk.VERSION,
        errorCodes: sdk.ErrorCodes,
      }
    })
  })
}
