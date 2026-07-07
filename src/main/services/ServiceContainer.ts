// 统一 Service 生命周期接口 + DI 容器
// 解决问题:
//   1. as any 清理调用 — 统一为 stop() 方法
//   2. 37 参数传递 — 用容器注册/获取
//   3. 初始化顺序依赖 — 容器管理依赖关系
//   4. 启动顺序 — 通过依赖图拓扑排序自动确定（P0-4 升级）

import type { BrowserWindow } from 'electron'

// ===== 统一生命周期接口 =====
export interface IService {
  /** 启动服务（可选） */
  start?(): void | Promise<void>
  /** 停止/清理服务（统一方法名） */
  stop?(): void | Promise<void>
}

// ===== 服务标识类型 =====
export type ServiceToken = string

// ===== DI 容器 =====
// 放宽泛型约束：容器应能注册任何对象（不限于实现了 IService 接口的），
// 以避免服务类（如 WorkspaceManager / AutomationStore）必须显式声明 stop() 方法。
// stopAll() 内部仍会安全检查 instance.stop 是否为函数，未实现的方法会被跳过。
export class ServiceContainer {
  private instances = new Map<ServiceToken, object>()
  private factories = new Map<ServiceToken, () => object | Promise<object>>()
  /** 依赖图：token → 其依赖的 token 列表 */
  private dependencyGraph = new Map<ServiceToken, ServiceToken[]>()
  /** 是否已声明依赖关系（若未声明任何依赖，回退到注册顺序） */
  private hasDeclaredDeps = false
  private started = false
  private mainWindowHolder: MainWindowHolder | null = null

  /**
   * 注册服务实例（已创建好的服务）
   * @param deps 该服务依赖的其他服务 token（用于拓扑排序确定启动顺序）
   */
  register<T extends object>(token: ServiceToken, instance: T, deps: ServiceToken[] = []): void {
    this.instances.set(token, instance)
    if (deps.length > 0) {
      this.dependencyGraph.set(token, deps)
      this.hasDeclaredDeps = true
    }
  }

  /**
   * 注册服务工厂（懒创建）
   */
  registerFactory<T extends object>(token: ServiceToken, factory: () => T | Promise<T>): void {
    this.factories.set(token, factory as () => object | Promise<object>)
  }

  /**
   * 获取服务实例
   */
  get<T extends object>(token: ServiceToken): T {
    const instance = this.instances.get(token)
    if (instance) return instance as T

    const factory = this.factories.get(token)
    if (factory) {
      const result = factory()
      // 同步工厂
      if (!(result instanceof Promise)) {
        this.instances.set(token, result)
        return result as T
      }
      // 异步工厂不应该在 get() 中使用，应提前 resolve
      throw new Error(`Service "${token}" has async factory, use resolve() instead`)
    }

    throw new Error(`Service "${token}" not registered`)
  }

  /**
   * 异步获取服务实例（支持懒创建异步工厂）
   */
  async resolve<T extends object>(token: ServiceToken): Promise<T> {
    const instance = this.instances.get(token)
    if (instance) return instance as T

    const factory = this.factories.get(token)
    if (factory) {
      const result = await factory()
      this.instances.set(token, result)
      return result as T
    }

    throw new Error(`Service "${token}" not registered`)
  }

  /**
   * 检查服务是否已注册
   */
  has(token: ServiceToken): boolean {
    return this.instances.has(token) || this.factories.has(token)
  }

  /**
   * 声明服务间的依赖关系（用于拓扑排序）
   * 在 register() 之后、startAll() 之前调用
   */
  declareDependency(token: ServiceToken, deps: ServiceToken[]): void {
    this.dependencyGraph.set(token, deps)
    this.hasDeclaredDeps = true
  }

  /**
   * 拓扑排序（Kahn 算法）
   * 如果有声明依赖关系，按依赖图排序；否则回退到注册顺序
   * 检测循环依赖并抛出错误
   */
  private topoSort(): ServiceToken[] {
    const tokens = Array.from(this.instances.keys())
    
    // 如果没有声明任何依赖关系，回退到注册顺序
    if (!this.hasDeclaredDeps) {
      return tokens
    }

    // 构建邻接表和入度表
    const inDegree = new Map<ServiceToken, number>()
    const adjacency = new Map<ServiceToken, ServiceToken[]>()
    
    for (const token of tokens) {
      inDegree.set(token, 0)
      adjacency.set(token, [])
    }
    
    for (const [token, deps] of this.dependencyGraph) {
      for (const dep of deps) {
        if (!inDegree.has(dep)) {
          // 依赖的服务不在容器中（可能是外部依赖），跳过
          continue
        }
        adjacency.get(dep)!.push(token)
        inDegree.set(token, (inDegree.get(token) || 0) + 1)
      }
    }
    
    // Kahn 算法
    const queue: ServiceToken[] = []
    for (const [token, degree] of inDegree) {
      if (degree === 0) {
        queue.push(token)
      }
    }
    
    const sorted: ServiceToken[] = []
    while (queue.length > 0) {
      const token = queue.shift()!
      sorted.push(token)
      for (const dependent of adjacency.get(token) || []) {
        const newDegree = (inDegree.get(dependent) || 0) - 1
        inDegree.set(dependent, newDegree)
        if (newDegree === 0) {
          queue.push(dependent)
        }
      }
    }
    
    // 循环依赖检测
    if (sorted.length !== tokens.length) {
      const cyclic = tokens.filter(t => !sorted.includes(t))
      throw new Error(
        `[ServiceContainer] Circular dependency detected among: ${cyclic.join(', ')}`
      )
    }
    
    return sorted
  }

