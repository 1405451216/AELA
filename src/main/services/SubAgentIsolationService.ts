// Sub-Agent 并行隔离服务
// 解决问题：编排有/隔离弱
// 核心能力：
//   1. 资源配额 — 每个 Sub-Agent 独立的 maxTurns/maxTokens/timeout/工具调用上限
//   2. 上下文隔离 — 每个 Agent 使用独立的 ToolManager 实例和 HookManager
//   3. 错误边界 — 单个 Agent 失败不崩溃其他 Agent
//   4. 结果聚合 — concat/best/merge/vote 四种策略

import {
  ReActAgent,
  HookManager,
  Lifecycle,
  ToolRegistry,
} from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type {
  SubAgentDefinition,
  SubAgentResult,
  SubAgentRunConfig,
  SubAgentRunResult,
  SubAgentPreset,
  SubAgentRunStatus,
  SubAgentResourceQuota,
} from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'
import type { ToolManager } from './ToolManager'
import { randomUUID } from 'crypto'

// ===== 预设角色 =====
const PRESETS: SubAgentPreset[] = [
  {
    id: 'coder',
    name: '代码编写者',
    role: 'coder',
    description: '专注于编写功能代码实现',
    systemPrompt: '你是一个资深开发者。根据任务描述编写高质量、可维护的代码。给出完整实现，包含错误处理和边界条件。',
    defaultQuota: {
      maxTurns: 20,
      maxTokens: 50000,
      timeoutMs: 120000,
      maxFileWrites: 10,
      maxShellCommands: 5,
      allowedTools: ['read_file', 'write_file', 'list_directory', 'search_code'],
    },
  },
  {
    id: 'reviewer',
    name: '代码审查者',
    role: 'reviewer',
    description: '专注于发现代码问题和安全漏洞',
    systemPrompt: '你是一个严格的代码审查员。检查代码质量、安全漏洞、性能问题和最佳实践。给出具体的改进建议。',
    defaultQuota: {
      maxTurns: 10,
      maxTokens: 30000,
      timeoutMs: 60000,
      maxFileWrites: 0,
      maxShellCommands: 0,
      allowedTools: ['read_file', 'list_directory', 'search_code'],
    },
  },
  {
    id: 'tester',
    name: '测试编写者',
    role: 'tester',
    description: '专注于生成测试用例',
    systemPrompt: '你是一个测试工程师。为给定代码编写全面的单元测试，覆盖正常路径、边界条件和错误场景。',
    defaultQuota: {
      maxTurns: 15,
      maxTokens: 40000,
      timeoutMs: 90000,
      maxFileWrites: 5,
      maxShellCommands: 3,
      allowedTools: ['read_file', 'write_file', 'search_code', 'execute_command'],
    },
  },
  {
    id: 'architect',
    name: '架构设计师',
    role: 'architect',
    description: '专注于系统设计和架构决策',
    systemPrompt: '你是一个经验丰富的系统架构师。分析需求，设计系统架构，选择技术栈，定义接口和数据模型。',
    defaultQuota: {
      maxTurns: 12,
      maxTokens: 35000,
      timeoutMs: 90000,
      maxFileWrites: 3,
      maxShellCommands: 0,
      allowedTools: ['read_file', 'write_file', 'list_directory'],
    },
  },
  {
    id: 'docwriter',
    name: '文档编写者',
    role: 'docwriter',
    description: '专注于生成技术文档和注释',
    systemPrompt: '你是一个技术文档工程师。为代码编写清晰的文档、API 说明和使用示例。',
    defaultQuota: {
      maxTurns: 8,
      maxTokens: 20000,
      timeoutMs: 60000,
      maxFileWrites: 3,
      maxShellCommands: 0,
      allowedTools: ['read_file', 'write_file', 'list_directory'],
    },
  },
]

export class SubAgentIsolationService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private toolManager: ToolManager | null

  // 活跃的运行
  private activeRuns: Map<string, {
    config: SubAgentRunConfig
    statuses: Map<string, { status: string; tokensUsed: number; turnsUsed: number }>
    lifecycles: Map<string, Lifecycle>
    abortControllers: Map<string, AbortController>
    running: boolean
  }> = new Map()

  constructor(configStore: ConfigStore, providerManager: ProviderManager, toolManager: ToolManager | null) {
    this.configStore = configStore
    this.providerManager = providerManager
    this.toolManager = toolManager
  }

