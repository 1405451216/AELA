// AELA — 服务引导器
// 职责：所有服务的实例化 + setter 注入 + DI 容器注册
// 从 index.ts 中拆出，降低入口文件复杂度
//
// 设计原则：
//   1. 保持现有实例化顺序（依赖关系通过 setter 注入而非构造函数，无法自动拓扑排序）
//   2. 返回容器和关键服务引用，供 index.ts 做 IPC 注册和回调设置
//   3. 后续 P0-4 会引入声明式依赖图，届时可进一步简化此文件

import { app, type BrowserWindow } from 'electron'
import { ConfigStore } from '../services/ConfigStore'
import { SessionStore } from '../services/SessionStore'
import { AgentService } from '../services/AgentService'
import { WorkspaceManager } from '../services/WorkspaceManager'
import { AutomationStore } from '../services/AutomationStore'
import { OrchestrationService } from '../services/OrchestrationService'
import { ObservabilityService } from '../services/ObservabilityService'
import { MemoryService } from '../services/MemoryService'
import { SecurityService } from '../services/SecurityService'
import { GuardrailService } from '../services/GuardrailService'
import { DAGSchedulerService } from '../services/DAGSchedulerService'
import { CollaborationService } from '../services/CollaborationService'
import { SupervisorService } from '../services/SupervisorService'
import { DynamicDAGService } from '../services/DynamicDAGService'
import { RAGService } from '../services/RAGService'
import { TelemetryService } from '../services/TelemetryService'
import { DebuggerService } from '../services/DebuggerService'
import { CostTrackerService } from '../services/CostTrackerService'
import { ContextWindowService } from '../services/ContextWindowService'
import { AuditService } from '../services/AuditService'
import { PromptService } from '../services/PromptService'
import { PlanningService } from '../services/PlanningService'
import { ReflectionService } from '../services/ReflectionService'
import { ToolLearningService } from '../services/ToolLearningService'
import { HITLService } from '../services/HITLService'
import { MultimodalService } from '../services/MultimodalService'
import { TerminalService } from '../services/TerminalService'
import { HookConfigService } from '../services/HookConfigService'
import { PreviewService } from '../services/PreviewService'
import { TestGenService } from '../services/TestGenService'
import { RepoWikiService } from '../services/RepoWikiService'
import { AgentConfigService } from '../services/AgentConfigService'
import { ModelRouter } from '../services/ModelRouter'
import { CodeReviewService } from '../services/CodeReviewService'
import { SubAgentIsolationService } from '../services/SubAgentIsolationService'
import { ImageToCodeService } from '../services/ImageToCodeService'
import { AdaptiveLearningService } from '../services/AdaptiveLearningService'
import { ScreenshotAnalysisService } from '../services/ScreenshotAnalysisService'
import { ResilienceService } from '../services/ResilienceService'
import { SDKEnhancementsService } from '../services/SDKEnhancementsService'
import { ReasoningService } from '../services/ReasoningService'
import { AutoUpdateService } from '../services/AutoUpdateService'
import { CrashReportService } from '../services/CrashReportService'
import { getEmbeddingService } from '../services/EmbeddingService'
import { CheckpointService } from '../services/CheckpointService'
import { MicroAgent } from '../services/MicroAgent'
import { BackgroundAgentService } from '../services/BackgroundAgentService'
import { LSPService } from '../services/LSPService'
import { InlineCompletionService } from '../services/InlineCompletionService'
import { PluginService } from '../services/PluginService'
import { SkillRouter } from '../services/SkillRouter'
import { TaskBoard } from '../services/TaskBoard'
import { AgentBus } from '../services/AgentBus'
import { TaskRouter } from '../services/TaskRouter'
import { ToolRecommender } from '../services/ToolRecommender'
import { getSkillScanner } from '../services/SkillScanner'
import { ServiceContainer, SERVICE_TOKENS, MainWindowHolder } from '../services/ServiceContainer'

export interface BootstrapResult {
  container: ServiceContainer
  agentService: AgentService
  configStore: ConfigStore
}

