// Agent 服务 - 核心编排层
// 整合 ProviderManager + ToolManager + SessionStore + ObservabilityService + MemoryService
// 提供 ReAct Agent 的创建、流式运行、暂停/恢复、停止能力
// 深度利用 HookManager: 成本追踪 / 事件发布 / 自动记忆 / 指标采集
//
// 架构拆分:
//   - AgentHookFactory:  10 个 HookPoint 回调注册 + 用户 Hooks 执行
//   - FewShotRegistry:   AELA 专属 Few-Shot 示例库注册
//   - AgentContextBuilder: 上下文构建（技能/记忆/路由）
//   - AgentPerformanceOptimizer: 投机执行 + 缓存 + SelfTuner
//   - AgentStreamProcessor: 流式事件处理
//   - AgentSessionManager: 活跃 Agent 实例生命周期
//   - AgentService:      核心编排 + 生命周期管理

import { ReActAgent, Lifecycle } from '@agentprimordia/sdk'
import type { Provider, StreamEvent } from '@agentprimordia/sdk'
import type { SpeculativeExecutor, SpeculationStats, SpeculativeExecConfig, CacheStats } from '@agentprimordia/sdk'

import { ProviderManager } from './ProviderManager'
import { ToolManager, type ShellConfirmCallback } from './ToolManager'
import type { SessionStore } from './SessionStore'
import type { ConfigStore } from './ConfigStore'
import type { ObservabilityService } from './ObservabilityService'
import type { MemoryService } from './MemoryService'
import type { CostTrackerService } from './CostTrackerService'
import { ContextWindowService } from './ContextWindowService'
import type { HITLService } from './HITLService'
import type { AuditService } from './AuditService'
import type { ToolLearningService } from './ToolLearningService'
import type { GuardrailService } from './GuardrailService'
import type { SecurityService } from './SecurityService'
import type { ModelRouter } from './ModelRouter'
import type { SkillRouter } from './SkillRouter'
import type { TaskRouter } from './TaskRouter'
import type { ToolRecommender } from './ToolRecommender'
import type { SubAgentIsolationService } from './SubAgentIsolationService'
import { AgentHookFactory } from './AgentHookFactory'
import { AgentContextBuilder } from './AgentContextBuilder'
import { AgentPerformanceOptimizer } from './AgentPerformanceOptimizer'
import { AgentStreamProcessor } from './AgentStreamProcessor'
import { AgentSessionManager } from './AgentSessionManager'
import { FewShotRegistry } from './FewShotRegistry'
import { getSkillScanner } from './SkillScanner'

export type AgentStreamEvent = StreamEvent
  | { type: 'sub_agent_start'; agentId: string; agentName: string }
  | { type: 'sub_agent_token'; agentId: string; content: string }
  | { type: 'sub_agent_tool_call'; agentId: string; toolName: string; toolArgs: string }
  | { type: 'sub_agent_tool_result'; agentId: string; toolName: string; result: string; isError: boolean }
  | { type: 'sub_agent_done'; agentId: string }
import type { PromptService } from './PromptService'
import type { HookConfigService } from './HookConfigService'
import type { ModelConfig, ChatMessage, Skill, ActivityEvent } from '@shared/types'
import { randomUUID } from 'crypto'

/** AgentService 协作服务依赖 — 通过构造函数或 wireDependencies 注入 */
export interface AgentServiceDependencies {
  memoryService: MemoryService
  costTracker: CostTrackerService
  contextWindow: ContextWindowService
  hitlService: HITLService
  auditService: AuditService
  toolLearningService: ToolLearningService
  promptService: PromptService
  hookConfigService: HookConfigService
  guardrailService: GuardrailService
  securityService: SecurityService
  modelRouter: ModelRouter
}

export class AgentService {
  private providerManager: ProviderManager
  private toolManager: ToolManager | null = null
  private sessionStore: SessionStore
  private configStore: ConfigStore
  private observability: ObservabilityService
  private memoryService: MemoryService | null = null
  private costTracker: CostTrackerService | null = null
  private contextWindow: ContextWindowService | null = null
  private hitlService: HITLService | null = null
  private auditService: AuditService | null = null
  private toolLearningService: ToolLearningService | null = null
  private promptService: PromptService | null = null
  private hookConfigService: HookConfigService | null = null
  private guardrailService: GuardrailService | null = null
  private securityService: SecurityService | null = null
  private modelRouter: ModelRouter | null = null
  private hookFactory: AgentHookFactory
  private contextBuilder: AgentContextBuilder
  private skillRouter: SkillRouter | null = null
  private taskRouter: TaskRouter | null = null
  private toolRecommender: ToolRecommender | null = null
  private sessionManager = new AgentSessionManager()
  private perfOptimizer: AgentPerformanceOptimizer
  private streamProcessor: AgentStreamProcessor | null = null
  private abortControllers = new Map<string, AbortController>()

