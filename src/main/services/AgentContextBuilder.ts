// AgentContextBuilder — Agent 上下文准备逻辑
// 从 AgentService 中提取，负责执行前所有准备工作：
// 模型配置获取、安全检查、Provider 创建、提示词构建、记忆检索

import type { Provider } from '@agentprimordia/sdk'
import { CachedProvider, InMemoryCache, type LLMCache } from '@agentprimordia/sdk'
import type { Skill } from '@shared/types'
import { PromptBuilder } from './PromptBuilder'
import type { ConfigStore } from './ConfigStore'
import type { ProviderManager } from './ProviderManager'
import type { ToolManager } from './ToolManager'
import type { MemoryService } from './MemoryService'
import type { GuardrailService } from './GuardrailService'
import type { ModelRouter } from './ModelRouter'
import type { ObservabilityService } from './ObservabilityService'
import type { PromptService } from './PromptService'

// ===== 构建结果 =====
export interface AgentContext {
  modelConfig: NonNullable<ReturnType<ConfigStore['getModel']>>
  provider: Provider
  systemPrompt: string
  activeSkills: Skill[]
  sessionId: string
  permissionLevel: 'ask' | 'auto_edit' | 'plan' | 'skip'
}

// ===== 构建错误 =====
export class AgentContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentContextError'
  }
}

export class AgentContextBuilder {
  private llmCache: LLMCache | null = null
  private cacheEnabled: boolean

  constructor(
    private configStore: ConfigStore,
    private providerManager: ProviderManager,
    private observability: ObservabilityService,
    options?: { llmCache?: LLMCache; cacheEnabled?: boolean }
  ) {
    this.llmCache = options?.llmCache ?? null
    this.cacheEnabled = options?.cacheEnabled ?? true
  }

  // ===== 依赖 setter（由 AgentService 在注入服务后调用）=====
  setToolManager(tm: ToolManager | null): void { this._toolManager = tm }
  setMemoryService(ms: MemoryService | null): void { this._memoryService = ms }
  setGuardrailService(gs: GuardrailService | null): void { this._guardrailService = gs }
  setModelRouter(mr: ModelRouter | null): void { this._modelRouter = mr }
  setPromptService(ps: PromptService | null): void { this._promptService = ps }

  private _toolManager: ToolManager | null = null
  private _memoryService: MemoryService | null = null
  private _guardrailService: GuardrailService | null = null
  private _modelRouter: ModelRouter | null = null
  private _promptService: PromptService | null = null

  /**
   * 构建 Agent 运行所需的完整上下文
   * @throws AgentContextError 当模型配置不存在或安全护栏拦截时
   */
  async build(params: {
    sessionId: string
    input: string
    modelConfigId: string
    mode?: 'code' | 'office'
    permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'
    /** 预收集的技能列表（由 AgentService 提供，避免 builder 依赖 sessionStore） */
    activeSkills?: Skill[]
    /** 推荐技能列表（由 SkillRouter 匹配，供 Agent 参考） */
    recommendedSkills?: Array<{ name: string; description: string; score: number; content?: string }>
    /** 任务识别和工具推荐（由 TaskRouter + ToolRecommender 生成） */
    taskRecommendation?: string
  }): Promise<AgentContext> {
    const { sessionId, input, modelConfigId, mode = 'code', permissionLevel, activeSkills = [], recommendedSkills = [], taskRecommendation = '' } = params

    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new AgentContextError('未找到模型配置')
    }

    // Guardrail 输入安全检查
    this.checkGuardrail(input, sessionId)

    // 智能路由建议（仅记录）
    this.publishModelSuggestion(modelConfig.name, input, mode, sessionId)

    // 创建 Provider（带缓存）
    const provider = this.createProvider(modelConfig)

    const appConfig = this.configStore.getConfig()
    this._toolManager?.setSessionContext(sessionId, `Agent-${modelConfigId}`)

    // 处理 Skills
    let skillPrompt = this.buildSkillPrompt(activeSkills)

