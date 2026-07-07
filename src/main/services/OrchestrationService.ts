// 多 Agent 编排服务
// 基于 AgentPrimordia SDK 的 ParallelRun / AgentPool + 流式 Pipeline / Handoff
// [SDK 深度集成] 增加 GroupChat / Debate / Supervisor 高级编排模式
// 提供流式事件输出能力
// [升级] 增加预置模板库 + 执行回放 + 性能分析
// [重构] 模板库与回放分析拆分为独立类：OrchestrationTemplates / OrchestrationReplay
// [重构] GroupChat / Debate / Supervisor / StreamingPipeline 高级编排模式拆分为独立策略类

import {
  ReActAgent,
  HookManager,
  Lifecycle,
  ParallelRun,
  AgentPool,
  ToolRegistry,
} from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type {
  OrchestrationConfig,
  OrchestrationStepResult,
  OrchestrationEvent,
  MessageMetrics,
  OrchestrationTemplate,
  OrchestrationRunRecord,
  OrchestrationPerformanceReport,
} from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ToolManager } from './ToolManager'
import type { ConfigStore } from './ConfigStore'
import { OrchestrationTemplates } from './orchestration/OrchestrationTemplates'
import { OrchestrationReplay } from './orchestration/OrchestrationReplay'
import { GroupChatOrchestrator, type CreateAgentFn } from './orchestration/GroupChatOrchestrator'
import { SupervisorOrchestrator } from './orchestration/SupervisorOrchestrator'
import { StreamingPipelineOrchestrator } from './orchestration/StreamingPipelineOrchestrator'
import { randomUUID } from 'crypto'


