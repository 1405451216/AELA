// GroupChat + Debate 高级编排策略
// 封装 SDK GroupChat / Debate 的高级编排逻辑。
// OrchestrationService 将 groupchat / debate 两种模式的实际编排委托给本类。

import { GroupChat, Debate } from '@agentprimordia/sdk'
import type { ReActAgent, Lifecycle } from '@agentprimordia/sdk'
import type {
  OrchestrationConfig,
  OrchestrationStepResult,
  OrchestrationEvent,
} from '@shared/types'

/** createAgent 工厂签名 — 由 OrchestrationService 注入，避免反向依赖 */
export type CreateAgentFn = (
  name: string,
  modelConfigId: string,
  systemPrompt: string,
  maxTurns?: number
) => { agent: ReActAgent; lifecycle: Lifecycle }

/**
 * GroupChatOrchestrator
 *
 * 职责：
 * - GroupChat 群聊编排（多 Agent 讨论同一主题，可选主持人）
 * - Debate 辩论编排（正方/反方/裁判 多轮辩论）
 */
export class GroupChatOrchestrator {
  private createAgent: CreateAgentFn

  constructor(createAgent: CreateAgentFn) {
    this.createAgent = createAgent
  }

  /**
   * GroupChat 群聊编排
   * 使用 SDK 的 GroupChat 类，多 Agent 以群聊形式讨论同一主题
   * 可选主持人 Agent 负责引导方向和总结
   */
  async *runGroupChat(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    _startTime: number
  ): AsyncGenerator<OrchestrationEvent> {
    const maxRounds = config.maxRounds ?? 3

    // 创建所有 Agent
    const agents: ReActAgent[] = []
    let moderator: ReActAgent | undefined

    for (let i = 0; i < config.agents.length; i++) {
      const agentCfg = config.agents[i]
      const { agent } = this.createAgent(
        agentCfg.name,
        agentCfg.modelConfigId,
        agentCfg.systemPrompt,
        agentCfg.maxTurns
      )

      // 第一个 role 为 'moderator' 的 Agent 作为主持人
      if (agentCfg.role === 'moderator' && !moderator) {
        moderator = agent
      } else {
        agents.push(agent)
      }

      yield { type: 'step_start', agentName: agentCfg.name, stepIndex: i }
    }

    // 如果没有明确指定主持人，且只有 agents，则不使用主持人
    // 如果主持人存在，从 agents 中排除（已处理）
    // 确保 agents 至少有 1 个
    if (agents.length === 0 && config.agents.length > 0) {
      // 所有 agent 都被当作 moderator 了，把第一个作为普通 agent
      const { agent } = this.createAgent(
        config.agents[0].name,
        config.agents[0].modelConfigId,
        config.agents[0].systemPrompt,
        config.agents[0].maxTurns
      )
      agents.push(agent)
      moderator = undefined
    }

    // 使用 SDK GroupChat
    const groupChat = new GroupChat({
      agents,
      maxRounds,
      moderator,
      topic: config.input,
    })

    try {
      const gcResult = await groupChat.run(config.input)

      // 将群聊消息转为编排事件
      for (let i = 0; i < gcResult.messages.length; i++) {
        const msg = gcResult.messages[i]
        const stepResult: OrchestrationStepResult = {
          agentName: msg.agentName,
          content: msg.content,
          metrics: undefined,
          skipped: false,
        }
        results.push(stepResult)
        yield { type: 'step_token', agentName: msg.agentName, content: msg.content }
        yield { type: 'step_done', agentName: msg.agentName, stepIndex: i, result: stepResult }
      }

      // 主持人总结
      if (gcResult.summary) {
        const summaryResult: OrchestrationStepResult = {
          agentName: moderator?.name ?? 'summary',
          content: gcResult.summary,
          metrics: undefined,
          skipped: false,
        }
        results.push(summaryResult)
        yield { type: 'step_token', agentName: 'summary', content: gcResult.summary }
        yield { type: 'step_done', agentName: 'summary', stepIndex: gcResult.messages.length, result: summaryResult }
      }
    } catch (err: unknown) {
      const errorResult: OrchestrationStepResult = {
        agentName: 'groupchat',
        content: '',
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      }
      results.push(errorResult)
      yield { type: 'step_done', agentName: 'groupchat', stepIndex: 0, result: errorResult }
    }
  }

