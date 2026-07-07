// Supervisor 监督者模式编排策略
// 封装 SDK Supervisor 的动态任务分配编排逻辑。
// OrchestrationService 将 supervisor 模式的实际编排委托给本类。

import { Supervisor } from '@agentprimordia/sdk'
import type { ReActAgent } from '@agentprimordia/sdk'
import type {
  OrchestrationConfig,
  OrchestrationStepResult,
  OrchestrationEvent,
} from '@shared/types'
import type { CreateAgentFn } from './GroupChatOrchestrator'

/**
 * SupervisorOrchestrator
 *
 * 职责：
 * - Supervisor 监督者编排（第一个 Agent 为监督者，其余为工作者，动态分配子任务）
 */
export class SupervisorOrchestrator {
  private createAgent: CreateAgentFn

  constructor(createAgent: CreateAgentFn) {
    this.createAgent = createAgent
  }

  /**
   * Supervisor 监督者编排
   * 使用 SDK 的 Supervisor 类，监督者动态分配子任务给工作者
   */
  async *runSupervisor(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    _startTime: number
  ): AsyncGenerator<OrchestrationEvent> {
    const maxIterations = config.maxRounds ?? 10

    // 第一个 Agent 为监督者，其余为工作者
    if (config.agents.length < 2) {
      yield { type: 'error', error: '监督者模式至少需要监督者 + 1 个工作者' }
      return
    }

    const supervisorCfg = config.agents[0]
    const { agent: supervisorAgent } = this.createAgent(
      supervisorCfg.name,
      supervisorCfg.modelConfigId,
      supervisorCfg.systemPrompt,
      supervisorCfg.maxTurns
    )
    yield { type: 'step_start', agentName: supervisorCfg.name, stepIndex: 0 }

    // 创建工作者 Map
    const workers = new Map<string, ReActAgent>()
    for (let i = 1; i < config.agents.length; i++) {
      const workerCfg = config.agents[i]
      const { agent } = this.createAgent(
        workerCfg.name,
        workerCfg.modelConfigId,
        workerCfg.systemPrompt,
        workerCfg.maxTurns
      )
      workers.set(workerCfg.name, agent)
      yield { type: 'step_start', agentName: workerCfg.name, stepIndex: i }
    }

    // 使用 SDK Supervisor
    const supervisor = new Supervisor({
      supervisor: supervisorAgent,
      workers,
      maxIterations,
    })

    try {
      const supResult = await supervisor.run(config.input)

      // 将工作者结果转为编排事件
      let stepIdx = 0
      for (const [workerName, output] of Object.entries(supResult.workerResults)) {
        const stepResult: OrchestrationStepResult = {
          agentName: workerName,
          content: output,
          metrics: undefined,
          skipped: false,
        }
        results.push(stepResult)
        yield { type: 'step_token', agentName: workerName, content: output }
        yield { type: 'step_done', agentName: workerName, stepIndex: stepIdx++, result: stepResult }
      }

      // 监督者最终输出
      if (supResult.output) {
        const finalResult: OrchestrationStepResult = {
          agentName: supervisorCfg.name,
          content: supResult.output,
          metrics: undefined,
          skipped: false,
        }
        results.push(finalResult)
        yield { type: 'step_token', agentName: supervisorCfg.name, content: supResult.output }
        yield { type: 'step_done', agentName: supervisorCfg.name, stepIndex: stepIdx, result: finalResult }
      }
    } catch (err: unknown) {
      const errorResult: OrchestrationStepResult = {
        agentName: 'supervisor',
        content: '',
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      }
      results.push(errorResult)
      yield { type: 'step_done', agentName: 'supervisor', stepIndex: 0, result: errorResult }
    }
  }
}