setToolManager(tm: ToolManager): void {
this.toolManager = tm
}

  listPresets(): SubAgentPreset[] {
    return [...PRESETS]
  }

  /**
   * 运行并行 Sub-Agent 编排
   */
  async run(config: SubAgentRunConfig): Promise<SubAgentRunResult> {
    const runId = config.id || randomUUID()
    const startTime = Date.now()

    // 初始化运行状态
    const runState = {
      config,
      statuses: new Map<string, { status: string; tokensUsed: number; turnsUsed: number }>(),
      lifecycles: new Map<string, Lifecycle>(),
      abortControllers: new Map<string, AbortController>(),
      running: true,
    }
    for (const agent of config.agents) {
      runState.statuses.set(agent.id, { status: 'pending', tokensUsed: 0, turnsUsed: 0 })
    }
    this.activeRuns.set(runId, runState)

    try {
      // 限制并发度
      const maxConcurrency = Math.max(1, config.maxConcurrency)
      const results: SubAgentResult[] = []

      // 分批执行
      for (let i = 0; i < config.agents.length; i += maxConcurrency) {
        const batch = config.agents.slice(i, i + maxConcurrency)

        // 检查 failFast
        if (config.failFast && results.some(r => r.status === 'failed')) {
          // 取消未执行的
          for (const agent of batch) {
            runState.statuses.get(agent.id)!.status = 'failed'
            results.push({
              agentId: agent.id,
              agentName: agent.name,
              role: agent.role,
              status: 'failed',
              output: '',
              error: 'Skipped due to failFast',
              tokensUsed: 0,
              turnsUsed: 0,
              toolCalls: 0,
              durationMs: 0,
              filesWritten: [],
            })
          }
          continue
        }

        // 并行执行当前批次
        const batchResults = await Promise.allSettled(
          batch.map(agent => this.executeAgent(runId, agent))
        )

        for (let j = 0; j < batchResults.length; j++) {
          const settled = batchResults[j]
          if (settled.status === 'fulfilled') {
            results.push(settled.value)
          } else {
            // Promise.allSettled 的 reject 不应该发生（executeAgent 内部 catch 了所有错误）
            // 但作为安全兜底
            const agent = batch[j]
            results.push({
              agentId: agent.id,
              agentName: agent.name,
              role: agent.role,
              status: 'failed',
              output: '',
              error: settled.reason?.message || 'Unknown error',
              tokensUsed: 0,
              turnsUsed: 0,
              toolCalls: 0,
              durationMs: 0,
              filesWritten: [],
            })
          }
        }
      }

      // 聚合结果
      const aggregatedOutput = this.aggregateResults(results, config.aggregationMode)
      const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0)
      const success = results.every(r => r.status === 'completed')

      return {
        runId,
        results,
        aggregatedOutput,
        totalDurationMs: Date.now() - startTime,
        totalTokensUsed: totalTokens,
        success,
        aggregationMode: config.aggregationMode,
      }
    } finally {
      runState.running = false
      // 延迟清理状态（供查询）
      setTimeout(() => this.activeRuns.delete(runId), 60000)
    }
  }

  /**
   * 停止运行（业务方法）
   * 无参数调用时为生命周期停止方法：无操作
   */
  stop(runId?: string): boolean {
    if (!runId) return false // 生命周期方法：无操作
    const runState = this.activeRuns.get(runId)
    if (!runState) return false

    runState.running = false
    for (const [, lc] of runState.lifecycles) {
      lc.stop()
    }
    for (const [, ac] of runState.abortControllers) {
      ac.abort()
    }
    return true
  }

  /**
   * 获取运行状态
   */
  getStatus(runId: string): SubAgentRunStatus | null {
    const runState = this.activeRuns.get(runId)
    if (!runState) return null

    const agentStatuses = runState.config.agents.map(agent => {
      const s = runState.statuses.get(agent.id)!
      return {
        agentId: agent.id,
        agentName: agent.name,
        status: s.status as 'pending' | 'running' | 'completed' | 'failed' | 'timeout',
        tokensUsed: s.tokensUsed,
        turnsUsed: s.turnsUsed,
      }
    })

    return {
      runId,
      running: runState.running,
      totalAgents: runState.config.agents.length,
      completedAgents: agentStatuses.filter(a => a.status === 'completed').length,
      failedAgents: agentStatuses.filter(a => a.status === 'failed' || a.status === 'timeout').length,
      agentStatuses,
    }
  }

  // ===== 私有方法 =====

  /**
   * 执行单个 Agent（带完整隔离）
   */
  private async executeAgent(runId: string, agentDef: SubAgentDefinition): Promise<SubAgentResult> {
    const runState = this.activeRuns.get(runId)!
    const startTime = Date.now()
    runState.statuses.get(agentDef.id)!.status = 'running'

    // 创建独立的 AbortController
    const abortController = new AbortController()
    runState.abortControllers.set(agentDef.id, abortController)

    // 创建独立的 Lifecycle 和 HookManager（上下文隔离）
    const lifecycle = new Lifecycle()
    const hooks = new HookManager()
    runState.lifecycles.set(agentDef.id, lifecycle)

    // 创建独立的 ToolRegistry（工具隔离 — 只允许配额中声明的工具）
    const toolkit = this.createIsolatedToolkit(agentDef.quota)

    // 获取模型
    const modelConfig = this.configStore.getModel(agentDef.modelConfigId)
    if (!modelConfig) {
      runState.statuses.get(agentDef.id)!.status = 'failed'
      return {
        agentId: agentDef.id,
        agentName: agentDef.name,
        role: agentDef.role,
        status: 'failed',
        output: '',
        error: `模型未找到: ${agentDef.modelConfigId}`,
        tokensUsed: 0,
        turnsUsed: 0,
        toolCalls: 0,
        durationMs: Date.now() - startTime,
        filesWritten: [],
      }
    }

    const provider: Provider = this.providerManager.createProvider(modelConfig)

    // 创建 Agent
    const agent = new ReActAgent({
      name: agentDef.name,
      model: provider,
      toolkit,
      maxTurns: agentDef.quota.maxTurns,
      maxMessages: 100,
      systemPrompt: agentDef.systemPrompt,
      hooks,
      lifecycle,
    })

    // 资源追踪 + 配额计数器
    let tokensUsed = 0
    let turnsUsed = 0
    let toolCalls = 0
    const filesWritten: string[] = []

    const quotaTracker = {
      fileWriteCount: 0,
      shellCommandCount: 0,
    }

    const allowedToolSet = new Set(agentDef.quota.allowedTools)

    // ===== before_tool hook：运行时配额强制执行 =====
    hooks.register('before_tool', async (ctx) => {
      const toolName = (ctx as { toolCall?: { name?: string } }).toolCall?.name
      if (!toolName) return

      // 1. allowedTools 白名单检查（白名单非空时生效）
      if (allowedToolSet.size > 0 && !allowedToolSet.has(toolName)) {
        runState.statuses.get(agentDef.id)!.status = 'quota_exceeded'
        lifecycle.stop()
        abortController.abort()
        throw new Error(`配额违规：工具 "${toolName}" 不在允许列表 [${agentDef.quota.allowedTools.join(', ')}] 中`)
      }

      // 2. maxFileWrites 检查
      if (toolName === 'write_file') {
        if (quotaTracker.fileWriteCount >= agentDef.quota.maxFileWrites) {
          runState.statuses.get(agentDef.id)!.status = 'quota_exceeded'
          lifecycle.stop()
          abortController.abort()
          throw new Error(`配额违规：文件写入次数已达上限 (${agentDef.quota.maxFileWrites})`)
        }
      }

      // 3. maxShellCommands 检查
      if (toolName === 'execute_command') {
        if (quotaTracker.shellCommandCount >= agentDef.quota.maxShellCommands) {
          runState.statuses.get(agentDef.id)!.status = 'quota_exceeded'
          lifecycle.stop()
          abortController.abort()
          throw new Error(`配额违规：Shell 命令次数已达上限 (${agentDef.quota.maxShellCommands})`)
        }
      }
    })

    // ===== after_llm hook：token / turns 追踪 =====
    hooks.register('after_llm', async (ctx) => {
      const usage = (ctx as { response?: { usage?: { totalTokens?: number } } }).response?.usage
      if (usage?.totalTokens) {
        tokensUsed += usage.totalTokens
      }
      turnsUsed++
      runState.statuses.get(agentDef.id)!.tokensUsed = tokensUsed
      runState.statuses.get(agentDef.id)!.turnsUsed = turnsUsed

      // 配额检查 — token 超限
      if (tokensUsed > agentDef.quota.maxTokens) {
        runState.statuses.get(agentDef.id)!.status = 'quota_exceeded'
        lifecycle.stop()
        abortController.abort()
      }

      // 配额检查 — turns 超限
      if (turnsUsed > agentDef.quota.maxTurns) {
        runState.statuses.get(agentDef.id)!.status = 'quota_exceeded'
        lifecycle.stop()
        abortController.abort()
      }
    })

    // ===== after_tool hook：计数器递增 =====
    hooks.register('after_tool', async (ctx) => {
      toolCalls++
      const toolName = (ctx as { toolCall?: { name?: string } }).toolCall?.name

      // 递增文件写入计数
      if (toolName === 'write_file') {
        quotaTracker.fileWriteCount++
        filesWritten.push('write_file')
      }

      // 递增 Shell 命令计数
      if (toolName === 'execute_command') {
        quotaTracker.shellCommandCount++
      }
    })

    try {
      // 超时控制
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          runState.statuses.get(agentDef.id)!.status = 'timeout'
          abortController.abort()
          reject(new Error('Agent execution timed out'))
        }, agentDef.quota.timeoutMs)
        // 如果 abort 了也清理 timer
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timer)
        })
      })

      // 执行 Agent
      const runPromise = (async () => {
        let content = ''
        for await (const event of agent.streamEvents(agentDef.input)) {
          if (abortController.signal.aborted) break
          if (event.type === 'token') {
            content += event.content
          }
        }
        return content
      })()

      const content = await Promise.race([runPromise, timeoutPromise])

      runState.statuses.get(agentDef.id)!.status = 'completed'
      return {
        agentId: agentDef.id,
        agentName: agentDef.name,
        role: agentDef.role,
        status: 'completed',
        output: content,
        tokensUsed,
        turnsUsed,
        toolCalls,
        durationMs: Date.now() - startTime,
        filesWritten,
      }
    } catch (err: unknown) {
      const currentStatus = runState.statuses.get(agentDef.id)!.status
      const status: SubAgentResult['status'] =
        currentStatus === 'quota_exceeded' ? 'quota_exceeded' :
        currentStatus === 'timeout' ? 'timeout' :
        'failed'

      runState.statuses.get(agentDef.id)!.status = status
      return {
        agentId: agentDef.id,
        agentName: agentDef.name,
        role: agentDef.role,
        status,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        tokensUsed,
        turnsUsed,
        toolCalls,
        durationMs: Date.now() - startTime,
        filesWritten,
      }
    } finally {
      runState.abortControllers.delete(agentDef.id)
      runState.lifecycles.delete(agentDef.id)
    }
  }

  /**
   * 创建隔离的 ToolRegistry（只包含配额允许的工具）
   */
  private createIsolatedToolkit(quota: SubAgentResourceQuota): ToolRegistry {
    const toolkit = new ToolRegistry()

    // 如果没有 ToolManager，返回空 toolkit
    if (!this.toolManager) return toolkit

    // 获取所有内置工具
    const allTools = this.toolManager.listBuiltinTools()
    const allowedSet = new Set(quota.allowedTools)

    for (const toolInfo of allTools) {
      // 检查工具是否在白名单中
      if (allowedSet.size > 0 && !allowedSet.has(toolInfo.name)) continue

      // 根据配额限制工具
      if (toolInfo.name === 'write_file' && quota.maxFileWrites === 0) continue
      if (toolInfo.name === 'execute_command' && quota.maxShellCommands === 0) continue

      // 获取实际工具实例并注册
      const tool = this.toolManager.getRegistry().get(toolInfo.name)
      if (tool) {
        toolkit.register(tool)
      }
    }

    return toolkit
  }

  /**
   * 聚合多个 Agent 的结果
   */
  private aggregateResults(results: SubAgentResult[], mode: string): string {
    const successful = results.filter(r => r.status === 'completed')

    if (successful.length === 0) {
      return '所有 Agent 均失败。错误详情:\n' + results.map(r => `- ${r.agentName}: ${r.error}`).join('\n')
    }

    switch (mode) {
      case 'concat':
        // 拼接所有结果
        return successful.map(r =>
          `## ${r.agentName} (${r.role})\n\n${r.output}`
        ).join('\n\n---\n\n')

      case 'best': {
        // 选择 token 使用最多（通常意味着更详细的）结果
        const best = successful.reduce((a, b) => a.tokensUsed > b.tokensUsed ? a : b)
        return `**最佳结果（来自 ${best.agentName}）**\n\n${best.output}`
      }

      case 'merge': {
        // 合并结果，按角色分类
        const byRole: Record<string, SubAgentResult[]> = {}
        for (const r of successful) {
          if (!byRole[r.role]) byRole[r.role] = []
          byRole[r.role].push(r)
        }
        const sections: string[] = []
        for (const [role, roleResults] of Object.entries(byRole)) {
          const outputs = roleResults.map(r => r.output).join('\n\n')
          sections.push(`### ${role}\n\n${outputs}`)
        }
        return sections.join('\n\n---\n\n')
      }

      case 'vote': {
        // 投票模式：选择被最多 Agent 支持的结果
        // 简化实现：如果多个 Agent 输出相似，选第一个
        if (successful.length === 1) return successful[0].output
        // 按输出长度排序，选中等长度的（避免过短或过长）
        const sorted = [...successful].sort((a, b) => a.output.length - b.output.length)
        const midIndex = Math.floor(sorted.length / 2)
        return `**投票结果（来自 ${sorted[midIndex].agentName}）**\n\n${sorted[midIndex].output}`
      }

      default:
        return successful.map(r => r.output).join('\n\n')
    }
  }
}
