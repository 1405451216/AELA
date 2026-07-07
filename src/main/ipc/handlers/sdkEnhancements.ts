// SDK Enhancements IPC handlers
// 为 SDKEnhancementsService 的 12 项能力创建 IPC 接口
// 同时包含 RAG 扩展配置 + 性能优化（投机执行/请求缓存）的 IPC

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { RAGExtendedConfig } from '@shared/types'
import type { SDKEnhancementsService } from '../../services/SDKEnhancementsService'
import type { RAGService } from '../../services/RAGService'
import type { AgentService } from '../../services/AgentService'
import type { ProviderManager } from '../../services/ProviderManager'
import type { ConfigStore } from '../../services/ConfigStore'
import type { MultimodalInput, MultimodalFusionConfig, Message } from '@agentprimordia/sdk'
import type { StreamingPipelineStep, VizWorkflow } from '@agentprimordia/sdk'
import type { BatchRequest } from '@agentprimordia/sdk'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericStringSchema, genericStringOptionalSchema, genericObjectSchema, genericObjectOptionalSchema, genericArraySchema, genericBooleanSchema, genericNumberOptionalSchema } from '../schemas'

/** A/B 测试配置类型 */
interface ABTestConfigIPC {
  variants: Array<{ name: string; systemPrompt: string; config?: Record<string, unknown> }>
  evaluator: {
    type: 'keyword' | 'completeness' | 'llm'
    keywords?: string[]
    criteria?: string[]
    modelConfigId?: string
  }
  repeatsPerVariant?: number
  parallel?: boolean
}

/** Worker任务类型 */
interface WorkerTask {
  type: string
  payload: Record<string, unknown>
}

/** 动态编排任务类型 */
interface DynamicTask {
  input: string
  context?: Record<string, unknown>
}

