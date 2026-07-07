// 用户 Hooks 配置服务
// 管理用户自定义 Hook 规则，在 Agent 生命周期的 10 个 Hook 点执行
// 支持 shell / block / modify_input / notify 四种动作类型

import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import type { HookRule, HookExecutionContext, HookExecutionResult, HookEventPoint, HookConfigSummary } from '@shared/types'
import { assessCommandRisk } from './tools/shellRisk'

export class HookConfigService {
  private rules: HookRule[] = []
  private recentExecutions: HookExecutionResult[] = []
  private maxRecentExecutions = 50
  private configPath: string

  constructor() {
    this.configPath = join(homedir(), '.aela', 'hooks.json')
  }

  /**
   * 从磁盘加载 Hook 规则
   */
  async load(): Promise<void> {
    try {
      const data = await readFile(this.configPath, 'utf-8')
      this.rules = JSON.parse(data)
    } catch (err) {
      // 文件不存在或解析失败 → 使用空规则
      console.error('[HookConfigService] 加载配置失败:', err)
      this.rules = []
    }
  }

  /**
   * 保存 Hook 规则到磁盘
   */
  async save(): Promise<void> {
    try {
      await mkdir(dirname(this.configPath), { recursive: true })
      await writeFile(this.configPath, JSON.stringify(this.rules, null, 2), 'utf-8')
    } catch (err) {
      console.error('[HookConfigService] Failed to save hooks:', err)
    }
  }

  /**
   * 列出所有 Hook 规则
   */
  list(): HookRule[] {
    return [...this.rules]
  }