  /**
   * Debate 辩论编排
   * 使用 SDK 的 Debate 类，正方与反方多轮辩论，可选裁判
   */
  async *runDebate(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    _startTime: number
  ): AsyncGenerator<OrchestrationEvent> {
    const rounds = config.maxRounds ?? 3

    // 分配角色：正方、反方、裁判
    let proponent: ReActAgent | undefined
    let opponent: ReActAgent | undefined
    let judge: ReActAgent | undefined

    for (const agentCfg of config.agents) {
      const { agent } = this.createAgent(
        agentCfg.name,
        agentCfg.modelConfigId,
        agentCfg.systemPrompt,
        agentCfg.maxTurns
      )
      yield { type: 'step_start', agentName: agentCfg.name, stepIndex: 0 }

      if (agentCfg.role === 'proponent' && !proponent) {
        proponent = agent
      } else if (agentCfg.role === 'opponent' && !opponent) {
        opponent = agent
      } else if (agentCfg.role === 'judge' && !judge) {
        judge = agent
      } else {
        // 未匹配角色的优先分配
        if (!proponent) proponent = agent
        else if (!opponent) opponent = agent
        else if (!judge) judge = agent
      }
    }

    if (!proponent || !opponent) {
      yield { type: 'error', error: '辩论模式至少需要正方和反方两个 Agent' }
      return
    }

    // 使用 SDK Debate
    const debate = new Debate({
      topic: config.input,
      proponent,
      opponent,
      judge,
      rounds,
    })

    try {
      const debateResult = await debate.run()

      // 正方论点
      for (let i = 0; i < debateResult.proponentArguments.length; i++) {
        const arg = debateResult.proponentArguments[i]
        const stepResult: OrchestrationStepResult = {
          agentName: proponent.name,
          content: arg,
          metrics: undefined,
          skipped: false,
        }
        results.push(stepResult)
        yield { type: 'step_token', agentName: proponent.name, content: arg }
        yield { type: 'step_done', agentName: proponent.name, stepIndex: i * 2, result: stepResult }
      }

      // 反方论点
      for (let i = 0; i < debateResult.opponentArguments.length; i++) {
        const arg = debateResult.opponentArguments[i]
        const stepResult: OrchestrationStepResult = {
          agentName: opponent.name,
          content: arg,
          metrics: undefined,
          skipped: false,
        }
        results.push(stepResult)
        yield { type: 'step_token', agentName: opponent.name, content: arg }
        yield { type: 'step_done', agentName: opponent.name, stepIndex: i * 2 + 1, result: stepResult }
      }

      // 裁判裁决
      if (debateResult.judgeVerdict) {
        const verdictResult: OrchestrationStepResult = {
          agentName: judge?.name ?? 'judge',
          content: `裁决: ${debateResult.judgeVerdict}\n胜方: ${debateResult.winner ?? 'draw'}`,
          metrics: undefined,
          skipped: false,
        }
        results.push(verdictResult)
        yield { type: 'step_token', agentName: 'judge', content: verdictResult.content }
        yield { type: 'step_done', agentName: 'judge', stepIndex: rounds * 2, result: verdictResult }
      }
    } catch (err: unknown) {
      const errorResult: OrchestrationStepResult = {
        agentName: 'debate',
        content: '',
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      }
      results.push(errorResult)
      yield { type: 'step_done', agentName: 'debate', stepIndex: 0, result: errorResult }
    }
  }
}