export class OrchestrationService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private toolManager: ToolManager | null
  private activeLifecycles: Map<string, Lifecycle> = new Map()
  // [重构] 模板与回放拆分为独立类
  private templatesRepo: OrchestrationTemplates
  private replayRepo: OrchestrationReplay
  // [重构] 高级编排模式拆分为独立策略类
  private groupChatOrchestrator: GroupChatOrchestrator
  private supervisorOrchestrator: SupervisorOrchestrator
  private streamingPipelineOrchestrator: StreamingPipelineOrchestrator

  constructor(
    configStore: ConfigStore,
    providerManager: ProviderManager,
    toolManager: ToolManager | null,
    templatesRepo?: OrchestrationTemplates,
    replayRepo?: OrchestrationReplay,
  ) {
    this.configStore = configStore
    this.providerManager = providerManager
    this.toolManager = toolManager
    this.templatesRepo = templatesRepo ?? new OrchestrationTemplates()
    this.replayRepo = replayRepo ?? new OrchestrationReplay()

    // 注入 createAgent 工厂（绑定 this）供子策略类创建 Agent
    const createAgent: CreateAgentFn = (name, modelConfigId, systemPrompt, maxTurns) =>
      this.createAgent(name, modelConfigId, systemPrompt, maxTurns)
    this.groupChatOrchestrator = new GroupChatOrchestrator(createAgent)
    this.supervisorOrchestrator = new SupervisorOrchestrator(createAgent)
    this.streamingPipelineOrchestrator = new StreamingPipelineOrchestrator(
      createAgent,
      this.activeLifecycles,
    )
  }

  setToolManager(tm: ToolManager): void {
    this.toolManager = tm
  }

  /**
   * 创建单个 ReActAgent 实例
   */
  private createAgent(
    name: string,
    modelConfigId: string,
    systemPrompt: string,
    maxTurns?: number
  ): { agent: ReActAgent; lifecycle: Lifecycle } {
    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`未找到模型配置: ${modelConfigId}`)
    }

    const provider: Provider = this.providerManager.createProvider(modelConfig)
    const appConfig = this.configStore.getConfig()
    const hooks = new HookManager()
    const lifecycle = new Lifecycle()
    const toolkit = this.toolManager?.getRegistry() ?? new ToolRegistry()

    const agent = new ReActAgent({
      name,
      model: provider,
      toolkit,
      maxTurns: maxTurns ?? appConfig.maxTurns,
      maxMessages: appConfig.maxMessages,
      systemPrompt,
      hooks,
      lifecycle,
    })

    return { agent, lifecycle }
  }

  /**
   * 运行编排任务，返回 AsyncGenerator 产出 OrchestrationEvent
   */
  async *run(
    config: OrchestrationConfig
  ): AsyncGenerator<OrchestrationEvent> {
    const startTime = Date.now()
    const results: OrchestrationStepResult[] = []
    const runId = config.id || randomUUID()

    try {
      switch (config.mode) {
        case 'pipeline':
          yield* this.runPipeline(config, results, startTime)
          break
        case 'parallel':
          yield* this.runParallel(config, results)
          break
        case 'handoff':
          yield* this.runHandoff(config, results, startTime)
          break
        case 'pool':
          yield* this.runPool(config, results)
          break
        // [SDK 集成] 高级编排模式 — 委托子策略类
        case 'groupchat':
          yield* this.groupChatOrchestrator.runGroupChat(config, results, startTime)
          break
        case 'debate':
          yield* this.groupChatOrchestrator.runDebate(config, results, startTime)
          break
        case 'supervisor':
          yield* this.supervisorOrchestrator.runSupervisor(config, results, startTime)
          break
        // [增强] StreamingPipeline — token 级流式管道
        case 'streaming_pipeline':
          yield* this.streamingPipelineOrchestrator.runStreamingPipeline(config, results, startTime)
          break
      }

      const success = results.every(r => !r.error)
      yield {
        type: 'all_done',
        result: {
          configId: runId,
          mode: config.mode,
          results,
          duration: Date.now() - startTime,
          success,
        },
      }

      // 记录执行结果（用于回放和性能分析）
      this.recordRun(config, results, startTime, success)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      // 记录失败
      this.recordRun(config, results, startTime, false, errMsg)
      yield {
        type: 'error',
        error: errMsg,
      }
    } finally {
      this.activeLifecycles.delete(runId)
    }
  }

  /**
   * Pipeline 串行编排
   * 使用 SDK 的 Pipeline 类 + 流式 token 输出
   * Agent 按顺序执行，前一个的输出作为后一个的输入
   */
  private async *runPipeline(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    _startTime: number
  ): AsyncGenerator<OrchestrationEvent> {
    let currentInput = config.input

    for (let i = 0; i < config.agents.length; i++) {
      const agentCfg = config.agents[i]
      yield { type: 'step_start', agentName: agentCfg.name, stepIndex: i }

      const { agent, lifecycle } = this.createAgent(
        agentCfg.name,
        agentCfg.modelConfigId,
        agentCfg.systemPrompt,
        agentCfg.maxTurns
      )
      this.activeLifecycles.set(config.id, lifecycle)

      let content = ''
      let metrics: MessageMetrics | undefined

      try {
        // 流式收集 token（SDK 的 Pipeline 用的是非流式 run()，这里用 streamEvents 增强体验）
        for await (const event of agent.streamEvents(currentInput)) {
          if (event.type === 'token') {
            content += event.content
            yield { type: 'step_token', agentName: agentCfg.name, content: event.content }
          } else if (event.type === 'done') {
            metrics = event.response.metrics as MessageMetrics
          }
        }

        const stepResult: OrchestrationStepResult = {
          agentName: agentCfg.name,
          content,
          metrics,
          skipped: false,
        }
        results.push(stepResult)
        yield { type: 'step_done', agentName: agentCfg.name, stepIndex: i, result: stepResult }

        // 下一个 agent 的输入是当前 agent 的输出（Pipeline 核心语义）
        currentInput = content
      } catch (err: unknown) {
        const stepResult: OrchestrationStepResult = {
          agentName: agentCfg.name,
          content,
          skipped: false,
          error: err instanceof Error ? err.message : String(err),
        }
        results.push(stepResult)
        yield { type: 'step_done', agentName: agentCfg.name, stepIndex: i, result: stepResult }
      }
    }
  }

  /**
   * ParallelRun 并行编排
   * 使用 SDK 的 ParallelRun 类，所有 Agent 同时执行各自独立输入
   */
  private async *runParallel(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[]
  ): AsyncGenerator<OrchestrationEvent> {
    // 发出所有 step_start
    for (let i = 0; i < config.agents.length; i++) {
      yield { type: 'step_start', agentName: config.agents[i].name, stepIndex: i }
    }

    // 构建 SDK PipelineStep[]
    const steps = config.agents.map((agentCfg) => {
      const { agent, lifecycle } = this.createAgent(
        agentCfg.name,
        agentCfg.modelConfigId,
        agentCfg.systemPrompt,
        agentCfg.maxTurns
      )
      this.activeLifecycles.set(`${config.id}-${agentCfg.id}`, lifecycle)

      return {
        name: agentCfg.name,
        agent,
        input: agentCfg.input || config.input,
      }
    })

    // 使用 SDK 的 ParallelRun
    const parallel = new ParallelRun(steps)
    const stepResults = await parallel.run()

    for (let i = 0; i < stepResults.length; i++) {
      const sr = stepResults[i]
      const stepResult: OrchestrationStepResult = {
        agentName: sr.stepName,
        content: sr.response.content,
        metrics: sr.response.metrics as MessageMetrics,
        skipped: sr.skipped,
      }
      results.push(stepResult)
      yield { type: 'step_token', agentName: sr.stepName, content: sr.response.content }
      yield { type: 'step_done', agentName: sr.stepName, stepIndex: i, result: stepResult }
    }
  }

  /**
   * Handoff 交接编排
   * 使用 SDK 的 Handoff 类 + 流式 token 输出
   * 多个 Agent 轮流处理同一任务，传递上下文
   */
  private async *runHandoff(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    _startTime: number
  ): AsyncGenerator<OrchestrationEvent> {
    const maxRounds = config.maxRounds ?? 3
    let currentInput = config.input

    for (let round = 0; round < maxRounds; round++) {
      for (let i = 0; i < config.agents.length; i++) {
        const agentCfg = config.agents[i]
        const stepIndex = round * config.agents.length + i
        yield { type: 'step_start', agentName: agentCfg.name, stepIndex }

        const { agent, lifecycle } = this.createAgent(
          agentCfg.name,
          agentCfg.modelConfigId,
          agentCfg.systemPrompt,
          agentCfg.maxTurns
        )
        this.activeLifecycles.set(config.id, lifecycle)

        let content = ''
        let metrics: MessageMetrics | undefined

        try {
          // 流式收集 token
          for await (const event of agent.streamEvents(currentInput)) {
            if (event.type === 'token') {
              content += event.content
              yield { type: 'step_token', agentName: agentCfg.name, content: event.content }
            } else if (event.type === 'done') {
              metrics = event.response.metrics as MessageMetrics
            }
          }

          const stepResult: OrchestrationStepResult = {
            agentName: agentCfg.name,
            content,
            metrics,
            skipped: false,
          }
          results.push(stepResult)
          yield { type: 'step_done', agentName: agentCfg.name, stepIndex, result: stepResult }

          // 交接：下一个 agent 接收当前输出
          currentInput = content
        } catch (err: unknown) {
          const stepResult: OrchestrationStepResult = {
            agentName: agentCfg.name,
            content,
            skipped: false,
            error: err instanceof Error ? err.message : String(err),
          }
          results.push(stepResult)
          yield { type: 'step_done', agentName: agentCfg.name, stepIndex, result: stepResult }
        }
      }
    }
  }

  /**
   * AgentPool 池化调度
   * 使用 SDK 的 AgentPool 类，支持最大并发数控制
   */
  private async *runPool(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[]
  ): AsyncGenerator<OrchestrationEvent> {
    const maxConcurrent = config.maxConcurrent ?? 5

    // 发出所有 step_start
    for (let i = 0; i < config.agents.length; i++) {
      yield { type: 'step_start', agentName: config.agents[i].name, stepIndex: i }
    }

    // 构建 SDK PoolTask[]
    const tasks = config.agents.map((agentCfg, i) => {
      const modelConfig = this.configStore.getModel(agentCfg.modelConfigId)
      if (!modelConfig) throw new Error(`未找到模型配置: ${agentCfg.modelConfigId}`)

      const provider = this.providerManager.createProvider(modelConfig)
      const appConfig = this.configStore.getConfig()
      const toolkit = this.toolManager?.getRegistry() ?? new ToolRegistry()
      const hooks = new HookManager()
      const lifecycle = new Lifecycle()

      this.activeLifecycles.set(`${config.id}-${i}`, lifecycle)

      return {
        id: agentCfg.id || `agent-${i}`,
        input: agentCfg.input || config.input,
        agentConfig: {
          name: agentCfg.name,
          model: provider,
          toolkit,
          maxTurns: agentCfg.maxTurns ?? appConfig.maxTurns,
          maxMessages: appConfig.maxMessages,
          systemPrompt: agentCfg.systemPrompt,
          hooks,
          lifecycle,
        },
      }
    })

    // 使用 SDK 的 AgentPool
    const pool = new AgentPool({ maxConcurrent })
    const poolResults = await pool.dispatch(tasks)

    for (const pr of poolResults) {
      const agentCfg = config.agents.find(a => a.id === pr.taskID) || config.agents[0]
      const stepResult: OrchestrationStepResult = {
        agentName: agentCfg.name,
        content: pr.response.content,
        metrics: pr.response.metrics as MessageMetrics,
        skipped: false,
        error: pr.error?.message,
      }
      results.push(stepResult)
      const idx = config.agents.indexOf(agentCfg)
      yield { type: 'step_token', agentName: agentCfg.name, content: pr.response.content }
      yield { type: 'step_done', agentName: agentCfg.name, stepIndex: idx, result: stepResult }
    }
  }

  /**
   * 停止编排（业务方法）
   * 无参数调用时为生命周期停止方法：无操作
   */
  stop(runId?: string): void {
    if (!runId) return // 生命周期方法：无操作
    // 停止所有相关的 lifecycle
    for (const [key, lc] of this.activeLifecycles) {
      if (key === runId || key.startsWith(`${runId}-`)) {
        lc.stop()
      }
    }
  }

  // ===== [重构] 模板库 — 委托 OrchestrationTemplates =====

  listTemplates(): OrchestrationTemplate[] {
    return this.templatesRepo.list()
  }

  getTemplate(id: string): OrchestrationTemplate | undefined {
    return this.templatesRepo.get(id)
  }

  registerTemplate(template: OrchestrationTemplate): void {
    this.templatesRepo.register(template)
  }

  // ===== [重构] 执行回放 — 委托 OrchestrationReplay =====

  private recordRun(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    startTime: number,
    success: boolean,
    error?: string,
  ): void {
    this.replayRepo.recordRun(config, results, startTime, success, error)
  }

  listRuns(limit?: number): OrchestrationRunRecord[] {
    return this.replayRepo.listRuns(limit)
  }

  getRun(id: string): OrchestrationRunRecord | undefined {
    return this.replayRepo.getRun(id)
  }

  getPerformanceReport(): OrchestrationPerformanceReport {
    return this.replayRepo.getPerformanceReport()
  }
}
