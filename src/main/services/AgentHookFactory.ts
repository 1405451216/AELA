// Agent Hook 工厂
// 从 AgentService 拆分: 负责创建 HookManager + 注册 10 个 HookPoint 回调
// 职责: 可观测性事件发布 / 成本追踪 / HITL 中断 / 审计日志 / 工具学习 / 自动记忆 / 用户 Hooks

import { HookManager } from '@agentprimordia/sdk'
import type { Usage } from '@agentprimordia/sdk'
import type { ObservabilityService } from './ObservabilityService'
import type { MemoryService } from './MemoryService'
import type { CostTrackerService } from './CostTrackerService'
import type { HITLService } from './HITLService'
import type { AuditService } from './AuditService'
import type { ToolLearningService } from './ToolLearningService'
import type { HookConfigService } from './HookConfigService'
import type { GuardrailService } from './GuardrailService'
import type { SecurityService } from './SecurityService'
import type { ModelConfig, HookEventPoint, AccessLevel, ActivityEvent } from '@shared/types'
import { randomUUID } from 'crypto'

/**
 * Agent Hook 工厂 — 创建并配置 HookManager
 *
 * 10 个 HookPoint:
 *   before_run / after_run / before_turn / after_turn
 *   before_llm / after_llm / before_tool / after_tool
 *   on_error / on_complete
 */
export class AgentHookFactory {
  private onActivity: ((event: ActivityEvent) => void) | null = null

  constructor(
    private observability: ObservabilityService,
    private memoryService: MemoryService | null = null,
    private costTracker: CostTrackerService | null = null,
    private hitlService: HITLService | null = null,
    private auditService: AuditService | null = null,
    private toolLearningService: ToolLearningService | null = null,
    private hookConfigService: HookConfigService | null = null,
    private guardrailService: GuardrailService | null = null,
    private securityService: SecurityService | null = null,
    onActivity?: (event: ActivityEvent) => void,
  ) {
    this.onActivity = onActivity ?? null
  }

  /**
   * 更新依赖服务（允许延迟注入）
   */
  setMemoryService(ms: MemoryService): void {
    this.memoryService = ms
  }

  setCostTracker(ct: CostTrackerService): void {
    this.costTracker = ct
  }

  setHITLService(hitl: HITLService): void {
    this.hitlService = hitl
  }

  setAuditService(audit: AuditService): void {
    this.auditService = audit
  }

  setToolLearningService(tl: ToolLearningService): void {
    this.toolLearningService = tl
  }

  setHookConfigService(hcs: HookConfigService): void {
    this.hookConfigService = hcs
  }

  setGuardrailService(gs: GuardrailService): void {
    this.guardrailService = gs
  }

  setSecurityService(ss: SecurityService): void {
    this.securityService = ss
  }

  setActivityCallback(cb: (event: ActivityEvent) => void): void {
    this.onActivity = cb
  }

  private sendActivity(event: ActivityEvent): void {
    this.onActivity?.(event)
  }

