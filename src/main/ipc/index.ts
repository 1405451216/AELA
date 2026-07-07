// IPC 处理器注册
// Thin barrel — delegates to domain-specific handler files under handlers/

import type { ServiceContainer} from '../services/ServiceContainer';
import { SERVICE_TOKENS } from '../services/ServiceContainer'
import type { ConfigStore } from '../services/ConfigStore'
import type { SessionStore } from '../services/SessionStore'
import type { AgentService } from '../services/AgentService'
import type { WorkspaceManager } from '../services/WorkspaceManager'
import { getSkillScanner } from '../services/SkillScanner'
import type { AutomationStore } from '../services/AutomationStore'
import type { OrchestrationService } from '../services/OrchestrationService'
import type { ObservabilityService } from '../services/ObservabilityService'
import type { MemoryService } from '../services/MemoryService'
import type { SecurityService } from '../services/SecurityService'
import type { GuardrailService } from '../services/GuardrailService'
import type { DAGSchedulerService } from '../services/DAGSchedulerService'
import type { CollaborationService } from '../services/CollaborationService'
import type { SupervisorService } from '../services/SupervisorService'
import type { DynamicDAGService } from '../services/DynamicDAGService'
import type { RAGService } from '../services/RAGService'
import type { TelemetryService } from '../services/TelemetryService'
import type { DebuggerService } from '../services/DebuggerService'
import type { CostTrackerService } from '../services/CostTrackerService'
import type { ContextWindowService } from '../services/ContextWindowService'
import type { AuditService } from '../services/AuditService'
import type { PromptService } from '../services/PromptService'
import type { PlanningService } from '../services/PlanningService'
import type { ReflectionService } from '../services/ReflectionService'
import type { ToolLearningService } from '../services/ToolLearningService'
import type { HITLService } from '../services/HITLService'
import type { MultimodalService } from '../services/MultimodalService'
import type { TerminalService } from '../services/TerminalService'
import type { HookConfigService } from '../services/HookConfigService'
import type { PreviewService } from '../services/PreviewService'
import type { TestGenService } from '../services/TestGenService'
import type { RepoWikiService } from '../services/RepoWikiService'
import type { AgentConfigService } from '../services/AgentConfigService'
import type { ModelRouter } from '../services/ModelRouter'
import type { CodeReviewService } from '../services/CodeReviewService'
import type { SubAgentIsolationService } from '../services/SubAgentIsolationService'
import type { TaskBoard } from '../services/TaskBoard'
import type { AgentBus } from '../services/AgentBus'
import type { ImageToCodeService } from '../services/ImageToCodeService'
import type { AdaptiveLearningService } from '../services/AdaptiveLearningService'
import type { ScreenshotAnalysisService } from '../services/ScreenshotAnalysisService'
import type { ResilienceService } from '../services/ResilienceService'
import type { SDKEnhancementsService } from '../services/SDKEnhancementsService'
import type { ReasoningService } from '../services/ReasoningService'
import { registerModelConfigHandlers } from './handlers/modelConfig'
import { registerSessionHandlers } from './handlers/session'
import { registerWorkspaceHandlers, setSyncToolManager } from './handlers/workspace'
import { registerAgentHandlers } from './handlers/agent'
import { SkillRegistryService } from '../services/SkillRegistryService'
import { registerLocalEngineHandlers } from './handlers/localEngine'
import { registerSandboxHandlers } from './handlers/sandbox'
import { registerSkillHandlers } from './handlers/skill'
import { registerAutomationHandlers } from './handlers/automation'
import { registerOrchestrationHandlers } from './handlers/orchestration'
import { registerSDKEnhancementsHandlers } from './handlers/sdkEnhancements'
import { registerSDKPhase4Handlers } from './handlers/sdkPhase4'
import { registerSecurityHandlers } from './handlers/security'
import { registerMemoryHandlers } from './handlers/memory'
import { registerMiscHandlers } from './handlers/misc'
import { registerConfigHandlers } from './handlers/configHandlers'
import { registerCostHandlers } from './handlers/costHandlers'
import { registerHitlHandlers } from './handlers/hitlHandlers'
import { registerPromptHandlers } from './handlers/promptHandlers'
import { registerPlanningHandlers } from './handlers/planningHandlers'
import { registerRagHandlers } from './handlers/ragHandlers'
import { registerMcpHandlers } from './handlers/mcp'
import { registerTelemetryHandlers } from './handlers/telemetry'
import { registerDebuggerHandlers } from './handlers/debugger'
import { registerTerminalHandlers } from './handlers/terminal'
import { registerPreviewHandlers } from './handlers/preview'
import { registerWikiHandlers } from './handlers/wiki'
import { registerMultiFileHandlers } from './handlers/multifile'
import { registerTestGenHandlers } from './handlers/testgen'
import { registerHookConfigHandlers } from './handlers/hookConfig'
import { registerCodeReviewHandlers } from './handlers/codeReview'
import { registerSubAgentHandlers } from './handlers/subagent'
import { registerScreenshotHandlers } from './handlers/screenshot'
import { registerImg2CodeHandlers } from './handlers/img2code'
import { registerResilienceHandlers } from './handlers/resilience'
import { registerToolLearningHandlers } from './handlers/toolLearning'
import { registerCheckpointHandlers } from './handlers/checkpoint'
import { registerBgAgentHandlers } from './handlers/bg-agent'
import { registerAdvancedHandlers } from './handlers/advanced'
import { registerMultiAgentHandlers } from './handlers/multiAgent'
import { registerSyncHandlers } from './handlers/sync'