  constructor(
    configStore: ConfigStore,
    sessionStore: SessionStore,
    observability: ObservabilityService,
    deps?: AgentServiceDependencies,
  ) {
    this.configStore = configStore
    this.sessionStore = sessionStore
    this.observability = observability
    this.providerManager = new ProviderManager()
    this.hookFactory = new AgentHookFactory(observability)
    this.perfOptimizer = new AgentPerformanceOptimizer()
    this.contextBuilder = new AgentContextBuilder(
      configStore,
      this.providerManager,
      observability,
      { cacheEnabled: this.perfOptimizer.isCacheEnabled() },
    )

    if (deps) {
      this.applyDependencies(deps)
    }
  }

  /**
   * 注入协作服务依赖（构造函数或延迟调用均可）
   */
  wireDependencies(deps: AgentServiceDependencies): void {
    this.applyDependencies(deps)
  }

  /** 内部: 将依赖注入到对应字段及子组件 */
  private applyDependencies(deps: AgentServiceDependencies): void {
    this.memoryService = deps.memoryService
    this.costTracker = deps.costTracker
    this.contextWindow = deps.contextWindow
    this.hitlService = deps.hitlService
    this.auditService = deps.auditService
    this.toolLearningService = deps.toolLearningService
    this.promptService = deps.promptService
    this.hookConfigService = deps.hookConfigService
    this.guardrailService = deps.guardrailService
    this.securityService = deps.securityService
    this.modelRouter = deps.modelRouter

    // 同步注入到子组件
    this.hookFactory.setMemoryService(deps.memoryService)
    this.hookFactory.setCostTracker(deps.costTracker)
    this.hookFactory.setHITLService(deps.hitlService)
    this.hookFactory.setAuditService(deps.auditService)
    this.hookFactory.setToolLearningService(deps.toolLearningService)
    this.hookFactory.setHookConfigService(deps.hookConfigService)
    this.hookFactory.setGuardrailService(deps.guardrailService)
    this.hookFactory.setSecurityService(deps.securityService)
    this.contextBuilder.setMemoryService(deps.memoryService)
    this.contextBuilder.setGuardrailService(deps.guardrailService)
    this.contextBuilder.setModelRouter(deps.modelRouter)

    // 注册 AELA 专属 Few-Shot 示例库
    const registry = new FewShotRegistry(deps.promptService)
    registry.registerAelaFewShotExamples()
    this.contextBuilder.setPromptService(deps.promptService)
  }

  getCostTracker(): CostTrackerService | null { return this.costTracker }
  getContextWindow(): ContextWindowService | null { return this.contextWindow }
  getHITLService(): HITLService | null { return this.hitlService }

  setSubAgentToolManager(tm: ToolManager): void {
    this.subAgentIsolationService?.setToolManager(tm)
  }

  private pendingCheckpointCallback: ((sessionId: string, filePaths: string[], description: string) => Promise<void>) | null = null

  setCheckpointCallback(cb: (sessionId: string, filePaths: string[], description: string) => Promise<void>): void {
    if (this.toolManager) {
      this.toolManager.setCheckpointCallback(cb)
    } else {
      this.pendingCheckpointCallback = cb
    }
  }

  private subAgentIsolationService: SubAgentIsolationService | null = null

  setSubAgentIsolationService(svc: SubAgentIsolationService): void {
    this.subAgentIsolationService = svc
  }

  setActivityCallback(cb: (event: ActivityEvent) => void): void {
    this.hookFactory.setActivityCallback(cb)
  }

  setWorkspace(rootDir: string): void {
    if (this.toolManager) {
      this.toolManager.setRootDir(rootDir)
    } else {
      this.toolManager = new ToolManager(rootDir, this.confirmCallback)
      this.setSubAgentToolManager(this.toolManager)
      this.applyPendingAgentTools()
    }
  }