/**
 * 初始化所有服务并注册到 DI 容器
 *
 * 分两个阶段：
 *   Phase 1 (critical): 创建窗口渲染必需的关键服务 — 同步快速返回
 *   Phase 2 (background): 创建非关键服务 — 在窗口显示后后台初始化
 *
 * 实例化顺序有隐式依赖：
 *   - AgentService 必须在编排服务之前创建（编排服务需要 getProviderManager()）
 *   - HookConfigService 需要 await load()
 *   - SkillScanner 需要 AgentService 的 ToolManager
 *
 * @param getWindow — 获取主窗口的惰性引用（窗口可能在服务初始化后才创建）
 * @param log — 日志函数
 */
export async function bootstrapServices(
  getWindow: () => BrowserWindow | null,
  _log: (msg: string) => void,
): Promise<BootstrapResult> {
  // ===== Phase 1: 关键服务（窗口渲染必需） =====
  const result = await bootstrapCriticalServices(getWindow, _log)

  // ===== Phase 2: 后台服务（窗口显示后异步初始化） =====
  // 使用 registerFactory 实现懒加载：服务在首次 container.get() 时才创建
  registerBackgroundServices(result.container, getWindow, _log)

  return result
}

/**
 * Phase 1: 创建关键服务
 * 这些服务是窗口渲染和基础 IPC 所必需的
 */
