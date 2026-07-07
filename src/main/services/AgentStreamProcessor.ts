// AgentStreamProcessor — Agent 流式事件处理器
// 从 AgentService 提取：processStreamEvents 方法
// 职责：处理 ReActAgent 的流式事件、子 Agent 事件映射、消息持久化、指标记录
//
// 架构：AgentService.runStream() 委托此类处理流式事件

import type { ReActAgent } from '@agentprimordia/sdk'
import type { StreamEvent } from '@agentprimordia/sdk'
import type { AgentStreamEvent } from './AgentService'
import type { SessionStore } from './SessionStore'
import type { ToolManager } from './ToolManager'
import type { AgentPerformanceOptimizer } from './AgentPerformanceOptimizer'
import type { ChatMessage, MessageMetrics, Skill, ToolCallInfo, ToolResultInfo } from '@shared/types'
import { translateF as t } from '@shared/i18n'
import { randomUUID } from 'crypto'

export interface StreamProcessParams {
  sessionId: string
  input: string
  onMessage?: (msg: ChatMessage) => void
  abortSignal?: AbortSignal
}

export class AgentStreamProcessor {
  constructor(
    private sessionStore: SessionStore,
    private toolManager: ToolManager | null,
    private perfOptimizer: AgentPerformanceOptimizer,
  ) {}

  /**
   * 处理 Agent 流式事件 — 分发并转换 SDK 事件为 AgentStreamEvent
   */
  async *process(
    agent: ReActAgent,
    params: StreamProcessParams,
    activeSkills: Skill[],
  ): AsyncGenerator<AgentStreamEvent> {
    let assistantContent = ''
    const toolCallsCollected: ToolCallInfo[] = []
    const toolResultsCollected: ToolResultInfo[] = []
    let hasEmittedSubAgentForThisTurn = false

    try {
      for await (const event of agent.streamEvents(params.input)) {
        if (params.abortSignal?.aborted) {
          if (assistantContent) {
            const partialMsg: ChatMessage = {
              id: randomUUID(),
              sessionId: params.sessionId,
              role: 'assistant',
              content: assistantContent + '\n\n[已中断]',
              toolCalls: toolCallsCollected.length > 0 ? toolCallsCollected : undefined,
              createdAt: new Date().toISOString(),
            }
            this.sessionStore.addMessage(partialMsg)
            params.onMessage?.(partialMsg)
          }
          yield { type: 'done', response: { content: '', metrics: { totalTurns: 0, totalTools: toolCallsCollected.length, duration: 0, llmLatency: 0, toolLatency: 0 } } }
          return
        }
        switch (event.type) {
          case 'token': {
            assistantContent += event.content
            // 子 Agent 事件映射
            const tokenEvent = event as StreamEvent & { turn?: number }
            if (tokenEvent.turn !== undefined && tokenEvent.turn > 0) {
              const turnNum = tokenEvent.turn
              const agentId = `react-turn-${turnNum}`
              if (!hasEmittedSubAgentForThisTurn) {
                yield { type: 'sub_agent_start' as const, agentId, agentName: t('subagent.reactTurn', { n: turnNum }) }
                hasEmittedSubAgentForThisTurn = true
              }
              yield { type: 'sub_agent_token' as const, agentId, content: event.content }
            }
            yield event
            break
          }

          case 'tool_call':
            toolCallsCollected.push(event.toolCall)
            if (event.turn > 0) {
              const agentId = `react-turn-${event.turn}`
              if (!hasEmittedSubAgentForThisTurn) {
                yield { type: 'sub_agent_start' as const, agentId, agentName: t('subagent.reactTurn', { n: event.turn }) }
                hasEmittedSubAgentForThisTurn = true
              }
              yield {
                type: 'sub_agent_tool_call' as const,
                agentId,
                toolName: event.toolCall.name,
                toolArgs: typeof event.toolCall.arguments === 'string'
                  ? event.toolCall.arguments
                  : JSON.stringify(event.toolCall.arguments),
              }
            }
            yield event
            break

          case 'tool_result':
            toolResultsCollected.push(event.result)
            if (event.turn > 0) {
              const agentId = `react-turn-${event.turn}`
              yield {
                type: 'sub_agent_tool_result' as const,
                agentId,
                toolName: event.result.toolCallId || 'tool',
                result: event.result.content,
                isError: event.result.isError,
              }
            }
            yield event
            break

          case 'turn_end':
            if (hasEmittedSubAgentForThisTurn) {
              const agentId = `react-turn-${event.turn}`
              yield { type: 'sub_agent_done' as const, agentId }
              hasEmittedSubAgentForThisTurn = false
            }
            yield event
            break

          case 'done': {
            const assistantMsg: ChatMessage = {
              id: randomUUID(),
              sessionId: params.sessionId,
              role: 'assistant',
              content: assistantContent,
              toolCalls: toolCallsCollected.length > 0 ? toolCallsCollected : undefined,
              metrics: event.response.metrics as MessageMetrics,
              createdAt: new Date().toISOString(),
            }
            this.sessionStore.addMessage(assistantMsg)
            params.onMessage?.(assistantMsg)

            for (const result of toolResultsCollected) {
              const toolMsg: ChatMessage = {
                id: randomUUID(),
                sessionId: params.sessionId,
                role: 'tool',
                content: result.content,
                toolResult: result,
                createdAt: new Date().toISOString(),
              }
              this.sessionStore.addMessage(toolMsg)
            }

            // 记录运行指标到 PerformanceOptimizer（SelfTuner）
            const metrics = event.response.metrics as MessageMetrics | undefined
            this.perfOptimizer.recordRun({
              totalTurns: metrics?.totalTurns ?? 1,
              totalTools: toolCallsCollected.length,
              duration: metrics?.duration ?? 0,
              llmLatency: metrics?.llmLatency ?? 0,
              toolLatency: metrics?.toolLatency ?? 0,
              totalTokens: undefined,
              toolFailures: toolResultsCollected.filter(r => r.isError).length,
              success: true,
            })

            yield event
            break
          }

          case 'error':
            yield event
            break
        }
      }
    } catch (err: unknown) {
      if (params.abortSignal?.aborted) {
        if (assistantContent) {
          const partialMsg: ChatMessage = {
            id: randomUUID(),
            sessionId: params.sessionId,
            role: 'assistant',
            content: assistantContent + '\n\n[已中断]',
            toolCalls: toolCallsCollected.length > 0 ? toolCallsCollected : undefined,
            createdAt: new Date().toISOString(),
          }
            this.sessionStore.addMessage(partialMsg)
            params.onMessage?.(partialMsg)
          }
          yield { type: 'done', response: { content: '', metrics: { totalTurns: 0, totalTools: toolCallsCollected.length, duration: 0, llmLatency: 0, toolLatency: 0 } } }
          return
        }
        if (assistantContent) {
        const errorMsg: ChatMessage = {
          id: randomUUID(),
          sessionId: params.sessionId,
          role: 'assistant',
          content: assistantContent + `\n\n[错误: ${(err as Error).message}]`,
          createdAt: new Date().toISOString(),
        }
        this.sessionStore.addMessage(errorMsg)
        params.onMessage?.(errorMsg)
      }
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
    } finally {
      // 清理技能工具注册
      for (const skill of activeSkills) {
        if (skill.asTool) {
          this.toolManager?.unregisterSkillAsTool(skill)
        }
      }
    }
  }
}
