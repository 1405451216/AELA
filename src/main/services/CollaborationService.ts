// 协作模式服务
// 移植自 AP Go 核心层 orchestration/collaboration.go + debate.go
// 支持: 辩论 / 评审 / 共识 / 头脑风暴 四种协作模式

import { ReActAgent, HookManager, Lifecycle, A2ABus } from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type {
  CollaborationConfig,
  CollaborationResult,
  OrchestrationAgentConfig,
  OrchestrationEvent,
  OrchestrationStepResult,
  MessageMetrics,
} from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ToolManager } from './ToolManager'
import type { ConfigStore } from './ConfigStore'
import { ToolRegistry } from '@agentprimordia/sdk'
import { randomUUID } from 'crypto'

export class CollaborationService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private toolManager: ToolManager | null
  private a2aBus: A2ABus
  private activeLifecycles: Map<string, Lifecycle> = new Map()

  constructor(
    configStore: ConfigStore,
    providerManager: ProviderManager,
    toolManager: ToolManager | null
  ) {
    this.configStore = configStore
    this.providerManager = providerManager
    this.toolManager = toolManager
    this.a2aBus = new A2ABus()
  }

setToolManager(tm: ToolManager): void {
this.toolManager = tm
}

  getA2ABus(): A2ABus {
    return this.a2aBus
  }

  /**
   * 创建单个 ReActAgent
   */
  private createAgent(agentCfg: OrchestrationAgentConfig): { agent: ReActAgent; lifecycle: Lifecycle } {
    const modelConfig = this.configStore.getModel(agentCfg.modelConfigId)
    if (!modelConfig) throw new Error(`未找到模型配置: ${agentCfg.modelConfigId}`)

    const provider: Provider = this.providerManager.createProvider(modelConfig)
    const appConfig = this.configStore.getConfig()
    const hooks = new HookManager()
    const lifecycle = new Lifecycle()
    const toolkit = this.toolManager?.getRegistry() ?? new ToolRegistry()

    return {
      agent: new ReActAgent({
        name: agentCfg.name,
        model: provider,
        toolkit,
        maxTurns: agentCfg.maxTurns ?? appConfig.maxTurns,
        maxMessages: appConfig.maxMessages,
        systemPrompt: agentCfg.systemPrompt,
        hooks,
        lifecycle,
      }),
      lifecycle,
    }
  }

  /**
   * 运行协作
   */
  async *run(config: CollaborationConfig): AsyncGenerator<OrchestrationEvent | { type: 'collab_done'; result: CollaborationResult }> {
    const startTime = Date.now()
    const allArguments: CollaborationResult['arguments'] = []
    const results: OrchestrationStepResult[] = []
    const runId = config.id || randomUUID()

    try {
      switch (config.mode) {
        case 'debate':
          yield* this.runDebate(config, allArguments, results)
          break
        case 'review':
          yield* this.runReview(config, allArguments, results)
          break
        case 'consensus':
          yield* this.runConsensus(config, allArguments, results)
          break
        case 'brainstorm':
          yield* this.runBrainstorm(config, allArguments, results)
          break
      }

      // 尝试达成共识
      let consensus: string | undefined
      if (config.mode === 'consensus' || config.mode === 'review') {
        consensus = await this.tryConsensus(config, allArguments)
      }

      yield {
        type: 'collab_done',
        result: {
          configId: runId,
          mode: config.mode,
          arguments: allArguments,
          consensus,
          duration: Date.now() - startTime,
          success: true,
        },
      }
    } catch (err: unknown) {
      yield {
        type: 'collab_done',
        result: {
          configId: runId,
          mode: config.mode,
          arguments: allArguments,
          duration: Date.now() - startTime,
          success: false,
        },
      }
    } finally {
      this.activeLifecycles.clear()
    }
  }

  /**
   * 辩论模式: Agent 轮流提出论点并回应对方
   */
  private async *runDebate(
    config: CollaborationConfig,
    allArguments: CollaborationResult['arguments'],
    results: OrchestrationStepResult[]
  ): AsyncGenerator<OrchestrationEvent> {
    let currentTopic = config.topic
    let stepIndex = 0

    for (let round = 0; round < config.maxRounds; round++) {
      for (let i = 0; i < config.agents.length; i++) {
        const agentCfg = config.agents[i]
        yield { type: 'step_start', agentName: agentCfg.name, stepIndex }

        const { agent, lifecycle } = this.createAgent(agentCfg)
        this.activeLifecycles.set(`${config.id}-${round}-${i}`, lifecycle)

        // 第一轮: 提出论点; 后续轮次: 回应对方
        const isInitial = round === 0
        const input = isInitial
          ? `辩论主题: ${currentTopic}\n\n请提出你的观点和论据。`
          : `对方观点: ${currentTopic}\n\n请回应对方的观点, 指出问题并提出你的反驳。`

        let content = ''
        let metrics: MessageMetrics | undefined

        try {
          for await (const event of agent.streamEvents(input)) {
            if (event.type === 'token') {
              content += event.content
              yield { type: 'step_token', agentName: agentCfg.name, content: event.content }
            } else if (event.type === 'done') {
              metrics = event.response.metrics as MessageMetrics
            }
          }

          allArguments.push({
            agentName: agentCfg.name,
            round,
            type: isInitial ? 'initial' : 'response',
            content,
          })

          const stepResult: OrchestrationStepResult = {
            agentName: agentCfg.name,
            content,
            metrics,
            skipped: false,
          }
          results.push(stepResult)
          yield { type: 'step_done', agentName: agentCfg.name, stepIndex, result: stepResult }

          currentTopic = content
          stepIndex++
        } catch (err: unknown) {
          const stepResult: OrchestrationStepResult = {
            agentName: agentCfg.name,
            content,
            skipped: false,
            error: err instanceof Error ? err.message : String(err),
          }
          results.push(stepResult)
          yield { type: 'step_done', agentName: agentCfg.name, stepIndex, result: stepResult }
          stepIndex++
        }
      }
    }
  }

  /**
   * 评审模式: Agent 互相审查并改进
   */
  private async *runReview(
    config: CollaborationConfig,
    allArguments: CollaborationResult['arguments'],
    results: OrchestrationStepResult[]
  ): AsyncGenerator<OrchestrationEvent> {
    let currentWork = config.topic
    let stepIndex = 0

    for (let round = 0; round < config.maxRounds; round++) {
      for (let i = 0; i < config.agents.length; i++) {
        const agentCfg = config.agents[i]
        yield { type: 'step_start', agentName: agentCfg.name, stepIndex }

        const { agent, lifecycle } = this.createAgent(agentCfg)
        this.activeLifecycles.set(`${config.id}-${round}-${i}`, lifecycle)

        const input = round === 0 && i === 0
          ? `请针对以下主题提出方案:\n${currentWork}`
          : `以下是上一轮的输出, 请审查并改进:\n${currentWork}`

        let content = ''

        try {
          for await (const event of agent.streamEvents(input)) {
            if (event.type === 'token') {
              content += event.content
              yield { type: 'step_token', agentName: agentCfg.name, content: event.content }
            }
          }

          allArguments.push({
            agentName: agentCfg.name,
            round,
            type: i === 0 && round === 0 ? 'initial' : 'response',
            content,
          })

          const stepResult: OrchestrationStepResult = {
            agentName: agentCfg.name,
            content,
            skipped: false,
          }
          results.push(stepResult)
          yield { type: 'step_done', agentName: agentCfg.name, stepIndex, result: stepResult }

          currentWork = content
          stepIndex++
        } catch (err: unknown) {
          results.push({
            agentName: agentCfg.name,
            content,
            skipped: false,
            error: err instanceof Error ? err.message : String(err),
          })
          stepIndex++
        }
      }
    }
  }

  /**
   * 共识模式: 多 Agent 讨论并投票
   */
  private async *runConsensus(
    config: CollaborationConfig,
    allArguments: CollaborationResult['arguments'],
    results: OrchestrationStepResult[]
  ): AsyncGenerator<OrchestrationEvent> {
    const _threshold = config.votingThreshold ?? 0.6
    let currentTopic = config.topic
    let stepIndex = 0

    for (let round = 0; round < config.maxRounds; round++) {
      const roundOutputs: string[] = []

      // 所有 Agent 同时发表意见
      for (let i = 0; i < config.agents.length; i++) {
        const agentCfg = config.agents[i]
        yield { type: 'step_start', agentName: agentCfg.name, stepIndex }

        const { agent, lifecycle } = this.createAgent(agentCfg)
        this.activeLifecycles.set(`${config.id}-${round}-${i}`, lifecycle)

        const input = round === 0
          ? `讨论主题: ${currentTopic}\n\n请发表你的看法和建议。`
          : `上一轮讨论总结: ${currentTopic}\n\n请进一步发表意见, 尝试与其他人的观点趋同。`

        let content = ''

        try {
          for await (const event of agent.streamEvents(input)) {
            if (event.type === 'token') {
              content += event.content
              yield { type: 'step_token', agentName: agentCfg.name, content: event.content }
            }
          }

          allArguments.push({
            agentName: agentCfg.name,
            round,
            type: 'initial',
            content,
          })
          roundOutputs.push(content)

          results.push({
            agentName: agentCfg.name,
            content,
            skipped: false,
          })
          yield { type: 'step_done', agentName: agentCfg.name, stepIndex, result: { agentName: agentCfg.name, content, skipped: false } }
          stepIndex++
        } catch (err: unknown) {
          results.push({
            agentName: agentCfg.name,
            content,
            skipped: false,
            error: err instanceof Error ? err.message : String(err),
          })
          stepIndex++
        }
      }

      // 更新讨论主题为本轮综合
      currentTopic = roundOutputs.join('\n\n---\n\n')
    }
  }

  /**
   * 头脑风暴模式: 自由发散
   */
  private async *runBrainstorm(
    config: CollaborationConfig,
    allArguments: CollaborationResult['arguments'],
    results: OrchestrationStepResult[]
  ): AsyncGenerator<OrchestrationEvent> {
    let stepIndex = 0

    for (let round = 0; round < config.maxRounds; round++) {
      for (let i = 0; i < config.agents.length; i++) {
        const agentCfg = config.agents[i]
        yield { type: 'step_start', agentName: agentCfg.name, stepIndex }

        const { agent, lifecycle } = this.createAgent(agentCfg)
        this.activeLifecycles.set(`${config.id}-${round}-${i}`, lifecycle)

        const previousIdeas = allArguments
          .filter(a => a.round < round)
          .map(a => `${a.agentName}: ${a.content.slice(0, 200)}`)
          .join('\n')

        const input = `头脑风暴主题: ${config.topic}\n\n${previousIdeas ? `已有想法:\n${previousIdeas}\n\n` : ''}请提出新的创意和想法, 不要重复已有内容。`

        let content = ''

        try {
          for await (const event of agent.streamEvents(input)) {
            if (event.type === 'token') {
              content += event.content
              yield { type: 'step_token', agentName: agentCfg.name, content: event.content }
            }
          }

          allArguments.push({
            agentName: agentCfg.name,
            round,
            type: 'initial',
            content,
          })

          results.push({
            agentName: agentCfg.name,
            content,
            skipped: false,
          })
          yield { type: 'step_done', agentName: agentCfg.name, stepIndex, result: { agentName: agentCfg.name, content, skipped: false } }
          stepIndex++
        } catch (err: unknown) {
          results.push({
            agentName: agentCfg.name,
            content,
            skipped: false,
            error: err instanceof Error ? err.message : String(err),
          })
          stepIndex++
        }
      }
    }
  }

  /**
   * 尝试达成共识 (用第一个 Agent 总结)
   */
  private async tryConsensus(
    config: CollaborationConfig,
    allArguments: CollaborationResult['arguments']
  ): Promise<string | undefined> {
    if (allArguments.length === 0 || config.agents.length === 0) return undefined

    try {
      const { agent } = this.createAgent(config.agents[0])
      const summary = await agent.run(
        `以下是多个 Agent 的讨论记录, 请总结出共识结论:\n\n${allArguments.map(a => `[${a.agentName} - 轮次${a.round + 1}] ${a.content.slice(0, 500)}`).join('\n\n')}\n\n请输出共识结论 (200字以内):`
      )
      return summary.content
    } catch {
      return undefined
    }
  }

  /**
   * 停止协作（业务方法）
   * 无参数调用时为生命周期停止方法：无操作
   */
  stop(runId?: string): void {
    if (!runId) return // 生命周期方法：无操作
    for (const [, lc] of this.activeLifecycles) {
      lc.stop()
    }
    this.activeLifecycles.clear()
  }
}