  /**
   * 创建 Hook 管理器 — 深度利用 10 个 HookPoint
   */
  createHooks(sessionId: string, metrics: { llmStart: number }, modelConfig?: ModelConfig, permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'): HookManager {
    const hooks = new HookManager()
    const obs = this.observability
    const mc = obs.getMetricsCollector()
    const permLevel = permissionLevel || 'ask'

    // before_run: 发布事件 + 增加活跃 Agent 计数 + 用户 Hooks
    hooks.register('before_run', async (ctx) => {
      mc.incActiveAgents()
      obs.publish('agent.start', ctx.agentID, { sessionId: ctx.sessionID })
      await this.executeUserHooks('before_run', ctx, sessionId)
    })

    // after_run: 发布事件 + 减少活跃 Agent 计数 + 用户 Hooks
    hooks.register('after_run', async (ctx) => {
      mc.decActiveAgents()
      obs.publish('agent.stop', ctx.agentID, { sessionId: ctx.sessionID })
      await this.executeUserHooks('after_run', ctx, sessionId)
    })

    // before_turn: 发布事件 + 用户 Hooks
    hooks.register('before_turn', async (ctx) => {
      obs.publish('turn.start', ctx.agentID, { turn: ctx.turn, sessionId: ctx.sessionID })
      await this.executeUserHooks('before_turn', ctx, sessionId)
    })

    // after_turn: 发布事件 + 记录轮次 + 用户 Hooks
    hooks.register('after_turn', async (ctx) => {
      mc.recordTurn()
      obs.publish('turn.end', ctx.agentID, { turn: ctx.turn, sessionId: ctx.sessionID })
      await this.executeUserHooks('after_turn', ctx, sessionId)
    })

    // before_llm: 记录 LLM 调用开始时间 + 用户 Hooks
    // [注意] Guardrail 输入检查在 AgentService.runStream() 中执行（hook ctx 不含 input）
    hooks.register('before_llm', async (ctx) => {
      metrics.llmStart = Date.now()
      obs.publish('llm.call', ctx.agentID, { turn: ctx.turn, sessionId: ctx.sessionID })

      this.sendActivity({
        id: randomUUID(),
        type: 'reasoning',
        turn: ctx.turn,
        timestamp: new Date().toISOString(),
      })

      await this.executeUserHooks('before_llm', ctx, sessionId)
    })

    // after_llm: 记录 LLM 延迟 + 成本追踪 + Guardrail 输出检查
    hooks.register('after_llm', async (ctx) => {
      const latency = Date.now() - metrics.llmStart
      mc.recordLLMCall(latency)
      obs.publish('llm.response', ctx.agentID, { turn: ctx.turn, latency, sessionId: ctx.sessionID })

      this.sendActivity({
        id: randomUUID(),
        type: 'agent_thought',
        turn: ctx.turn,
        duration: latency,
        timestamp: new Date().toISOString(),
      })

      // [修复] Guardrail 输出安全检查 — 检测 PII 泄露/敏感词/不当内容
      if (this.guardrailService && ctx.response?.content) {
        const report = this.guardrailService.check(ctx.response.content, 'output')
        if (!report.passed) {
          const reasons = report.results.map(r => r.message).join('; ')
          if (report.action === 'reject') {
            obs.publish('guardrail.blocked', ctx.agentID, {
              sessionId: ctx.sessionID, phase: 'output', action: report.action, reasons,
            })
            throw new Error(`输出被安全护栏拦截: ${reasons}`)
          }
          // sanitize 动作：替换响应内容为脱敏后的版本
          if (report.action === 'sanitize') {
            const sanitizedResult = report.results.find(r => r.sanitized)
            if (sanitizedResult?.sanitized) {
              ctx.response.content = sanitizedResult.sanitized
            }
          }
        }
      }

      // 成本追踪: 记录 LLM Usage
      const respWithUsage = ctx.response
      if (this.costTracker && respWithUsage?.usage) {
        const usage = respWithUsage.usage as Usage
        const modelName = modelConfig?.model || respWithUsage?.model || 'unknown'
        const exceeded = this.costTracker.record(modelName, ctx.sessionID || sessionId, ctx.agentID, usage)
        if (exceeded) {
          // 预算超限：发布事件 + 触发 HITL 中断
          const costSummary = this.costTracker.summary()
          obs.publish('budget.exceeded', ctx.agentID, {
            sessionId: ctx.sessionID,
            cost: costSummary.totalCostUSD,
          })

          if (this.hitlService && this.hitlService.shouldInterrupt('', 'budget_exceed')) {
            const response = await this.hitlService.requestInterrupt({
              reason: 'budget_exceed',
              message: `预算超限：累计花费 $${costSummary.totalCostUSD.toFixed(4)}，是否继续？`,
              data: {
                sessionId: ctx.sessionID,
                totalCost: costSummary.totalCostUSD,
                modelName,
              },
              turn: ctx.turn,
            })
            if (!response.approved) {
              throw new Error(
                response.feedback
                  ? `预算超限被用户拒绝: ${response.feedback}`
                  : '预算超限，用户拒绝继续'
              )
            }
          }
        }
      }

      await this.executeUserHooks('after_llm', ctx, sessionId)
    })

    // before_tool: 发布事件 + 审计日志 + Security 安全检查 + HITL 检查 + 权限等级控制 + 用户 Hooks
    hooks.register('before_tool', async (ctx) => {
      const toolName = ctx.toolCall?.name || 'unknown'
      obs.publish('tool.call', ctx.agentID, {
        turn: ctx.turn,
        tool: toolName,
        sessionId: ctx.sessionID,
      })

      this.sendActivity({
        id: randomUUID(),
        type: 'tool_start',
        toolName,
        toolId: ctx.toolCall?.id,
        turn: ctx.turn,
        timestamp: new Date().toISOString(),
      })

      // 审计日志
      if (this.auditService) {
        this.auditService.logToolCall(
          ctx.agentID,
          toolName,
          'pending',
          { turn: ctx.turn, sessionId: ctx.sessionID, args: ctx.toolCall?.arguments }
        )
      }

      // ===== 权限等级控制 =====
      // plan 模式：拦截所有文件写入和 Shell 命令工具，仅允许只读工具
      if (permLevel === 'plan') {
        const writeTools = ['write_file', 'edit_file', 'execute_command', 'run_terminal_command', 'delete_file', 'move_file', 'create_directory']
        if (writeTools.includes(toolName)) {
          obs.publish('permission.blocked', ctx.agentID, {
            sessionId: ctx.sessionID,
            tool: toolName,
            reason: 'plan_mode',
          })
          throw new Error(`计划模式下不允许执行写入/命令工具: ${toolName}（仅允许架构和推理，不操作文件）`)
        }
      }

      // ask 模式：Security 安全检查 + HITL 人工确认（文件编辑和高风险命令）
      // auto_edit 模式：Security 安全检查依然执行，但跳过 HITL 确认（自动接受编辑）
      // skip 模式：跳过所有安全检查和 HITL 确认
      if (permLevel !== 'skip' && this.securityService) {
        const args = ctx.toolCall?.arguments
        const argsObj: Record<string, unknown> = typeof args === 'string'
          ? (() => { try { return JSON.parse(args) } catch { return {} } })()
          : (args as Record<string, unknown> | undefined) ?? {}

        // Shell 命令工具：检查命令安全
        if (toolName === 'execute_command' || toolName === 'run_terminal_command') {
          const cmd = String(argsObj?.command || argsObj?.cmd || '')
          if (cmd) {
            // 1. Shell 元字符检测
            const metaCheck = this.securityService.checkShellMetacharacter(cmd)
            if (metaCheck.found) {
              throw new Error(`命令包含危险的 Shell 元字符 '${metaCheck.char}'，已拦截`)
            }
            // 2. 命令白/黑名单检查
            const cmdCheck = this.securityService.checkCommand(ctx.agentID || 'aela-agent', cmd)
            if (!cmdCheck.allowed) {
              throw new Error(`命令被安全策略拦截: ${cmdCheck.error}`)
            }
          }
        }

        // 文件操作工具：检查路径安全
        if (toolName === 'write_file' || toolName === 'read_file' || toolName === 'edit_file') {
          const filePath = String(argsObj?.path || argsObj?.file_path || argsObj?.filePath || '')
          if (filePath) {
            // 1. 路径穿越检测
            const pathCheck = this.securityService.checkPathTraversal(filePath)
            if (!pathCheck.safe) {
              throw new Error(`路径安全检查失败: ${pathCheck.reason}`)
            }
            // 2. ACL 权限检查
            const level = toolName === 'read_file' ? 'read' : 'write'
            const accessCheck = this.securityService.checkAccess(ctx.agentID || 'aela-agent', filePath, level as AccessLevel)
            if (!accessCheck.allowed) {
              throw new Error(`文件访问被安全策略拒绝: ${accessCheck.error}`)
            }
          }
        }
      }

      // HITL 人工确认：仅 ask 模式下触发（文件编辑和高风险命令）
      // auto_edit 模式跳过 HITL（自动接受编辑）
      // skip 模式跳过所有确认
      // plan 模式不会到达这里（写入工具已在上面被拦截）
      if (permLevel === 'ask' && this.hitlService) {
        // 对文件编辑工具和 Shell 命令工具触发 HITL 确认
        const highRiskTools = ['write_file', 'edit_file', 'execute_command', 'run_terminal_command', 'delete_file']
        if (highRiskTools.includes(toolName) && this.hitlService.shouldInterrupt(toolName, 'tool_confirm')) {
          const response = await this.hitlService.requestInterrupt({
            reason: 'tool_confirm',
            message: `确认执行工具: ${toolName}`,
            data: { toolCall: ctx.toolCall, turn: ctx.turn },
            turn: ctx.turn,
          })
          if (!response.approved) {
            throw new Error(`工具调用被用户拒绝: ${toolName}`)
          }
        }
      }

      await this.executeUserHooks('before_tool', ctx, sessionId)
    })

    // after_tool: 记录工具延迟 + 审计日志 + 工具学习
    hooks.register('after_tool', async (ctx) => {
      const isError = ctx.toolResult?.isError
      const toolName = ctx.toolCall?.name || 'unknown'
      const errorObj = isError
        ? new Error(`tool '${toolName}' failed`)
        : undefined
      mc.recordToolCall(0, errorObj)

      this.sendActivity({
        id: randomUUID(),
        type: 'tool_end',
        toolName,
        toolId: ctx.toolCall?.id,
        turn: ctx.turn,
        duration: ctx.duration,
        isError,
        timestamp: new Date().toISOString(),
      })
      obs.publish('tool.result', ctx.agentID, {
        turn: ctx.turn,
        tool: toolName,
        success: !isError,
        sessionId: ctx.sessionID,
      })

      // 审计日志
      if (this.auditService) {
        this.auditService.logToolCall(
          ctx.agentID,
          toolName,
          isError ? 'error' : 'success',
          { turn: ctx.turn, sessionId: ctx.sessionID }
        )
      }

      // 工具学习: 记录成功/失败经验
      if (this.toolLearningService && ctx.toolCall) {
        const args = JSON.stringify(ctx.toolCall.arguments || {})
        if (isError) {
          await this.toolLearningService.recordFailure(toolName, args, ctx.toolResult?.content || 'Unknown error', ctx.sessionID)
        } else {
          await this.toolLearningService.recordSuccess(toolName, args, ctx.toolResult?.content || '', ctx.sessionID)
        }
      }

      await this.executeUserHooks('after_tool', ctx, sessionId)
    })

    // on_error: 发布错误事件 + 用户 Hooks
    hooks.register('on_error', async (ctx) => {
      obs.publish('agent.error', ctx.agentID, {
        error: ctx.error?.message,
        sessionId: ctx.sessionID,
      })
      await this.executeUserHooks('on_error', ctx, sessionId)
    })

    // on_complete: 自动保存情景记忆
    hooks.register('on_complete', async (ctx) => {
      obs.publish('agent.stop', ctx.agentID, { sessionId: ctx.sessionID, completed: true })

      // 自动记忆: 将 Agent 的最终响应保存为 MemoryEpisode
      if (this.memoryService && ctx.response) {
        try {
          await this.memoryService.addEpisode({
            id: randomUUID(),
            sessionId: ctx.sessionID || sessionId,
            role: 'assistant',
            content: ctx.response.content.slice(0, 2000),
            summary: ctx.response.content.slice(0, 200),
            topics: 'agent-response',
            importance: 0.5,
            createdAt: new Date().toISOString(),
          })
        } catch (err) {
          console.error('[AgentHookFactory] 记忆保存失败:', err)
        }
      }

      await this.executeUserHooks('on_complete', ctx, sessionId)
    })

    return hooks
  }