  /**
   * 启动所有服务
   * 如果声明了依赖关系，按拓扑排序启动；否则按注册顺序启动
   */
  async startAll(): Promise<void> {
    const sortedTokens = this.topoSort()
    for (const token of sortedTokens) {
      const instance = this.instances.get(token)
      if (!instance) continue
      const svc = instance as IService
      if (svc.start) {
        await svc.start()
      }
    }
    this.started = true
  }

  /**
   * 停止所有服务（按启动的逆序）
   * 统一调用 stop()，不再需要 as any
   */
  async stopAll(): Promise<void> {
    const sortedTokens = this.topoSort().reverse()
    for (const token of sortedTokens) {
      const instance = this.instances.get(token)
      if (!instance) continue
      const svc = instance as IService
      try {
        if (svc.stop) {
          await svc.stop()
        }
      } catch (err) {
        console.error(`[ServiceContainer] Error stopping service "${token}":`, err)
      }
    }
    this.started = false
  }

  /**
   * 获取所有已注册的服务 token
   */
  getTokens(): ServiceToken[] {
    return Array.from(this.instances.keys())
  }

  /**
   * 获取已注册服务数量
   */
  getServiceCount(): number {
    return this.instances.size
  }

  /**
   * 获取启动顺序（拓扑排序结果，用于调试和日志）
   */
  getStartupOrder(): ServiceToken[] {
    return this.topoSort()
  }

  /**
   * 设置 MainWindowHolder
   */
  setMainWindowHolder(holder: MainWindowHolder): void {
    this.mainWindowHolder = holder
  }

  /**
   * 获取 MainWindowHolder
   */
  getMainWindowHolder(): MainWindowHolder {
    if (!this.mainWindowHolder) {
      throw new Error('MainWindowHolder not set')
    }
    return this.mainWindowHolder
  }
}

// ===== 服务 Token 常量 =====
// 集中定义，避免魔法字符串
export const SERVICE_TOKENS = {
  CONFIG_STORE: 'ConfigStore',
  SESSION_STORE: 'SessionStore',
  AGENT_SERVICE: 'AgentService',
  WORKSPACE_MANAGER: 'WorkspaceManager',
  AUTOMATION_STORE: 'AutomationStore',
  ORCHESTRATION_SERVICE: 'OrchestrationService',
  OBSERVABILITY_SERVICE: 'ObservabilityService',
  MEMORY_SERVICE: 'MemoryService',
  SECURITY_SERVICE: 'SecurityService',
  GUARDRAIL_SERVICE: 'GuardrailService',
  DAG_SCHEDULER_SERVICE: 'DAGSchedulerService',
  COLLABORATION_SERVICE: 'CollaborationService',
  SUPERVISOR_SERVICE: 'SupervisorService',
  DYNAMIC_DAG_SERVICE: 'DynamicDAGService',
  RAG_SERVICE: 'RAGService',
  TELEMETRY_SERVICE: 'TelemetryService',
  DEBUGGER_SERVICE: 'DebuggerService',
  COST_TRACKER_SERVICE: 'CostTrackerService',
  CONTEXT_WINDOW_SERVICE: 'ContextWindowService',
  AUDIT_SERVICE: 'AuditService',
  PROMPT_SERVICE: 'PromptService',
  PLANNING_SERVICE: 'PlanningService',
  REFLECTION_SERVICE: 'ReflectionService',
  TOOL_LEARNING_SERVICE: 'ToolLearningService',
  HITL_SERVICE: 'HITLService',
  MULTIMODAL_SERVICE: 'MultimodalService',
  TERMINAL_SERVICE: 'TerminalService',
  HOOK_CONFIG_SERVICE: 'HookConfigService',
  PREVIEW_SERVICE: 'PreviewService',
  TEST_GEN_SERVICE: 'TestGenService',
  REPO_WIKI_SERVICE: 'RepoWikiService',
  AGENT_CONFIG_SERVICE: 'AgentConfigService',
  MODEL_ROUTER: 'ModelRouter',
  CODE_REVIEW_SERVICE: 'CodeReviewService',
  SUB_AGENT_ISOLATION_SERVICE: 'SubAgentIsolationService',
  IMAGE_TO_CODE_SERVICE: 'ImageToCodeService',
  ADAPTIVE_LEARNING_SERVICE: 'AdaptiveLearningService',
  SCREENSHOT_ANALYSIS_SERVICE: 'ScreenshotAnalysisService',
RESILIENCE_SERVICE: 'ResilienceService',
SDK_ENHANCEMENTS_SERVICE: 'SDKEnhancementsService',
REASONING_SERVICE: 'ReasoningService',
  AUTO_UPDATE_SERVICE: 'AutoUpdateService',
CRASH_REPORT_SERVICE: 'CrashReportService',
  EMBEDDING_SERVICE: 'EmbeddingService',
  CHECKPOINT_SERVICE: 'CheckpointService',
LSP_SERVICE: 'LSPService',
  INLINE_COMPLETION_SERVICE: 'InlineCompletionService',
  PLUGIN_SERVICE: 'PluginService',
  BG_AGENT_SERVICE: 'BackgroundAgentService',
  TASK_BOARD: 'TaskBoard',
  AGENT_BUS: 'AgentBus',
  MAIN_WINDOW: 'MainWindow',
  SYNC_SERVICE: 'SyncService',
} as const

// ===== BrowserWindow 引用包装 =====
// BrowserWindow 不是 IService，但需要放入容器供其他服务获取
export class MainWindowHolder {
  private getter: () => BrowserWindow | null

  constructor(getter: () => BrowserWindow | null) {
    this.getter = getter
  }

  get(): BrowserWindow | null {
    return this.getter()
  }
}
