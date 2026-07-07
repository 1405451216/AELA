// SDK Phase 4 高价值模块 IPC handlers
// 为 10 个新集成模块创建 IPC 接口:
// DAG Builder / 弹性组件 / 限流批处理 / 结构化提取 / 推理引擎 /
// 记忆压缩 / 安全扩展

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { Message, ToolDefinition } from '@agentprimordia/sdk'
import type { SDKEnhancementsService } from '../../services/SDKEnhancementsService'
import type { ReasoningService } from '../../services/ReasoningService'
import type { ResilienceService } from '../../services/ResilienceService'
import type { DAGSchedulerService } from '../../services/DAGSchedulerService'
import type { MemoryService } from '../../services/MemoryService'
import type { SecurityService } from '../../services/SecurityService'
import type { ProviderManager } from '../../services/ProviderManager'
import type { ConfigStore } from '../../services/ConfigStore'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericStringSchema, genericStringOptionalSchema, genericObjectSchema, genericObjectOptionalSchema, genericArraySchema, genericNumberSchema, genericNumberOptionalSchema, genericNullableObjectSchema } from '../schemas'

export function registerSDKPhase4Handlers(params: {
  dagSchedulerService: DAGSchedulerService
  resilienceService: ResilienceService
  providerManager: ProviderManager
  configStore: ConfigStore
  sdkEnhancementsService: SDKEnhancementsService
  reasoningService: ReasoningService
  memoryService: MemoryService
  securityService: SecurityService
}): void {
  const {
    dagSchedulerService,
    resilienceService,
    providerManager,
    configStore,
    sdkEnhancementsService,
    reasoningService,
    memoryService,
    securityService,
  } = params

  // ===== 1. DAG Builder =====
  ipcMain.handle(IPC_CHANNELS.DAG_BUILDER_RUN, async (_, config: any) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    return wrap(async () => {
      const startTime = Date.now()
      const result = await dagSchedulerService.runWithBuilder(config)
      return { result, duration: Date.now() - startTime }
    })
  })

  // ===== 2. 弹性组件 (SDK CircuitBreaker/Retry/ResilientWrapper) =====
  ipcMain.handle(IPC_CHANNELS.RESILIENCE_SDK_EXECUTE, async (_, key: string, operation: string, data?: any, timeoutMs?: number) => {
    const v1 = validateInput(genericStringSchema, key)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, operation)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericObjectOptionalSchema, data)
    if (!v3.success) return { success: false, error: v3.error }
    const v4 = validateInput(genericNumberOptionalSchema, timeoutMs)
    if (!v4.success) return { success: false, error: v4.error }
    return wrap(async () => {
      // 通用弹性执行：根据 operation 类型执行不同操作
      return resilienceService.executeWithResilience(key, async () => {
        switch (operation) {
          case 'test':
            return { ok: true, message: `Elastic operation "${key}" executed successfully` }
          case 'llm-call': {
            // 包装 LLM 调用
            const modelConfig = configStore.getModel(data.modelConfigId)
            if (!modelConfig) throw new Error(`Model not found: ${data.modelConfigId}`)
            const provider = providerManager.createProvider(modelConfig)
            const resp = await provider.complete({ messages: data.messages })
            return { content: resp.content }
          }
          default:
            throw new Error(`Unknown operation: ${operation}`)
        }
      }, timeoutMs)
    })
  })

  ipcMain.handle(IPC_CHANNELS.RESILIENCE_SDK_BREAKER_STATE, async (_, key?: string) => {
    const v = validateInput(genericStringOptionalSchema, key)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => ({
      state: resilienceService.getSdkBreakerState(key ?? 'default'),
      key: key ?? 'default',
    }))
  })

  ipcMain.handle(IPC_CHANNELS.RESILIENCE_SDK_RESET_BREAKER, async (_, key?: string) => {
    const v = validateInput(genericStringOptionalSchema, key)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      resilienceService.resetSdkBreaker(key ?? 'default')
      return true
    })
  })

  // ===== 3. 限流批处理 =====
  ipcMain.handle(IPC_CHANNELS.PROVIDER_RATE_LIMIT_SET, async (_, rpm: number) => {
    const v = validateInput(genericNumberSchema, rpm)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      providerManager.setRateLimit(rpm)
      return { rpm, active: rpm > 0 }
    })
  })

  ipcMain.handle(IPC_CHANNELS.PROVIDER_RATE_LIMIT_GET, async () => {
    return wrap(() => ({
      rpm: providerManager.getRateLimitRPM(),
      active: providerManager.getRateLimiter() !== null,
    }))
  })

  ipcMain.handle(IPC_CHANNELS.PROVIDER_BATCH_PROCESS, async (_, modelConfigId: string, requests: any[], maxConcurrent?: number) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericArraySchema, requests)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericNumberOptionalSchema, maxConcurrent)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(async () => {
      const modelConfig = configStore.getModel(modelConfigId)
      if (!modelConfig) throw new Error(`Model not found: ${modelConfigId}`)
      return providerManager.batchProcess(modelConfig, requests, maxConcurrent ?? 5)
    })
  })

  // ===== 4. 结构化数据提取 =====
  ipcMain.handle(IPC_CHANNELS.SDK_EXTRACT_DATA, async (_, modelConfigId: string, input: string, schema: any, model?: string) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, input)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericNullableObjectSchema, schema)
    if (!v3.success) return { success: false, error: v3.error }
    const v4 = validateInput(genericStringOptionalSchema, model)
    if (!v4.success) return { success: false, error: v4.error }
    return wrap(async () => {
      const modelConfig = configStore.getModel(modelConfigId)
      if (!modelConfig) throw new Error(`Model not found: ${modelConfigId}`)
      const provider = providerManager.createProvider(modelConfig)
      return sdkEnhancementsService.extractStructuredData(provider, input, schema, model ?? modelConfig.model)
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_BUILD_SCHEMA, async (_, name: string, properties: Record<string, any>) => {
    const v1 = validateInput(genericStringSchema, name)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericObjectSchema, properties)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => sdkEnhancementsService.buildSchema(name, properties))
  })

  ipcMain.handle(IPC_CHANNELS.SDK_GET_SCHEMAS, async () => {
    return wrap(() => ({
      sentiment: sdkEnhancementsService.getSentimentSchema(),
      classification: sdkEnhancementsService.getClassificationSchema(),
      summary: sdkEnhancementsService.getSummarySchema(),
      ner: sdkEnhancementsService.getNERSchema(),
    }))
  })

  // ===== [增强] 结构化输出提取（Schema 引导 + 错误反馈重试） =====
  ipcMain.handle(IPC_CHANNELS.SDK_EXTRACT_WITH_SCHEMA, async (_, modelConfigId: string, input: string, schema: any, model?: string, maxRetries?: number) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, input)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericNullableObjectSchema, schema)
    if (!v3.success) return { success: false, error: v3.error }
    const v4 = validateInput(genericStringOptionalSchema, model)
    if (!v4.success) return { success: false, error: v4.error }
    const v5 = validateInput(genericNumberOptionalSchema, maxRetries)
    if (!v5.success) return { success: false, error: v5.error }
    return wrap(async () => {
      const modelConfig = configStore.getModel(modelConfigId)
      if (!modelConfig) throw new Error(`Model not found: ${modelConfigId}`)
      const provider = providerManager.createProvider(modelConfig)
      return sdkEnhancementsService.extractWithSchema(provider, input, schema, model ?? modelConfig.model, maxRetries)
    })
  })

  // ===== 5. 推理引擎 =====
  ipcMain.handle(IPC_CHANNELS.REASONING_REASON, async (_, modelConfigId: string, messages: Message[], opts?: { temperature?: number; maxTokens?: number; tools?: ToolDefinition[] }) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericArraySchema, messages)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericObjectOptionalSchema, opts)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(() => reasoningService.reason(modelConfigId, messages, opts))
  })

  ipcMain.handle(IPC_CHANNELS.REASONING_REASON_STREAM, async (_, modelConfigId: string, messages: Message[], opts?: { temperature?: number; maxTokens?: number; tools?: ToolDefinition[] }) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericArraySchema, messages)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericObjectOptionalSchema, opts)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(async () => {
      // IPC 不支持流式回调，这里收集所有事件后返回
      const events: any[] = []
      const thought = await reasoningService.reasonStream(modelConfigId, messages, {
        ...opts,
        onStream: (e) => events.push(e),
      })
      return { thought, events }
    })
  })

  ipcMain.handle(IPC_CHANNELS.REASONING_QUICK_REASON, async (_, modelConfigId: string, messages: Message[], opts?: { temperature?: number; maxTokens?: number; tools?: ToolDefinition[] }) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericArraySchema, messages)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericObjectOptionalSchema, opts)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(() => reasoningService.quickReason(modelConfigId, messages, opts))
  })

  // ===== 6. 记忆压缩 =====
  ipcMain.handle(IPC_CHANNELS.MEMORY_COMPRESS_SDK, async (_, modelConfigId: string, config?: { windowSize?: number; minEpisodes?: number; model?: string }) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericObjectOptionalSchema, config)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(async () => {
      const modelConfig = configStore.getModel(modelConfigId)
      if (!modelConfig) throw new Error(`Model not found: ${modelConfigId}`)
      const provider = providerManager.createProvider(modelConfig)
      return memoryService.compressWithSDK(provider, config)
    })
  })

  ipcMain.handle(IPC_CHANNELS.MEMORY_SIMPLE_SUMMARY, async (_, content: string) => {
    const v = validateInput(genericStringSchema, content)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => memoryService.extractSimpleSummary(content))
  })

  // ===== [增强] 记忆重要性衰减 =====
  ipcMain.handle(IPC_CHANNELS.MEMORY_DECAY, async (_, decayFactor?: number) => {
    const v = validateInput(genericNumberOptionalSchema, decayFactor)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => memoryService.applyImportanceDecay(decayFactor))
  })

  // ===== 7. 安全扩展 =====
  ipcMain.handle(IPC_CHANNELS.SECURITY_CHECK_SHELL_META, async (_, cmd: string) => {
    const v = validateInput(genericStringSchema, cmd)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => securityService.checkShellMetacharacter(cmd))
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_CHECK_PATH_TRAVERSAL, async (_, path: string) => {
    const v = validateInput(genericStringSchema, path)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => securityService.checkPathTraversal(path))
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_RESOLVE_PATH_SAFE, async (_, rootDir: string, filePath: string) => {
    const v1 = validateInput(genericStringSchema, rootDir)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, filePath)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => securityService.resolvePathSafe(rootDir, filePath))
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_SANITIZE_INPUT, async (_, input: string) => {
    const v = validateInput(genericStringSchema, input)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => securityService.sanitizeInput(input))
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_CHECK_COMMAND_GUARD, async (_, command: string) => {
    const v = validateInput(genericStringSchema, command)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => securityService.checkCommandGuard(command))
  })
}