  /**
   * 执行用户自定义 Hook 规则
   * 在内部 Hook 逻辑执行后调用，如果用户规则返回 blocked=true 则抛出错误
   */
  async executeUserHooks(
    eventPoint: HookEventPoint,
    ctx: {
      agentID?: string
      sessionID?: string
      turn?: number
      toolCall?: { name?: string; arguments?: string | Record<string, unknown> }
      toolResult?: { content?: string; isError?: boolean }
      response?: { content?: string; usage?: Usage }
      error?: { message?: string }
    },
    sessionId: string
  ): Promise<void> {
    if (!this.hookConfigService) return
    try {
      const results = await this.hookConfigService.executeHooks({
        eventPoint,
        agentId: ctx.agentID || '',
        sessionId: ctx.sessionID || sessionId,
        turn: ctx.turn || 0,
        toolCall: ctx.toolCall ? {
          name: ctx.toolCall.name || '',
          arguments: typeof ctx.toolCall.arguments === 'string'
            ? ctx.toolCall.arguments
            : JSON.stringify(ctx.toolCall.arguments || {}),
        } : undefined,
        toolResult: ctx.toolResult ? {
          content: ctx.toolResult.content || '',
          isError: ctx.toolResult.isError || false,
        } : undefined,
        response: ctx.response ? {
          content: ctx.response.content || '',
          usage: ctx.response?.usage,
        } : undefined,
        error: ctx.error ? { message: ctx.error.message || '' } : undefined,
      })
      // 如果有规则阻止了操作，抛出错误
      for (const result of results) {
        if (result.blocked) {
          throw new Error(`操作被 Hook 规则阻止: ${result.ruleName}`)
        }
      }
    } catch (err) {
      // 如果是阻止错误，重新抛出
      if (err instanceof Error && err.message.includes('被 Hook 规则阻止')) {
        throw err
      }
      // 其他错误记录但不阻断
      console.error('[AgentHookFactory] User hook execution error:', err)
    }
  }
}