export function registerSDKEnhancementsHandlers(params: {
  sdkEnhancementsService: SDKEnhancementsService
  ragService: RAGService
  agentService: AgentService
  providerManager: ProviderManager
  configStore: ConfigStore
}): void {
  const { sdkEnhancementsService, ragService, agentService, providerManager, configStore } = params

  // ===== 1. 结构化输出提取 =====
  ipcMain.handle(IPC_CHANNELS.SDK_EXTRACT_STRUCTURED, async (_, text: string, config?: Record<string, unknown>) => {
    const v1 = validateInput(genericStringSchema, text)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericObjectOptionalSchema, config)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => sdkEnhancementsService.extractStructuredOutput(text, config))
  })

  // ===== 2. 多模态融合 =====
  ipcMain.handle(IPC_CHANNELS.SDK_FUSE_MULTIMODAL, async (_, input: MultimodalInput, config: MultimodalFusionConfig) => {
    const v1 = validateInput(genericObjectSchema, input)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericObjectSchema, config)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => sdkEnhancementsService.fuseMultimodal(input, config))
  })

  // ===== 3. 批量请求处理 =====
  ipcMain.handle(IPC_CHANNELS.SDK_BATCH_PROCESS, async (_, modelConfigId: string, requests: BatchRequest[], maxConcurrent?: number) => {
    const v1 = validateInput(genericIdSchema, modelConfigId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericArraySchema, requests)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericNumberOptionalSchema, maxConcurrent)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(async () => {
      const modelConfig = configStore.getModel(modelConfigId)
      if (!modelConfig) throw new Error(`Model config not found: ${modelConfigId}`)
      return providerManager.batchProcess(modelConfig, requests, maxConcurrent ?? 5)
    })
  })

  // ===== 4. Prompt A/B 测试 =====
  ipcMain.handle(IPC_CHANNELS.SDK_ABTEST_CREATE, async (_, name: string, config: ABTestConfigIPC) => {
    const v1 = validateInput(genericStringSchema, name)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericObjectSchema, config)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => {
      // 构造SDK兼容的evaluator
      const evaluator = {
        evaluate: async (_input: string, response: any) => {
          const content = response.content?.toLowerCase() ?? ''
          const keywords = config.evaluator.keywords ?? []
          const hits = keywords.filter((kw: string) => content.includes(kw.toLowerCase())).length
          const score = keywords.length > 0 ? hits / keywords.length : 0.5
          return { score, details: { keywordHits: hits, totalKeywords: keywords.length } }
        }
      }
      const sdkConfig = {
        variants: config.variants,
        evaluator,
        repeatsPerVariant: config.repeatsPerVariant,
        parallel: config.parallel,
      }
      sdkEnhancementsService.createABTest(name, sdkConfig)
      return { name, variantCount: config.variants?.length ?? 0 }
    })
  })

  // [新增] 运行 A/B 测试
  ipcMain.handle(IPC_CHANNELS.SDK_ABTEST_RUN, async (_, name: string, input: string, modelConfigId: string) => {
    const v1 = validateInput(genericStringSchema, name)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, input)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericIdSchema, modelConfigId)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(async () => {
      const modelConfig = configStore.getModel(modelConfigId)
      if (!modelConfig) throw new Error(`Model config not found: ${modelConfigId}`)
      const provider = providerManager.createProvider(modelConfig)
      return sdkEnhancementsService.runABTest(name, input, (variant) => ({
        run: async (input: string) => {
          const messages: Message[] = [
            { role: 'system', content: variant.systemPrompt },
            { role: 'user', content: input }
          ]
          const response = await provider.complete({ messages })
          return {
            content: response.content,
            metrics: { totalTurns: 0, totalTools: 0, duration: 0, llmLatency: 0, toolLatency: 0 }
          }
        }
      }))
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_ABTEST_RESULTS, async (_, name: string) => {
    const v = validateInput(genericStringSchema, name)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => sdkEnhancementsService.getABTestResults(name))
  })

  // ===== 5. 评估套件 =====
  ipcMain.handle(IPC_CHANNELS.SDK_EVAL_ADD_CASE, async (_, task: string, input: string, expected: string) => {
    const v1 = validateInput(genericStringSchema, task)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, input)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericStringSchema, expected)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(() => {
      sdkEnhancementsService.addEvalCase(task, input, expected)
      return { added: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_EVAL_CLEAR_CASES, async () => {
    return wrap(() => {
      sdkEnhancementsService.clearEvalCases()
      return { cleared: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_EVAL_RUN, async (_) => {
    return wrap(async () => {
      const suite = sdkEnhancementsService.getEvalSuite()
      return suite.run()
    })
  })

  // ===== 6. 流式管道 =====
  ipcMain.handle(IPC_CHANNELS.SDK_STREAMING_PIPE_CREATE, async (_, name: string, steps: StreamingPipelineStep[]) => {
    const v1 = validateInput(genericStringSchema, name)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericArraySchema, steps)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => {
      const _pipeline = sdkEnhancementsService.createStreamingPipeline(name, steps)
      return { name, stepCount: steps.length }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_STREAMING_PIPE_RUN, async (_, name: string, input: string) => {
    const v1 = validateInput(genericStringSchema, name)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, input)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(async () => {
      const pipeline = sdkEnhancementsService.getStreamingPipeline(name)
      if (!pipeline) throw new Error(`流式管道 "${name}" 不存在`)
      // SDK StreamingPipeline.run() 返回 Promise<Response[]>，非异步迭代
      // 如需流式迭代，使用 pipeline.stream(input)
      return pipeline.run(input)
    })
  })

  // ===== 7. 动态编排 + 调度器 =====
  ipcMain.handle(IPC_CHANNELS.SDK_DYNAMIC_ORCH_SCHEDULE, async (_, task: DynamicTask) => {
    const v = validateInput(genericObjectSchema, task)
    if (!v.success) return { success: false, error: v.error }
    return wrap(async () => {
      const orchestrator = sdkEnhancementsService.getDynamicOrchestrator()
      // SDK DynamicOrchestrator 使用 route(input) 进行任务路由
      return orchestrator.route(task.input)
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_SCHEDULER_STATS, async () => {
    return wrap(() => {
      const scheduler = sdkEnhancementsService.getScheduler()
      return scheduler.getStats()
    })
  })

  // ===== 8. 插件热加载 =====
  ipcMain.handle(IPC_CHANNELS.SDK_PLUGIN_LOAD, async (_, pluginPath: string) => {
    const v = validateInput(genericStringSchema, pluginPath)
    if (!v.success) return { success: false, error: v.error }
    // 安全检查：阻止从任意路径加载插件，防止被 XSS 利用执行任意代码
    const { resolve, sep } = await import('node:path')
    const pluginsDir = resolve(process.cwd(), 'plugins')
    const target = resolve(pluginPath)
    const insidePluginsDir = target === pluginsDir || target.startsWith(pluginsDir + sep)
    const validExt = target.endsWith('.js') || target.endsWith('.mjs')
    if (!insidePluginsDir || !validExt) {
      return { success: false, error: `插件路径被拒绝: 仅允许加载 ${pluginsDir} 目录下的 .js/.mjs 文件` }
    }
    return wrap(async () => {
      const loader = sdkEnhancementsService.getPluginLoader()
      await loader.load(pluginPath)
      return { path: pluginPath, loaded: true }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_PLUGIN_LIST, async () => {
    return wrap(() => {
      const loader = sdkEnhancementsService.getPluginLoader()
      return loader.list()
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_PLUGIN_UNLOAD, async (_, pluginName: string) => {
    const v = validateInput(genericStringSchema, pluginName)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      const loader = sdkEnhancementsService.getPluginLoader()
      loader.unload(pluginName)
      return true
    })
  })

  // ===== 9. Worker 线程池 =====
  ipcMain.handle(IPC_CHANNELS.SDK_WORKER_POOL_STATS, async () => {
    return wrap(() => {
      const pool = sdkEnhancementsService.getWorkerPool()
      if (!pool) return { available: false, message: 'Worker threads 不可用' }
      // SDK ComputeWorkerPool 使用 stats getter（不是 getStats 方法）
      return { available: true, ...pool.stats }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_WORKER_POOL_EXEC, async (_, task: WorkerTask) => {
    const v = validateInput(genericObjectSchema, task)
    if (!v.success) return { success: false, error: v.error }
    return wrap(async () => {
      const pool = sdkEnhancementsService.getWorkerPool()
      if (!pool) throw new Error('Worker threads 不可用')
      // SDK ComputeWorkerPool 使用 run() 方法（不是 execute）
      return pool.run(task)
    })
  })

  // ===== 10. 可视化工具 =====
  // SDK MermaidGenerator/DOTGenerator.generate 需要 VizWorkflow 对象
  ipcMain.handle(IPC_CHANNELS.SDK_VIZ_MERMAID, async (_, workflow: VizWorkflow) => {
    const v = validateInput(genericObjectSchema, workflow)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      const gen = sdkEnhancementsService.getMermaidGenerator()
      return gen.generate(workflow)
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_VIZ_DOT, async (_, workflow: VizWorkflow) => {
    const v = validateInput(genericObjectSchema, workflow)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      const gen = sdkEnhancementsService.getDOTGenerator()
      return gen.generate(workflow)
    })
  })

  // ===== 11. Agent 监控 =====
  // SDK AgentMonitor 使用 getSnapshot() 获取当前快照
  ipcMain.handle(IPC_CHANNELS.SDK_AGENT_MONITOR_STATS, async () => {
    return wrap(() => {
      const monitor = sdkEnhancementsService.getAgentMonitor()
      return monitor.getSnapshot()
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_AGENT_MONITOR_EVENTS, async (_) => {
    return wrap(() => {
      const monitor = sdkEnhancementsService.getAgentMonitor()
      // SDK AgentMonitor 没有 getEvents 方法，返回当前快照
      return monitor.getSnapshot()
    })
  })

  // ===== 12. 缓存统计（SDKEnhancementsService 层面） =====
  ipcMain.handle(IPC_CHANNELS.SDK_CACHE_STATS, async () => {
    return wrap(() => {
      // 返回 Agent 缓存统计
      return agentService.getCacheStats()
    })
  })

  ipcMain.handle(IPC_CHANNELS.SDK_CACHE_CLEAR, async () => {
    return wrap(() => {
      agentService.clearCache()
      return true
    })
  })

  // ===== RAG 扩展配置 IPC =====
  ipcMain.handle(IPC_CHANNELS.RAG_SET_CONFIG_EX, async (_, config: Partial<RAGExtendedConfig>) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      ragService.setConfig(config)
      return ragService.getConfig()
    })
  })

  ipcMain.handle(IPC_CHANNELS.RAG_GET_CONFIG_EX, async () => {
    return wrap(() => ragService.getConfig())
  })

  ipcMain.handle(IPC_CHANNELS.RAG_STORE_STATS, async () => {
    return wrap(() => ragService.getRAGStoreStats())
  })

  ipcMain.handle(IPC_CHANNELS.RAG_FUSION_CONFIG, async () => {
    return wrap(() => ragService.getFusionConfig())
  })

  // ===== 性能优化 IPC（投机执行 + 请求缓存） =====
  ipcMain.handle(IPC_CHANNELS.AGENT_SPECULATIVE_STATS, async () => {
    return wrap(() => agentService.getSpeculativeStats())
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_SPECULATIVE_RESET, async () => {
    return wrap(() => {
      agentService.resetSpeculative()
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_SPECULATIVE_TOGGLE, async (_, enabled: boolean) => {
    const v = validateInput(genericBooleanSchema, enabled)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      agentService.setSpeculativeEnabled(enabled)
      return agentService.getSpeculativeConfig()
    })
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_CACHE_STATS, async () => {
    return wrap(() => agentService.getCacheStats())
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_CACHE_CLEAR, async () => {
    return wrap(() => {
      agentService.clearCache()
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.AGENT_CACHE_TOGGLE, async (_, enabled: boolean) => {
    const v = validateInput(genericBooleanSchema, enabled)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      agentService.setCacheEnabled(enabled)
      return agentService.isCacheEnabled()
    })
  })
}