  /**
   * 添加 Hook 规则
   */
  async add(rule: Omit<HookRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<HookRule> {
    const now = new Date().toISOString()
    const newRule: HookRule = {
      ...rule,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    this.rules.push(newRule)
    await this.save()
    return newRule
  }

  /**
   * 更新 Hook 规则
   */
  async update(id: string, partial: Partial<HookRule>): Promise<HookRule | undefined> {
    const idx = this.rules.findIndex(r => r.id === id)
    if (idx === -1) return undefined
    this.rules[idx] = {
      ...this.rules[idx],
      ...partial,
      id, // 不允许修改 ID
      updatedAt: new Date().toISOString(),
    }
    await this.save()
    return this.rules[idx]
  }

  /**
   * 删除 Hook 规则
   */
  async delete(id: string): Promise<boolean> {
    const before = this.rules.length
    this.rules = this.rules.filter(r => r.id !== id)
    if (this.rules.length < before) {
      await this.save()
      return true
    }
    return false
  }

  /**
   * 启用/禁用 Hook 规则
   */
  async toggle(id: string): Promise<HookRule | undefined> {
    const rule = this.rules.find(r => r.id === id)
    if (!rule) return undefined
    rule.enabled = !rule.enabled
    rule.updatedAt = new Date().toISOString()
    await this.save()
    return rule
  }

  /**
   * 获取所有 Hook 点的描述
   */
  getHookPoints(): Array<{ point: HookEventPoint; label: string; description: string }> {
    return [
      { point: 'before_run', label: '运行前', description: 'Agent 开始执行前触发' },
      { point: 'after_run', label: '运行后', description: 'Agent 执行完成后触发' },
      { point: 'before_turn', label: '轮次前', description: '每轮 ReAct 循环开始前触发' },
      { point: 'after_turn', label: '轮次后', description: '每轮 ReAct 循环结束后触发' },
      { point: 'before_llm', label: 'LLM 调用前', description: '调用 LLM API 前触发' },
      { point: 'after_llm', label: 'LLM 调用后', description: 'LLM API 返回后触发' },
      { point: 'before_tool', label: '工具调用前', description: '工具执行前触发（可阻止执行）' },
      { point: 'after_tool', label: '工具调用后', description: '工具执行完成后触发' },
      { point: 'on_error', label: '错误时', description: 'Agent 发生错误时触发' },
      { point: 'on_complete', label: '完成时', description: 'Agent 任务完成时触发' },
    ]
  }

  /**
   * 条件匹配 — 简单表达式求值
   * 支持: "toolName == 'execute_command'", "true", "" (空 = 总是匹配)
   */
  private matchCondition(condition: string, ctx: HookExecutionContext): boolean {
    if (!condition || condition.trim() === '' || condition.trim() === 'true') {
      return true
    }

    try {
      // 构建上下文变量
      const toolName = ctx.toolCall?.name || ''
      const toolResultContent = ctx.toolResult?.content || ''
      const isError = ctx.toolResult?.isError || false
      const errorMessage = ctx.error?.message || ''
      const eventPoint = ctx.eventPoint

      // 简单的 == 表达式匹配
      const match = condition.match(/^(\w+)\s*==\s*['"](.+)['"]$/)
      if (match) {
        const [, varName, expectedValue] = match
        const actualValue = (() => {
          switch (varName) {
            case 'toolName': return toolName
            case 'eventPoint': return eventPoint
            case 'isError': return String(isError)
            default: return ''
          }
        })()
        return actualValue === expectedValue
      }

      // 包含匹配: "toolName contains 'shell'"
      const containsMatch = condition.match(/^(\w+)\s+contains\s+['"](.+)['"]$/)
      if (containsMatch) {
        const [, varName, searchValue] = containsMatch
        const actualValue = (() => {
          switch (varName) {
            case 'toolName': return toolName
            case 'toolResult': return toolResultContent
            case 'errorMessage': return errorMessage
            default: return ''
          }
        })()
        return actualValue.includes(searchValue)
      }

      return false
    } catch (err) {
      console.error('[HookConfigService] evaluateCondition 失败:', err)
      return false
    }
  }

  /**
   * 执行单个 Hook 规则
   */
  private async executeRule(rule: HookRule, ctx: HookExecutionContext): Promise<HookExecutionResult> {
    const startTime = Date.now()
    const result: HookExecutionResult = {
      ruleId: rule.id,
      ruleName: rule.name,
      executed: false,
      blocked: false,
      output: '',
      durationMs: 0,
    }

    if (!rule.enabled) {
      result.durationMs = Date.now() - startTime
      return result
    }

    if (!this.matchCondition(rule.condition, ctx)) {
      result.durationMs = Date.now() - startTime
      return result
    }

    result.executed = true

    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'shell': {
            // 执行 shell 命令
            const output = await this.executeShell(action.command || '', ctx)
            result.output += output
            break
          }
          case 'block': {
            // 阻止当前操作
            result.blocked = true
            result.output += `[BLOCKED] ${action.message || '操作被 Hook 规则阻止'}\n`
            break
          }
          case 'modify_input': {
            // 修改输入
            result.modifiedInput = action.modifyInput || ''
            result.output += `[MODIFIED] 输入已被修改\n`
            break
          }
          case 'notify': {
            // 通知（记录到输出）
            result.output += `[NOTIFY] ${action.message || ''}\n`
            break
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        result.error = errMsg
        result.output += `[ERROR] ${errMsg}\n`
      }
    }

    result.durationMs = Date.now() - startTime

    // 记录到最近执行历史
    this.recentExecutions.unshift(result)
    if (this.recentExecutions.length > this.maxRecentExecutions) {
      this.recentExecutions = this.recentExecutions.slice(0, this.maxRecentExecutions)
    }

    return result
  }

  /**
   * 执行 shell 命令
   */
  private executeShell(command: string, ctx: HookExecutionContext): Promise<string> {
    // 安全检查：阻止危险命令通过 Hook 自动执行
    const assessment = assessCommandRisk(command)
    if (assessment.risk === 'dangerous') {
      return Promise.resolve(`[安全拦截] Hook shell 命令被阻止执行。\n命令: ${command}\n风险: ${assessment.reasons.join('; ')}`)
    }

    return new Promise((resolve) => {
      const env = {
        ...process.env,
        AELA_HOOK_EVENT: ctx.eventPoint,
        AELA_HOOK_AGENT: ctx.agentId,
        AELA_HOOK_SESSION: ctx.sessionId,
        AELA_HOOK_TURN: String(ctx.turn),
        AELA_HOOK_TOOL: ctx.toolCall?.name || '',
      }

      const child = spawn(command, {
        shell: true,
        env,
        timeout: 30000, // 30 秒超时
      })

      let output = ''
      child.stdout?.on('data', (data: Buffer) => {
        output += data.toString('utf-8')
      })
      child.stderr?.on('data', (data: Buffer) => {
        output += data.toString('utf-8')
      })
      child.on('close', () => {
        resolve(output)
      })
      child.on('error', (err) => {
        resolve(`[shell error] ${err.message}`)
      })
    })
  }

  /**
   * 执行所有匹配的 Hook 规则
   * 返回执行结果数组，调用方（AgentService）可根据结果决定是否阻止操作
   */
  async executeHooks(ctx: HookExecutionContext): Promise<HookExecutionResult[]> {
    const matchingRules = this.rules.filter(r => r.enabled)
    if (matchingRules.length === 0) return []

    const results: HookExecutionResult[] = []
    for (const rule of matchingRules) {
      const result = await this.executeRule(rule, ctx)
      if (result.executed) {
        results.push(result)
      }
    }
    return results
  }

  /**
   * 测试执行单个规则（不实际触发副作用）
   */
  async testRule(rule: HookRule, ctx: HookExecutionContext): Promise<HookExecutionResult> {
    return this.executeRule(rule, ctx)
  }

  /**
   * 获取 Hook 配置摘要
   */
  getSummary(): HookConfigSummary {
    const rulesByEvent = {} as Record<HookEventPoint, number>
    const points: HookEventPoint[] = [
      'before_run', 'after_run', 'before_turn', 'after_turn',
      'before_llm', 'after_llm', 'before_tool', 'after_tool',
      'on_error', 'on_complete',
    ]
    for (const point of points) {
      rulesByEvent[point] = this.rules.filter(r => r.enabled && r.eventPoint === point).length
    }

    return {
      totalRules: this.rules.length,
      enabledRules: this.rules.filter(r => r.enabled).length,
      rulesByEvent,
      recentExecutions: [...this.recentExecutions],
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