export async function registerIPC(container: ServiceContainer): Promise<void> {
  const configStore = container.get<ConfigStore>(SERVICE_TOKENS.CONFIG_STORE)
  const sessionStore = container.get<SessionStore>(SERVICE_TOKENS.SESSION_STORE)
  const agentService = container.get<AgentService>(SERVICE_TOKENS.AGENT_SERVICE)
  const workspaceManager = container.get<WorkspaceManager>(SERVICE_TOKENS.WORKSPACE_MANAGER)
  const automationStore = container.get<AutomationStore>(SERVICE_TOKENS.AUTOMATION_STORE)
  const orchestrationService = container.get<OrchestrationService>(SERVICE_TOKENS.ORCHESTRATION_SERVICE)
  const observabilityService = container.get<ObservabilityService>(SERVICE_TOKENS.OBSERVABILITY_SERVICE)
  const memoryService = container.get<MemoryService>(SERVICE_TOKENS.MEMORY_SERVICE)
  const securityService = container.get<SecurityService>(SERVICE_TOKENS.SECURITY_SERVICE)
  const guardrailService = container.get<GuardrailService>(SERVICE_TOKENS.GUARDRAIL_SERVICE)
  const dagSchedulerService = container.get<DAGSchedulerService>(SERVICE_TOKENS.DAG_SCHEDULER_SERVICE)
  const collaborationService = container.get<CollaborationService>(SERVICE_TOKENS.COLLABORATION_SERVICE)
  const supervisorService = container.get<SupervisorService>(SERVICE_TOKENS.SUPERVISOR_SERVICE)
  const dynamicDAGService = container.get<DynamicDAGService>(SERVICE_TOKENS.DYNAMIC_DAG_SERVICE)
  const ragService = container.get<RAGService>(SERVICE_TOKENS.RAG_SERVICE)
  const telemetryService = container.get<TelemetryService>(SERVICE_TOKENS.TELEMETRY_SERVICE)
  const debuggerService = container.get<DebuggerService>(SERVICE_TOKENS.DEBUGGER_SERVICE)
  const costTrackerService = container.get<CostTrackerService>(SERVICE_TOKENS.COST_TRACKER_SERVICE)
  const contextWindowService = container.get<ContextWindowService>(SERVICE_TOKENS.CONTEXT_WINDOW_SERVICE)
  const auditService = container.get<AuditService>(SERVICE_TOKENS.AUDIT_SERVICE)
  const promptService = container.get<PromptService>(SERVICE_TOKENS.PROMPT_SERVICE)
  const planningService = container.get<PlanningService>(SERVICE_TOKENS.PLANNING_SERVICE)
  const reflectionService = container.get<ReflectionService>(SERVICE_TOKENS.REFLECTION_SERVICE)
  const toolLearningService = container.get<ToolLearningService>(SERVICE_TOKENS.TOOL_LEARNING_SERVICE)
  const hitlService = container.get<HITLService>(SERVICE_TOKENS.HITL_SERVICE)
  const multimodalService = container.get<MultimodalService>(SERVICE_TOKENS.MULTIMODAL_SERVICE)
  const terminalService = container.get<TerminalService>(SERVICE_TOKENS.TERMINAL_SERVICE)
  const hookConfigService = container.get<HookConfigService>(SERVICE_TOKENS.HOOK_CONFIG_SERVICE)
  const previewService = container.get<PreviewService>(SERVICE_TOKENS.PREVIEW_SERVICE)
  const testGenService = container.get<TestGenService>(SERVICE_TOKENS.TEST_GEN_SERVICE)
  const repoWikiService = container.get<RepoWikiService>(SERVICE_TOKENS.REPO_WIKI_SERVICE)
  const agentConfigService = container.get<AgentConfigService>(SERVICE_TOKENS.AGENT_CONFIG_SERVICE)
  const modelRouter = container.get<ModelRouter>(SERVICE_TOKENS.MODEL_ROUTER)
  const codeReviewService = container.get<CodeReviewService>(SERVICE_TOKENS.CODE_REVIEW_SERVICE)
  const subAgentIsolationService = container.get<SubAgentIsolationService>(SERVICE_TOKENS.SUB_AGENT_ISOLATION_SERVICE)
  const imageToCodeService = container.get<ImageToCodeService>(SERVICE_TOKENS.IMAGE_TO_CODE_SERVICE)
  const adaptiveLearningService = container.get<AdaptiveLearningService>(SERVICE_TOKENS.ADAPTIVE_LEARNING_SERVICE)
  const screenshotAnalysisService = container.get<ScreenshotAnalysisService>(SERVICE_TOKENS.SCREENSHOT_ANALYSIS_SERVICE)
  const resilienceService = container.get<ResilienceService>(SERVICE_TOKENS.RESILIENCE_SERVICE)
  const sdkEnhancementsService = container.get<SDKEnhancementsService>(SERVICE_TOKENS.SDK_ENHANCEMENTS_SERVICE)
  const reasoningService = container.get<ReasoningService>(SERVICE_TOKENS.REASONING_SERVICE)
  const taskBoard = container.get<TaskBoard>(SERVICE_TOKENS.TASK_BOARD)
  const agentBus = container.get<AgentBus>(SERVICE_TOKENS.AGENT_BUS)
  const mainWindowHolder = container.getMainWindowHolder()
  const getMainWindow = () => mainWindowHolder.get()

  // 将 agentService 的 toolManager 同步到所有编排相关服务
  const syncToolManager = (): void => {
    const tm = agentService.getToolManager()
    if (!tm) return
    orchestrationService.setToolManager(tm)
    dagSchedulerService.setToolManager(tm)
    collaborationService.setToolManager(tm)
    supervisorService.setToolManager(tm)
    dynamicDAGService.setToolManager(tm)
    subAgentIsolationService.setToolManager(tm)
  }

  // ========== Register all domain handlers ==========

  registerModelConfigHandlers({ configStore, agentService, modelRouter, costTrackerService })
  registerSessionHandlers({ sessionStore, contextWindowService })

  // registerSkill needs the scanner — scan once at startup
  const skillScanner = getSkillScanner()
  skillScanner.scanAll().catch(err => console.error('[SkillScanner] Initial scan failed:', err))
  const { SkillRegistryService } = await import('../services/SkillRegistryService')
  const skillRegistry = new SkillRegistryService()
  registerSkillHandlers({ skillScanner, skillRegistry })

  registerAutomationHandlers({ configStore, sessionStore, agentService, automationStore })

  // syncToolManager must be set before workspace & orchestration handlers
  setSyncToolManager(syncToolManager)

  registerOrchestrationHandlers({ orchestrationService, dagSchedulerService, collaborationService, supervisorService, dynamicDAGService })
  registerSDKEnhancementsHandlers({
    sdkEnhancementsService,
    ragService,
    agentService,
    providerManager: agentService.getProviderManager(),
    configStore,
  })
  registerSDKPhase4Handlers({
    dagSchedulerService,
    resilienceService,
    providerManager: agentService.getProviderManager(),
    configStore,
    sdkEnhancementsService,
    reasoningService,
    memoryService,
    securityService,
  })
  registerSecurityHandlers({ securityService, guardrailService, auditService, hitlService })
  registerMemoryHandlers({ memoryService })

  // ===== Domain-specific handlers (split from misc.ts) =====
  registerMcpHandlers({ configStore, agentService })
  registerTelemetryHandlers({ telemetryService, observabilityService })
  registerDebuggerHandlers({ debuggerService, observabilityService })
  registerTerminalHandlers({ terminalService })
  registerPreviewHandlers({ previewService })
  registerWikiHandlers({ repoWikiService, configStore, agentService })
  registerMultiFileHandlers({ agentService })
  registerTestGenHandlers({ testGenService, configStore, agentService })
  registerHookConfigHandlers({ hookConfigService })
  registerCodeReviewHandlers({ codeReviewService, configStore, agentService })
  registerSubAgentHandlers({ subAgentIsolationService })
  registerScreenshotHandlers({ screenshotAnalysisService })
  registerImg2CodeHandlers({ imageToCodeService })
  registerResilienceHandlers({ resilienceService })
  registerToolLearningHandlers({ toolLearningService })

  registerMiscHandlers({
    contextWindowService, multimodalService,
    agentConfigService,
    adaptiveLearningService,
    observabilityService, configStore, agentService,
  })

  // ===== Domain handlers split from the original misc.ts =====
  registerConfigHandlers({ configStore })
  registerCostHandlers({ costTrackerService, observabilityService })
  registerHitlHandlers({ hitlService, getMainWindow })
  registerPromptHandlers({ promptService })
  registerPlanningHandlers({ planningService, reflectionService, configStore })
  registerRagHandlers({ ragService })

  // Model routing and workspace initialization need syncToolManager — initialize now
  registerAgentHandlers({ agentService, getMainWindow })
  registerWorkspaceHandlers({ configStore, agentService, workspaceManager })

  // ===== 多 Agent 编排 =====
  // 同步 toolManager 引用到所有编排服务
  syncToolManager()

  // ===== Checkpoint / 回滚 =====
  registerCheckpointHandlers(container)

  // ===== Background Agent =====
  registerBgAgentHandlers(container)

  // ===== Multi-Agent Collaboration (TaskBoard / AgentBus / Supervisor) =====
  registerMultiAgentHandlers({ taskBoard, agentBus, supervisorService })

  // ===== Advanced Services (Inline Completion / LSP / Plugin / Embedding) =====
  registerAdvancedHandlers(container)

  // ===== Remote Workspace Sync =====
  registerSyncHandlers(container)

  // ===== Local Engine (Ollama / llama.cpp) =====
  registerLocalEngineHandlers()

  // ===== Sandbox Audit =====
  registerSandboxHandlers()
}