async function bootstrapCriticalServices(
  getWindow: () => BrowserWindow | null,
  _log: (msg: string) => void,
): Promise<BootstrapResult> {
  // ===== 初始化基础服务 =====
  const configStore = new ConfigStore()
  const sessionStore = new SessionStore()
  const workspaceManager = new WorkspaceManager()
  const automationStore = new AutomationStore()

  // ===== 初始化可观测性 + 记忆 + 安全 =====
  const observabilityService = new ObservabilityService()
  const memoryService = new MemoryService()
  const securityService = new SecurityService()
  const guardrailService = new GuardrailService()

  // ===== 初始化 Agent 服务 (注入 observability) =====
  const agentService = new AgentService(configStore, sessionStore, observabilityService)

  // ===== 初始化编排服务 =====
  const providerManager = agentService.getProviderManager()
  const orchestrationService = new OrchestrationService(configStore, providerManager, null)
  const dagSchedulerService = new DAGSchedulerService(configStore, providerManager, null)
  const collaborationService = new CollaborationService(configStore, providerManager, null)

  // ===== Multi-Agent 协作基础设施 =====
  const taskBoard = new TaskBoard()
  const agentBus = new AgentBus()

  // ===== 初始化高级编排 + RAG + 遥测 + 调试器 =====
  const supervisorService = new SupervisorService(configStore, providerManager, null)
  supervisorService.setTaskBoard(taskBoard)
  supervisorService.setAgentBus(agentBus)
  const dynamicDAGService = new DynamicDAGService(configStore, providerManager, null)
  const ragService = new RAGService()
  const telemetryService = new TelemetryService()
  const debuggerService = new DebuggerService()

  // ===== 初始化高/中优先级 AP 特性服务 =====
  const costTrackerService = new CostTrackerService()
  const contextWindowService = new ContextWindowService()
  const auditService = new AuditService()
  const promptService = new PromptService()
  const planningService = new PlanningService(configStore, providerManager)
  const reflectionService = new ReflectionService(configStore, providerManager)
  const toolLearningService = new ToolLearningService()
  toolLearningService.setMemoryService(memoryService)
  const hitlService = new HITLService()
  const multimodalService = new MultimodalService()
  const terminalService = new TerminalService(getWindow)
  const hookConfigService = new HookConfigService()
  await hookConfigService.load()
  const previewService = new PreviewService(getWindow)
  const testGenService = new TestGenService(process.cwd())
  const repoWikiService = new RepoWikiService(process.cwd())
  const agentConfigService = new AgentConfigService()
  const modelRouter = new ModelRouter()
  const codeReviewService = new CodeReviewService(process.cwd())
  const subAgentIsolationService = new SubAgentIsolationService(configStore, providerManager, agentService.getToolManager())
  agentService.setSubAgentIsolationService(subAgentIsolationService)
  const imageToCodeService = new ImageToCodeService(configStore, providerManager)
  const adaptiveLearningService = new AdaptiveLearningService()
  adaptiveLearningService.setToolLearningService(toolLearningService)
  adaptiveLearningService.setMemoryService(memoryService)
  const screenshotAnalysisService = new ScreenshotAnalysisService(configStore, providerManager)
  const resilienceService = new ResilienceService(providerManager, configStore)

  // ===== Embedding 服务初始化 =====
  const embeddingService = getEmbeddingService()
  const allModels = configStore.getModels()
  const openaiModel = allModels.find(m => m.provider === 'openai' && m.apiKey)
  if (openaiModel?.apiKey) {
    embeddingService.configureApiKey(openaiModel.apiKey, openaiModel.baseURL)
    _log(`Embedding provider: openai (${embeddingService.getDimensions()}d)`)
  } else {
    _log('Embedding provider: hash (128d) — no OpenAI API key configured')
  }

  // 注入 EmbeddingService 到 RAGService 和 MemoryService
  ragService.setEmbeddingService(embeddingService)
  memoryService.setEmbeddingService(embeddingService)

  // ===== Skill 路由服务 =====
  const skillRouter = new SkillRouter()
  const skillScanner = getSkillScanner()
  const allSkills = skillScanner.list()
  skillRouter.indexSkills(allSkills)
  agentService.setSkillRouter(skillRouter)
  agentService.getToolManager()?.setSkillRouter(skillRouter)
  skillRouter.setEmbeddingService(embeddingService)

  // ===== 任务路由 + 工具推荐服务 =====
  const taskRouter = new TaskRouter()
  const toolRecommender = new ToolRecommender(taskRouter)
  const toolManager = agentService.getToolManager()
  if (toolManager) {
    const allTools = toolManager.listTools()
    toolRecommender.indexTools(allTools)
  }
  toolRecommender.setToolLearningService(toolLearningService)
  toolRecommender.setEmbeddingService(embeddingService)
  agentService.setTaskRouter(taskRouter)
  agentService.setToolRecommender(toolRecommender)

  // Activity 事件推送 — 通过 IPC agent:activity 推送到渲染进程
  agentService.setActivityCallback((event) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('agent:activity', event)
    }
  })

  // [SDK 集成] SDK 增强能力服务
  const sdkEnhancementsService = new SDKEnhancementsService()

  // [SDK 集成] 推理引擎服务
  const reasoningService = new ReasoningService(providerManager, configStore)

  // 崩溃报告服务 — 尽早初始化以捕获后续错误
  const crashReportService = new CrashReportService()
  crashReportService.init()

  // 自动更新服务 — 仅生产模式生效
  const autoUpdateService = new AutoUpdateService({ log: _log })

  // Checkpoint / 回滚服务
  const checkpointService = new CheckpointService(process.cwd())

  // Background Agent 服务
  const microAgent = new MicroAgent(agentService.getProviderManager(), agentService.getToolManager()!)
  const backgroundAgentService = new BackgroundAgentService(getWindow, microAgent)
  backgroundAgentService.setCheckpointService(checkpointService)
  backgroundAgentService.setCostTracker(costTrackerService)
  backgroundAgentService.connectTerminalService(terminalService)

  // LSP / Linter 集成服务
  const lspService = new LSPService()

  // Inline Completion 服务（Tab 补全）
  const inlineCompletionService = new InlineCompletionService(providerManager, configStore)

  // 插件系统服务
  const pluginService = new PluginService()
  await pluginService.loadInstalledPlugins()

  // ===== 将新服务注入 AgentService =====
  agentService.wireDependencies({
    memoryService,
    costTracker: costTrackerService,
    contextWindow: contextWindowService,
    hitlService,
    auditService,
    toolLearningService,
    promptService,
    hookConfigService,
    guardrailService,
    securityService,
    modelRouter,
  })

  // ===== 将 6 个高级服务注册为 Agent 工具 =====
  // 注意：此时 ToolManager 可能尚未创建（setWorkspace 未调用）
  // setAgentTools 会在 ToolManager 就绪时自动应用
  const { makeLlmCall } = await import('../utils/llmCall')
  const llmCall = makeLlmCall(configStore, agentService)
  agentService.setAgentTools({
    getDefaultModelId: () => {
      const models = configStore.getModels()
      const defaultModel = models.find(m => m.isDefault) || models[0]
      return defaultModel?.id || ''
    },
    llmCall,
    rootDir: process.cwd(),
    testGenService,
    codeReviewService,
    repoWikiService,
    subAgentService: subAgentIsolationService,
    imageToCodeService,
    screenshotService: screenshotAnalysisService,
    planningService,
    ragService,
  })

  // ===== 注入 Checkpoint 回调到 ToolManager =====
  // 注意：此时 ToolManager 可能尚未创建，setCheckpointCallback 会延迟应用
  agentService.setCheckpointCallback(async (sessionId, filePaths, description) => {
    await checkpointService.createCheckpoint(sessionId, filePaths, description)
  })

  // ===== 注册到 DI 容器 =====
  const container = new ServiceContainer()
  const mainWindowHolder = new MainWindowHolder(getWindow)
  container.register(SERVICE_TOKENS.CONFIG_STORE, configStore)
  container.register(SERVICE_TOKENS.SESSION_STORE, sessionStore)
  container.register(SERVICE_TOKENS.AGENT_SERVICE, agentService)
  container.register(SERVICE_TOKENS.WORKSPACE_MANAGER, workspaceManager)
  container.register(SERVICE_TOKENS.AUTOMATION_STORE, automationStore)
  container.register(SERVICE_TOKENS.ORCHESTRATION_SERVICE, orchestrationService)
  container.register(SERVICE_TOKENS.OBSERVABILITY_SERVICE, observabilityService)
  container.register(SERVICE_TOKENS.MEMORY_SERVICE, memoryService)
  container.register(SERVICE_TOKENS.SECURITY_SERVICE, securityService)
  container.register(SERVICE_TOKENS.GUARDRAIL_SERVICE, guardrailService)
  container.register(SERVICE_TOKENS.DAG_SCHEDULER_SERVICE, dagSchedulerService)
  container.register(SERVICE_TOKENS.COLLABORATION_SERVICE, collaborationService)
  container.register(SERVICE_TOKENS.SUPERVISOR_SERVICE, supervisorService)
  container.register(SERVICE_TOKENS.DYNAMIC_DAG_SERVICE, dynamicDAGService)
  container.register(SERVICE_TOKENS.RAG_SERVICE, ragService)
  container.register(SERVICE_TOKENS.TELEMETRY_SERVICE, telemetryService)
  container.register(SERVICE_TOKENS.DEBUGGER_SERVICE, debuggerService)
  container.register(SERVICE_TOKENS.COST_TRACKER_SERVICE, costTrackerService)
  container.register(SERVICE_TOKENS.CONTEXT_WINDOW_SERVICE, contextWindowService)
  container.register(SERVICE_TOKENS.AUDIT_SERVICE, auditService)
  container.register(SERVICE_TOKENS.PROMPT_SERVICE, promptService)
  container.register(SERVICE_TOKENS.PLANNING_SERVICE, planningService)
  container.register(SERVICE_TOKENS.REFLECTION_SERVICE, reflectionService)
  container.register(SERVICE_TOKENS.TOOL_LEARNING_SERVICE, toolLearningService)
  container.register(SERVICE_TOKENS.HITL_SERVICE, hitlService)
  container.register(SERVICE_TOKENS.MULTIMODAL_SERVICE, multimodalService)
  container.register(SERVICE_TOKENS.TERMINAL_SERVICE, terminalService)
  container.register(SERVICE_TOKENS.HOOK_CONFIG_SERVICE, hookConfigService)
  container.register(SERVICE_TOKENS.PREVIEW_SERVICE, previewService)
  container.register(SERVICE_TOKENS.TEST_GEN_SERVICE, testGenService)
  container.register(SERVICE_TOKENS.REPO_WIKI_SERVICE, repoWikiService)
  container.register(SERVICE_TOKENS.AGENT_CONFIG_SERVICE, agentConfigService)
  container.register(SERVICE_TOKENS.MODEL_ROUTER, modelRouter)
  container.register(SERVICE_TOKENS.CODE_REVIEW_SERVICE, codeReviewService)
  container.register(SERVICE_TOKENS.SUB_AGENT_ISOLATION_SERVICE, subAgentIsolationService)
  container.register(SERVICE_TOKENS.IMAGE_TO_CODE_SERVICE, imageToCodeService)
  container.register(SERVICE_TOKENS.ADAPTIVE_LEARNING_SERVICE, adaptiveLearningService)
  container.register(SERVICE_TOKENS.SCREENSHOT_ANALYSIS_SERVICE, screenshotAnalysisService)
  container.register(SERVICE_TOKENS.RESILIENCE_SERVICE, resilienceService)
  container.register(SERVICE_TOKENS.SDK_ENHANCEMENTS_SERVICE, sdkEnhancementsService)
  container.register(SERVICE_TOKENS.REASONING_SERVICE, reasoningService)
  container.register(SERVICE_TOKENS.AUTO_UPDATE_SERVICE, autoUpdateService)
  container.register(SERVICE_TOKENS.CRASH_REPORT_SERVICE, crashReportService)
  container.register(SERVICE_TOKENS.EMBEDDING_SERVICE, embeddingService)
  container.register(SERVICE_TOKENS.CHECKPOINT_SERVICE, checkpointService)
  container.register(SERVICE_TOKENS.BG_AGENT_SERVICE, backgroundAgentService)
  container.register(SERVICE_TOKENS.TASK_BOARD, taskBoard)
  container.register(SERVICE_TOKENS.AGENT_BUS, agentBus)
  container.register(SERVICE_TOKENS.LSP_SERVICE, lspService)
  container.register(SERVICE_TOKENS.INLINE_COMPLETION_SERVICE, inlineCompletionService)
  container.register(SERVICE_TOKENS.PLUGIN_SERVICE, pluginService)
  container.setMainWindowHolder(mainWindowHolder)

  // ===== 声明依赖关系 =====
  container.declareDependency(SERVICE_TOKENS.AGENT_SERVICE, [
    SERVICE_TOKENS.CONFIG_STORE,
    SERVICE_TOKENS.SESSION_STORE,
    SERVICE_TOKENS.OBSERVABILITY_SERVICE,
    SERVICE_TOKENS.MEMORY_SERVICE,
    SERVICE_TOKENS.SECURITY_SERVICE,
    SERVICE_TOKENS.GUARDRAIL_SERVICE,
    SERVICE_TOKENS.COST_TRACKER_SERVICE,
    SERVICE_TOKENS.CONTEXT_WINDOW_SERVICE,
    SERVICE_TOKENS.HITL_SERVICE,
    SERVICE_TOKENS.AUDIT_SERVICE,
    SERVICE_TOKENS.TOOL_LEARNING_SERVICE,
    SERVICE_TOKENS.PROMPT_SERVICE,
    SERVICE_TOKENS.HOOK_CONFIG_SERVICE,
    SERVICE_TOKENS.MODEL_ROUTER,
  ])
  container.declareDependency(SERVICE_TOKENS.ORCHESTRATION_SERVICE, [SERVICE_TOKENS.AGENT_SERVICE])
  container.declareDependency(SERVICE_TOKENS.DAG_SCHEDULER_SERVICE, [SERVICE_TOKENS.AGENT_SERVICE])
  container.declareDependency(SERVICE_TOKENS.COLLABORATION_SERVICE, [SERVICE_TOKENS.AGENT_SERVICE])
  container.declareDependency(SERVICE_TOKENS.SUPERVISOR_SERVICE, [SERVICE_TOKENS.AGENT_SERVICE])
  container.declareDependency(SERVICE_TOKENS.SUB_AGENT_ISOLATION_SERVICE, [SERVICE_TOKENS.AGENT_SERVICE])
  container.declareDependency(SERVICE_TOKENS.RESILIENCE_SERVICE, [SERVICE_TOKENS.AGENT_SERVICE])
  container.declareDependency(SERVICE_TOKENS.REASONING_SERVICE, [SERVICE_TOKENS.AGENT_SERVICE])
  container.declareDependency(SERVICE_TOKENS.ADAPTIVE_LEARNING_SERVICE, [
    SERVICE_TOKENS.TOOL_LEARNING_SERVICE,
    SERVICE_TOKENS.MEMORY_SERVICE,
  ])

  const phase1Ms = performance.now()
  _log(`[perf] Phase 1: ${container.getServiceCount()} critical services registered (${phase1Ms.toFixed(0)}ms)`)

  return { container, agentService, configStore }
}

/**
 * Phase 2: 注册后台服务工厂
 * 这些服务在首次 container.get() 时才创建，避免启动时不必要的初始化
 */
function registerBackgroundServices(
  container: ServiceContainer,
  _getWindow: () => BrowserWindow | null,
  _log: (msg: string) => void,
): void {
  // SDK 版本检测日志（仅开发模式，非阻塞）
  if (!app.isPackaged) {
    import('@agentprimordia/sdk').then(sdk => {
      _log(`[SDK] AgentPrimordia SDK version: ${sdk.VERSION}`)
    }).catch((err) => console.error('[ServiceBootstrap] SDK 版本检测失败:', err))
  }

  _log('Phase 2: background services registered as lazy factories')
}