    // 追加推荐技能（如果有）— 高置信度推荐注入完整 content
    if (recommendedSkills.length > 0) {
      const highConfidenceRecs = recommendedSkills.filter(r => r.score >= 0.65 && r.content)
      const lowConfidenceRecs = recommendedSkills.filter(r => r.score < 0.65 || !r.content)

      if (highConfidenceRecs.length > 0) {
        skillPrompt += '\n\n## 推荐技能（高匹配，可直接参考内容）\n'
        for (const r of highConfidenceRecs) {
          skillPrompt += `\n### ⭐ ${r.name}（匹配度 ${Math.round(r.score * 100)}%）\n${r.description}\n\n${r.content}\n`
        }
      }

      if (lowConfidenceRecs.length > 0) {
        const recLines = lowConfidenceRecs.map(r =>
          `- 💡 ${r.name}: ${r.description}（匹配度 ${Math.round(r.score * 100)}%）`
        )
        skillPrompt += '\n\n## 推荐技能（可根据需要激活）\n' + recLines.join('\n')
      }
    }

    // 追加任务识别和工具推荐
    if (taskRecommendation) {
      skillPrompt += taskRecommendation
    }

    // 读取项目 MD 文件
    const { agentsMdContent, claudeMdContent } = await this.readProjectMdFiles(appConfig)

    // 收集 MCP 工具
    const mcpTools = this.collectMcpTools()

    // 构建系统提示词
    const basePrompt = PromptBuilder.build({
      mode: mode === 'office' ? 'office' : 'code',
      variantName: appConfig.promptVariant,
      projectPath: this._toolManager?.getRootDir?.(),
      globalMemory: appConfig.globalMemory || undefined,
      customRules: appConfig.customRules || undefined,
      skillPrompt: skillPrompt || undefined,
      mcpTools: mcpTools.length > 0 ? mcpTools : undefined,
      includeAgentsMd: appConfig.includeAgentsMd,
      includeClaudeMd: appConfig.includeClaudeMd,
      agentsMdContent: agentsMdContent || undefined,
      claudeMdContent: claudeMdContent || undefined,
      permissionLevel,
    })

    // 检索相关记忆 + 追加 Few-Shot
    const memoryContext = await this.retrieveRelevantMemories(input)
    const promptWithFewShot = this.appendFewShot(basePrompt, mode, input)
    const systemPrompt = memoryContext ? `${promptWithFewShot}\n\n${memoryContext}` : promptWithFewShot

