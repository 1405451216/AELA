// StreamingPipeline 流式管道编排策略
// 封装 SDK StreamingPipeline 的 token 级流式传递编排逻辑。
// 与普通 Pipeline 的区别：前者在 Agent 产出 token 时立即传递给下游，前者需要等完整结果。
// OrchestrationService 将 streaming_pipeline 模式的实际编排委托给本类。

import { StreamingPipeline, type StreamingPipelineStep } from '@agentprimordia/sdk'
import type { Lifecycle } from '@agentprimordia/sdk'
import type {
  OrchestrationConfig,
  OrchestrationStepResult,
  OrchestrationEvent,
  MessageMetrics,
} from '@shared/types'
import type { CreateAgentFn } from './GroupChatOrchestrator'

/**
 * StreamingPipelineOrchestrator
 *
 * 职责：
 * - StreamingPipeline 流式管道编排（token 级流式传递，适用于翻译/内容生成管道）
 */
export class StreamingPipelineOrchestrator {
  private createAgent: CreateAgentFn
  private activeLifecycles: Map<string, Lifecycle>

  constructor(createAgent: CreateAgentFn, activeLifecycles: Map<string, Lifecycle>) {
    this.createAgent = createAgent
    this.activeLifecycles = activeLifecycles
  }

  /**
   * StreamingPipeline 流式管道编排
   * 使用 SDK 的 StreamingPipeline 类，实现 token 级流式传递
   *
   * 与普通 Pipeline 的区别：
   * - 普通 Pipeline 等待每个 Agent 完整运行后再传递给下一个
   * - StreamingPipeline 在 Agent 产出 token 时立即流式传递给下游
   *
   * 适用场景：翻译管道、内容生成管道、多视角分析等需要低延迟的场景
   */
  async *runStreamingPipeline(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    _startTime: number
  ): AsyncGenerator<OrchestrationEvent> {
    // 构建 StreamingPipelineStep[]
    const steps: StreamingPipelineStep[] = []
    const lifecycles: Lifecycle[] = []

    for (let i = 0; i < config.agents.length; i++) {
      const agentCfg = config.agents[i]
      const { agent, lifecycle } = this.createAgent(
        agentCfg.name,
        agentCfg.modelConfigId,
        agentCfg.systemPrompt,
        agentCfg.maxTurns
      )
      lifecycles.push(lifecycle)
      this.activeLifecycles.set(`${config.id}-${i}`, lifecycle)

      yield { type: 'step_start', agentName: agentCfg.name, stepIndex: i }

      steps.push({
        name: agentCfg.name,
        agent,
        // 如果 Agent 有自定义输入，用 transformInput 拼接
        transformInput: agentCfg.input
          ? (originalInput: string, _upstreamOutput: string | null) => {
              // 第一个步骤使用 agent 自定义输入，后续步骤使用上游输出
              if (_upstreamOutput === null) return agentCfg.input || originalInput
              return _upstreamOutput
            }
          : undefined,
      })
    }

    // 创建 SDK StreamingPipeline
    const pipeline = new StreamingPipeline(steps)

    try {
      // 流式执行，将 SDK 事件映射为 AELA OrchestrationEvent
      for await (const event of pipeline.stream(config.input)) {
        switch (event.type) {
          case 'step_start':
            // 已在上面提前发出，跳过
            break

          case 'step_token':
            yield {
              type: 'step_token',
              agentName: event.step,
              content: event.content,
            }
            break

          case 'step_tool_call':
            yield {
              type: 'step_token',
              agentName: event.step,
              content: `\n[工具调用: ${event.toolName}]\n`,
            }
            break

          case 'step_tool_result':
            yield {
              type: 'step_token',
              agentName: event.step,
              content: event.success ? '' : `\n[工具 ${event.toolName} 执行失败]\n`,
            }
            break

          case 'step_done': {
            const metrics = event.response.metrics as MessageMetrics | undefined
            const stepResult: OrchestrationStepResult = {
              agentName: event.step,
              content: event.response.content,
              metrics,
              skipped: false,
            }
            results.push(stepResult)
            yield {
              type: 'step_done',
              agentName: event.step,
              stepIndex: event.index,
              result: stepResult,
            }
            break
          }

          case 'pipeline_done':
            // 所有步骤完成，由外层 run() 处理 all_done
            break

          case 'error': {
            const errorStep = event.step ?? 'unknown'
            const stepResult: OrchestrationStepResult = {
              agentName: errorStep,
              content: '',
              skipped: false,
              error: event.error.message,
            }
            results.push(stepResult)
            yield {
              type: 'step_done',
              agentName: errorStep,
              stepIndex: event.index ?? 0,
              result: stepResult,
            }
            return
          }
        }
      }
    } catch (err: unknown) {
      const errorResult: OrchestrationStepResult = {
        agentName: 'streaming_pipeline',
        content: '',
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      }
      results.push(errorResult)
      yield { type: 'step_done', agentName: 'streaming_pipeline', stepIndex: 0, result: errorResult }
    }
  }
}