  private pendingAgentTools: Parameters<ToolManager['setAgentTools']>[0] | null = null

  setAgentTools(tools: Parameters<ToolManager['setAgentTools']>[0]): void {
    if (this.toolManager) {
      this.toolManager.setAgentTools(tools)
    } else {
      this.pendingAgentTools = tools
    }
  }

  private applyPendingAgentTools(): void {
    if (this.toolManager) {
      if (this.pendingAgentTools) {
        this.toolManager.setAgentTools(this.pendingAgentTools)
        this.pendingAgentTools = null
      }
      if (this.pendingCheckpointCallback) {
        this.toolManager.setCheckpointCallback(this.pendingCheckpointCallback)
        this.pendingCheckpointCallback = null
      }
    }
  }

  private confirmCallback?: ShellConfirmCallback

  setShellConfirmCallback(callback: ShellConfirmCallback): void {
    this.confirmCallback = callback
    this.toolManager?.setConfirmCallback(callback)
  }

  getToolManager(): ToolManager | null { return this.toolManager }
  getProviderManager(): ProviderManager { return this.providerManager }
  getObservability(): ObservabilityService { return this.observability }

  setSkillRouter(sr: SkillRouter): void { this.skillRouter = sr }
  setTaskRouter(tr: TaskRouter): void { this.taskRouter = tr }
  setToolRecommender(tr: ToolRecommender): void { this.toolRecommender = tr }

  async *runStream(params: {
    sessionId: string
    input: string
    modelConfigId: string
    systemPrompt?: string
    mode?: 'code' | 'office'
    permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'
    onMessage?: (msg: ChatMessage) => void
  }): AsyncGenerator<AgentStreamEvent> {
    if (this.sessionManager.has(params.sessionId)) {
      yield { type: 'error', error: new Error('该会话已有 Agent 正在运行，请先停止或等待完成') }
      return
    }
    this.sessionManager.register(params.sessionId)

    const abortController = new AbortController()
    this.abortControllers.set(params.sessionId, abortController)

    try {
      yield* this.runStreamWithCleanup(params, abortController)
    } finally {
      this.sessionManager.unregister(params.sessionId)
      this.perfOptimizer.cleanupSession(params.sessionId)
      this.abortControllers.delete(params.sessionId)
    }
  }