    return {
      modelConfig,
      provider,
      systemPrompt,
      activeSkills,
      sessionId,
      permissionLevel: permissionLevel || 'ask',
    }
  }

  // ===== 私有方法 =====

  private checkGuardrail(input: string, sessionId: string): void {
    const guardrail = this._guardrailService
    if (!guardrail) return

    const report = guardrail.check(input, 'input')
    if (!report.passed) {
      const reasons = report.results.map(r => r.message).join('; ')
      this.observability.publish('guardrail.blocked', 'aela-agent', {
        sessionId, phase: 'input', action: report.action, reasons,
      })
      throw new AgentContextError(`输入被安全护栏拦截: ${reasons}`)
    }
  }

  private publishModelSuggestion(modelName: string, input: string, mode: string, sessionId: string): void {
    const router = this._modelRouter
    if (!router) return

    try {
      const taskType = mode === 'office' ? 'chat' : 'code'
      const suggestion = router.suggest(taskType, input)
      this.observability.publish('model.suggestion', 'aela-agent', {
        sessionId,
        currentModel: modelName,
        suggestedModel: suggestion.modelName,
        reason: suggestion.reason,
        strategy: suggestion.strategy,
        estimatedCost: suggestion.estimatedCost,
      })
    } catch (err) {
      console.error('[AgentContextBuilder] 模型路由建议失败:', err)
    }
  }

  private createProvider(modelConfig: NonNullable<ReturnType<ConfigStore['getModel']>>): Provider {
    try {
      let provider = this.providerManager.createProvider(modelConfig)
      if (this.cacheEnabled) {
        const cache = this.llmCache ?? new InMemoryCache()
        provider = new CachedProvider(provider, cache)
      }
      return provider
    } catch (err: unknown) {
      throw new AgentContextError(`创建 Provider 失败: ${(err as Error).message}`)
    }
  }

  private buildSkillPrompt(activeSkills: Skill[]): string {
    if (activeSkills.length === 0) return ''

    const skillPromptSections: string[] = []
    const toolManager = this._toolManager

    for (const skill of activeSkills) {
      if (skill.asTool) {
        toolManager?.registerSkillAsTool(skill)
      } else {
        skillPromptSections.push(`### Skill: ${skill.name}\n${skill.description}\n\n${skill.content}`)
      }
    }

    return skillPromptSections.length > 0
      ? skillPromptSections.join('\n\n---\n\n')
      : ''
  }

  private collectMcpTools(): Array<{ name: string; description: string }> {
    const toolManager = this._toolManager
    if (!toolManager) return []

    const mcpStatuses = toolManager.getMCPStatus() ?? []
    const mcpTools: Array<{ name: string; description: string }> = []
    for (const status of mcpStatuses) {
      if (status.connected) {
        for (const tool of status.tools) {
          mcpTools.push({ name: tool.name, description: tool.description })
        }
      }
    }
    return mcpTools
  }

  private projectMdCache: {
    workspace: string
    mtime: number
    content: { agentsMdContent: string; claudeMdContent: string }
  } | null = null

  private async readProjectMdFiles(appConfig: ReturnType<ConfigStore['getConfig']>): Promise<{
    agentsMdContent: string
    claudeMdContent: string
  }> {
    let agentsMdContent = ''
    let claudeMdContent = ''

    if (!appConfig.includeAgentsMd && !appConfig.includeClaudeMd) {
      return { agentsMdContent, claudeMdContent }
    }

    const workspace = this._toolManager?.getRootDir?.()
    if (!workspace) return { agentsMdContent, claudeMdContent }

    const fs = await import('fs/promises')
    const path = await import('path')

    let cacheValid = false
    try {
      const agentsStat = await fs.stat(path.join(workspace, 'AGENTS.md'))
      if (this.projectMdCache &&
          this.projectMdCache.workspace === workspace &&
          this.projectMdCache.mtime === agentsStat.mtimeMs) {
        cacheValid = true
      }
    } catch { /* 文件不存在 */ }

    if (cacheValid && this.projectMdCache) {
      return this.projectMdCache.content
    }

    if (appConfig.includeAgentsMd) {
      try {
        agentsMdContent = await fs.readFile(path.join(workspace, 'AGENTS.md'), 'utf-8')
      } catch { /* ignore */ }
    }

    if (appConfig.includeClaudeMd) {
      for (const f of ['CLAUDE.md', 'CLAUDE.local.md']) {
        try {
          const content = await fs.readFile(path.join(workspace, f), 'utf-8')
          claudeMdContent += (claudeMdContent ? '\n\n' : '') + `## ${f}\n${content}`
        } catch { /* ignore */ }
      }
    }

    try {
      const agentsStat = await fs.stat(path.join(workspace, 'AGENTS.md'))
      this.projectMdCache = {
        workspace,
        mtime: agentsStat.mtimeMs,
        content: { agentsMdContent, claudeMdContent },
      }
    } catch { /* 缓存建立失败 */ }

    return { agentsMdContent, claudeMdContent }
  }

  private async retrieveRelevantMemories(input: string): Promise<string | null> {
    const memory = this._memoryService
    if (!memory) return null

    try {
      const results = await memory.hybridSearchScored(input, 5)
      if (results.length === 0) return null

      const memoryLines: string[] = []
      for (const r of results) {
        const ep = r.episode
        const time = new Date(ep.createdAt).toLocaleDateString('zh-CN')
        const role = ep.role === 'user' ? '用户' : '助手'
        const content = ep.content.slice(0, 500)
        memoryLines.push(`- [${time}] ${role}: ${content}`)
      }

      return `## 相关记忆（自动检索，供参考）\n${memoryLines.join('\n')}`
    } catch (err) {
      console.error('[AgentContextBuilder] 检索记忆失败:', err)
      return null
    }
  }

  private appendFewShot(basePrompt: string, mode: 'code' | 'office', userInput: string): string {
    const promptService = this._promptService
    if (!promptService) return basePrompt

    const fewShotName = mode === 'code' ? 'aela.code' : 'aela.daily'
    try {
      const fewShotText = promptService.renderFewShot(fewShotName, userInput)
      if (fewShotText && fewShotText.includes('---')) {
        return `${basePrompt}\n${fewShotText}`
      }
    } catch (err) {
      console.error('[AgentContextBuilder] Few-Shot 渲染失败:', err)
    }
    return basePrompt
  }
}