  private async *runStreamWithCleanup(params: {
    sessionId: string
    input: string
    modelConfigId: string
    systemPrompt?: string
    mode?: 'code' | 'office'
    permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'
    onMessage?: (msg: ChatMessage) => void
  }, abortController?: AbortController): AsyncGenerator<AgentStreamEvent> {
    const session = this.sessionStore.getSession(params.sessionId)
    const activeSkillIds = session?.activeSkillIds || []
    const skillScanner = getSkillScanner()
    const activeSkills: Skill[] = activeSkillIds
      .map(id => skillScanner.get(id))
      .filter((s): s is Skill => Boolean(s))

    let recommendedSkills: Array<{ name: string; description: string; score: number; content: string }> = []
    if (this.skillRouter) {
      try {
        const autoSkills = this.skillRouter.findAutoActivateSkills(params.input)
        for (const skill of autoSkills) {
          if (!activeSkillIds.includes(skill.id)) {
            activeSkills.push(skill)
          }
        }
        const matches = this.skillRouter.findRecommendedSkills(params.input)
        recommendedSkills = matches.map(m => ({
          name: m.skill.name,
          description: m.skill.description,
          score: m.score,
          content: m.skill.content,
        }))
      } catch (err) {
        console.error('[AgentService] Skill 路由失败:', err)
      }
    }

    let taskRecommendation = ''
    if (this.taskRouter && this.toolRecommender) {
      try {
        const taskRoute = this.taskRouter.detectTask(params.input)
        if (taskRoute.confidence > 0.6) {
          const label = this.taskRouter.getLabel(taskRoute.taskType)
          taskRecommendation = `\n\n## 任务识别\n识别为 **${label}**（置信度 ${Math.round(taskRoute.confidence * 100)}%）\n推荐工具：${taskRoute.recommendedTools.map(t => `\`${t}\``).join(', ')}`
          const toolRecs = this.toolRecommender.recommendTools(params.input, 5)
          if (toolRecs.length > 0) {
            taskRecommendation += '\n\n## 智能工具推荐\n'
            for (const rec of toolRecs) {
              taskRecommendation += `- **\`${rec.toolName}\`**（推荐度 ${Math.round(rec.score * 100)}%）— ${rec.reason}\n`
            }
            const toolManager = this.toolManager
            if (toolManager) {
              const priorityMap = toolManager.getToolPriorityMap(toolRecs, 0.3)
              if (priorityMap.lowPriority.length > 0) {
                taskRecommendation += '\n\n## 工具优先级\n'
                taskRecommendation += `- **优先使用**：${priorityMap.highPriority.map(t => `\`${t}\``).join(', ')}\n`
                if (priorityMap.normalPriority.length > 0) {
                  taskRecommendation += `- **可选用**：${priorityMap.normalPriority.map(t => `\`${t}\``).join(', ')}\n`
                }
                taskRecommendation += `- **当前任务不相关**：${priorityMap.lowPriority.map(t => `\`${t}\``).join(', ')}\n`
                taskRecommendation += '\n> 请优先使用推荐工具完成任务。仅在必要时使用不相关工具。'
              }
            }
          }
        } else {
          const toolRecs = this.toolRecommender.recommendTools(params.input, 3)
          if (toolRecs.length > 0) {
            taskRecommendation = '\n\n## 工具推荐\n'
            for (const rec of toolRecs) {
              taskRecommendation += `- **\`${rec.toolName}\`**（推荐度 ${Math.round(rec.score * 100)}%）— ${rec.reason}\n`
            }
          }
        }
      } catch (err) {
        console.error('[AgentService] 工具路由失败:', err)
      }
    }

    let ctx: Awaited<ReturnType<AgentContextBuilder['build']>>
    try {
      ctx = await this.contextBuilder.build({
        sessionId: params.sessionId,
        input: params.input,
        modelConfigId: params.modelConfigId,
        mode: params.mode,
        permissionLevel: params.permissionLevel,
        activeSkills,
        recommendedSkills,
        taskRecommendation,
      })
    } catch (err) {
      if (err instanceof Error) {
        yield { type: 'error', error: err }
      }
      return
    }

    const { modelConfig, provider, systemPrompt: baseSystemPrompt } = ctx
    const appConfig = this.configStore.getConfig()

    let effectiveMaxMessages = appConfig.maxMessages
    if (this.contextWindow) {
      try {
        const promptTokens = this.contextWindow.estimateTokenCount(baseSystemPrompt)
        const sessionMessages = this.sessionStore.getMessages(params.sessionId)
        const conversationTokens = this.contextWindow.estimateTokens(
          sessionMessages.map(m => ({ role: m.role, content: m.content }))
        )
        const totalTokens = promptTokens + conversationTokens
        const budget = this.contextWindow.measure(
          sessionMessages.map(m => ({ role: m.role, content: m.content }))
        )
        this.observability.publish('context.tokens', 'aela-agent', {
          sessionId: params.sessionId, promptTokens, conversationTokens, totalTokens,
          budget: budget.budget, usage: budget.usage,
        })
        const sessionId = params.sessionId
        const modelCfg = sessionId
          ? this.configStore.getModel(this.sessionStore.getSession(sessionId)?.modelConfigId ?? '')
          : null
        const ctxSize = ContextWindowService.resolveContextSize(modelCfg)
        const dynamicThreshold = ContextWindowService.computeDynamicThreshold(ctxSize)
        if (budget.usage > dynamicThreshold) {
          effectiveMaxMessages = Math.max(10, Math.floor(appConfig.maxMessages * 0.6))
          console.warn(`[AgentService] 上下文使用率 ${Math.round(budget.usage * 100)}%，动态阈值 ${Math.round(dynamicThreshold * 100)}%（模型 ${modelCfg?.model ?? 'default'}，窗口 ${ctxSize}），压缩 maxMessages → ${effectiveMaxMessages}`)
        }
      } catch (err) {
        console.error('[AgentService] ContextWindow 测量失败:', err)
      }
    }

    const systemPrompt = baseSystemPrompt
    const hookMetrics = { llmStart: 0 }
    const hooks = this.hookFactory.createHooks(params.sessionId, hookMetrics, modelConfig, params.permissionLevel)
    const lifecycle = new Lifecycle()

    if (!this.toolManager) {
      yield { type: 'error', error: new Error('ToolManager 未初始化，请先打开工作区后再开始对话') }
      return
    }

    const agentConfig: {
      name: string
      model: Provider
      toolkit: ReturnType<ToolManager['getRegistry']>
      maxTurns: number
      maxMessages: number
      systemPrompt: string
      hooks: ReturnType<AgentHookFactory['createHooks']>
      lifecycle: Lifecycle
      sessionId: string
      parallelToolExecution: boolean
      speculativeExecutor?: SpeculativeExecutor
    } = {
      name: 'aela-agent-' + params.sessionId,
      model: provider,
      toolkit: this.toolManager.getRegistry(),
      maxTurns: appConfig.maxTurns,
      maxMessages: effectiveMaxMessages,
      systemPrompt,
      hooks,
      lifecycle,
      sessionId: params.sessionId,
      parallelToolExecution: true,
    }

    const specExec = this.perfOptimizer.createSpeculativeExecutor(
      params.sessionId,
      provider,
      this.toolManager.getRegistry(),
    )
    if (specExec) {
      agentConfig.speculativeExecutor = specExec
    }

    const agent = new ReActAgent(agentConfig)

    this.streamProcessor = new AgentStreamProcessor(
      this.sessionStore,
      this.toolManager,
      this.perfOptimizer,
    )

    this.sessionManager.register(params.sessionId, agent, lifecycle)

    if (this.memoryService) {
      try {
        await this.memoryService.addEpisode({
          id: randomUUID(),
          sessionId: params.sessionId,
          role: 'user',
          content: params.input.slice(0, 2000),
          summary: params.input.slice(0, 200),
          topics: 'user-input',
          importance: 0.7,
          createdAt: new Date().toISOString(),
        })
      } catch (err) { console.error('[AgentService] 保存用户记忆失败:', err) }
    }

    const userMsg: ChatMessage = {
      id: randomUUID(),
      sessionId: params.sessionId,
      role: 'user',
      content: params.input,
      createdAt: new Date().toISOString(),
    }
    this.sessionStore.addMessage(userMsg)

    const wrappedParams = {
      ...params,
      abortSignal: abortController?.signal,
    }
    yield* this.streamProcessor!.process(agent, wrappedParams, activeSkills)

    if (abortController?.signal.aborted) {
      const partialMsg: ChatMessage = {
        id: randomUUID(),
        sessionId: params.sessionId,
        role: 'assistant',
        content: '[interrupted]',
        createdAt: new Date().toISOString(),
      }
      if (params.onMessage) params.onMessage(partialMsg)
    }
  }

  // ===== 性能优化 API — 委托给 AgentPerformanceOptimizer =====
  getSpeculativeStats(): SpeculationStats[] { return this.perfOptimizer.getSpeculativeStats() }
  resetSpeculative(): void { this.perfOptimizer.resetSpeculative() }
  setSpeculativeEnabled(enabled: boolean): void { this.perfOptimizer.setSpeculativeEnabled(enabled) }
  getSpeculativeConfig(): SpeculativeExecConfig & { enabled: boolean } { return this.perfOptimizer.getSpeculativeConfig() }
  getCacheStats(): CacheStats { return this.perfOptimizer.getCacheStats() }
  clearCache(): void { this.perfOptimizer.clearCache() }
  setCacheEnabled(enabled: boolean): void { this.perfOptimizer.setCacheEnabled(enabled) }
  isCacheEnabled(): boolean { return this.perfOptimizer.isCacheEnabled() }

  // ===== 生命周期管理 =====
  stopAgent(sessionId: string): void {
    const ac = this.abortControllers.get(sessionId)
    if (ac) ac.abort()
    this.sessionManager.stop(sessionId)
  }
  stop(): void { this.close() }
  pause(sessionId: string): void { this.sessionManager.pause(sessionId) }
  resume(sessionId: string): void { this.sessionManager.resume(sessionId) }
  getStatus(sessionId: string): string { return this.sessionManager.getStatus(sessionId) }
  async testModel(config: ModelConfig): Promise<{ success: boolean; message: string }> { return this.providerManager.testConnection(config) }
  invalidateProvider(modelId: string): void { this.providerManager.invalidate(modelId) }

  close(): void {
    this.sessionManager.stopAll()
    this.toolManager?.close()
  }
}
