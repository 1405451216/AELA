// Builtin tools: Agent 高级能力工具（TestGen / CodeReview / Wiki / SubAgent / ImageToCode / ScreenshotAnalysis / Planning / RAG）
// 将 8 个独立服务注册为 Agent 可自主调用的工具
// Agent 在对话中根据场景自动选择调用，无需用户手动操作面板

import type { Tool } from '@agentprimordia/sdk'
import type { TestGenService } from '../../TestGenService'
import type { CodeReviewService } from '../../CodeReviewService'
import type { RepoWikiService } from '../../RepoWikiService'
import type { SubAgentIsolationService } from '../../SubAgentIsolationService'
import type { ImageToCodeService } from '../../ImageToCodeService'
import type { ScreenshotAnalysisService } from '../../ScreenshotAnalysisService'
import type { PlanningService } from '../../PlanningService'
import type { RAGService } from '../../RAGService'

/** 获取默认模型配置 ID 的函数类型 */
export type GetDefaultModelId = () => string

/** LLM 调用函数类型 */
export type LlmCallFn = (prompt: string, modelConfigId: string) => Promise<string>

/** Agent 工具所需的服务上下文 */
export interface AgentToolContext {
  getDefaultModelId: GetDefaultModelId
  llmCall?: LlmCallFn
  rootDir: string
  testGenService?: TestGenService
  codeReviewService?: CodeReviewService
  repoWikiService?: RepoWikiService
  subAgentService?: SubAgentIsolationService
  imageToCodeService?: ImageToCodeService
  screenshotService?: ScreenshotAnalysisService
  planningService?: PlanningService
  ragService?: RAGService
}

// ===== 1. 自动测试生成工具 =====
export class GenerateTestTool implements Tool {
  name = 'generate_test'
  description = '为指定的源代码文件自动生成单元测试。分析文件中的函数和类，使用 LLM 生成测试代码，支持 TypeScript/JavaScript/Python。'
  parameters = {
    type: 'object' as const,
    properties: {
      filePath: { type: 'string', description: '要生成测试的源文件路径（相对于工作区根目录）' },
      write: { type: 'boolean', description: '是否将测试文件写入磁盘（默认 false，仅返回内容）' },
    },
    required: ['filePath'],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { filePath: string; write?: boolean }): Promise<string> {
    if (!this.ctx.testGenService) {
      return '[generate_test] 服务不可用'
    }
    const modelConfigId = this.ctx.getDefaultModelId()
    if (!modelConfigId) {
      return '[generate_test] 未配置模型，无法生成测试'
    }

    // 重建带 LLM 回调的 service（与 IPC handler 相同的模式）
    const { TestGenService: TGS } = await import('../../TestGenService')
    const service = this.ctx.llmCall
      ? new TGS(this.ctx.rootDir, this.ctx.llmCall)
      : this.ctx.testGenService

    const result = await service.generate(args.filePath, modelConfigId)

    if (args.write) {
      await service.writeTestFile?.(result.testFilePath, result.testContent)
    }

    const lines: string[] = [
      `测试文件: ${result.testFilePath}`,
      `测试框架: ${result.framework}`,
      `覆盖目标: ${result.coverageTargets.join(', ') || '(无)'}`,
      '',
      '--- 测试代码 ---',
      result.testContent,
    ]
    return lines.join('\n')
  }
}

// ===== 2. 代码审查工具 =====
export class ReviewCodeTool implements Tool {
  name = 'review_code'
  description = '对指定的源代码文件进行自动化代码审查。结合 16 条静态规则（安全/性能/风格/Bug）和 LLM 增强 review，生成结构化审查报告含评分和建议。'
  parameters = {
    type: 'object' as const,
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: '要审查的文件路径列表（相对于工作区根目录）',
      },
    },
    required: ['files'],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { files: string[] }): Promise<string> {
    if (!this.ctx.codeReviewService) {
      return '[review_code] 服务不可用'
    }
    const modelConfigId = this.ctx.getDefaultModelId()
    if (!modelConfigId) {
      return '[review_code] 未配置模型，无法进行 LLM 审查'
    }

    // 重建带 LLM 回调的 service
    const { CodeReviewService: CRS } = await import('../../CodeReviewService')
    const service = this.ctx.llmCall
      ? new CRS(this.ctx.rootDir, this.ctx.llmCall)
      : this.ctx.codeReviewService

    const result = await service.review(args.files, modelConfigId)

    const lines: string[] = [
      `代码审查报告`,
      `评分: ${result.score}/100`,
      `是否通过: ${result.approved ? '✓ 是' : '✕ 否'}`,
      '',
      result.summary,
      '',
      '--- 问题详情 ---',
    ]

    if (result.issues.length === 0) {
      lines.push('未发现问题')
    } else {
      for (const issue of result.issues) {
        lines.push(
          `[${issue.severity.toUpperCase()}] ${issue.filePath}:${issue.lineStart} ` +
          `(${issue.category}) ${issue.message}` +
          (issue.suggestion ? `\n  建议: ${issue.suggestion}` : '')
        )
      }
    }

    return lines.join('\n')
  }
}

// ===== 3. 仓库 Wiki 生成工具 =====
export class GenerateWikiTool implements Tool {
  name = 'generate_wiki'
  description = '扫描代码仓库结构，自动生成项目文档 Wiki。包括项目概览、目录结构、技术栈分析、核心模块说明等章节。'
  parameters = {
    type: 'object' as const,
    properties: {
      workspaceId: { type: 'string', description: '工作区 ID（可选，默认使用当前工作区）' },
    },
    required: [],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { workspaceId?: string }): Promise<string> {
    if (!this.ctx.repoWikiService) {
      return '[generate_wiki] 服务不可用'
    }
    const modelConfigId = this.ctx.getDefaultModelId()
    if (!modelConfigId) {
      return '[generate_wiki] 未配置模型，无法生成 Wiki'
    }

    // 重建带 LLM 回调的 service
    const { RepoWikiService: RWS } = await import('../../RepoWikiService')
    const service = this.ctx.llmCall
      ? new RWS(this.ctx.rootDir, this.ctx.llmCall)
      : this.ctx.repoWikiService

    const wsId = args.workspaceId || 'default'
    const doc = await service.generate(wsId, modelConfigId)

    const lines: string[] = [
      `# ${doc.title}`,
      `文件数: ${doc.fileCount} · 生成时间: ${new Date(doc.generatedAt).toLocaleString()}`,
      '',
      doc.markdown,
    ]
    return lines.join('\n')
  }
}

// ===== 4. Sub-Agent 隔离执行工具 =====
export class SpawnSubAgentTool implements Tool {
  name = 'spawn_subagent'
  description = '在隔离环境中启动一个子 Agent 执行任务。子 Agent 拥有独立的资源配额（maxTurns/timeout/工具权限），适用于执行有风险或需要隔离的任务。'
  parameters = {
    type: 'object' as const,
    properties: {
      task: { type: 'string', description: '子 Agent 要执行的任务描述' },
      role: {
        type: 'string',
        description: '子 Agent 角色预设: coder(编码) / reviewer(审查) / tester(测试) / architect(架构)',
      },
      systemPrompt: { type: 'string', description: '自定义系统提示词（可选，覆盖角色预设）' },
    },
    required: ['task'],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { task: string; role?: string; systemPrompt?: string }): Promise<string> {
    if (!this.ctx.subAgentService) {
      return '[spawn_subagent] 服务不可用'
    }
    const modelConfigId = this.ctx.getDefaultModelId()
    if (!modelConfigId) {
      return '[spawn_subagent] 未配置模型'
    }

    const service = this.ctx.subAgentService

    // 根据角色选择预设
    const presets = service.listPresets()
    const role = args.role || 'coder'
    const preset = presets.find(p => p.id === role) || presets[0]

    const config = {
      id: '',
      agents: [{
        id: `subagent-${Date.now()}`,
        name: preset?.name || role,
        role: preset?.role || role,
        systemPrompt: args.systemPrompt || preset?.systemPrompt || '你是一个有用的助手。',
        modelConfigId,
        input: args.task,
        quota: preset?.defaultQuota || {
          maxTurns: 20,
          maxTokens: 50000,
          timeoutMs: 120000,
          maxFileWrites: 10,
          maxShellCommands: 5,
          allowedTools: [],
        },
      }],
      aggregationMode: 'concat' as const,
      failFast: true,
      maxConcurrency: 1,
    }

    try {
      const result = await service.run(config)
      if (result.success) {
        return `子 Agent 执行成功 (耗时 ${result.totalDurationMs}ms)\n\n${result.aggregatedOutput || '(无输出)'}`
      } else {
        return `子 Agent 执行失败\n${result.aggregatedOutput || ''}`
      }
    } catch (err) {
      return `[spawn_subagent] 执行异常: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

// ===== 5. 图片转代码工具 =====
export class ImageToCodeTool implements Tool {
  name = 'image_to_code'
  description = '将 UI 截图转换为前端代码。分析截图中的 UI 结构、组件、颜色、布局，生成对应框架的代码（React/Vue/HTML/Tailwind/Svelte/Angular）。'
  parameters = {
    type: 'object' as const,
    properties: {
      imagePath: { type: 'string', description: '截图文件路径（相对于工作区根目录或绝对路径）' },
      framework: {
        type: 'string',
        description: '目标框架: react / vue / html / tailwind / svelte / angular（默认 react）',
      },
      instruction: { type: 'string', description: '额外指令（可选，如 "使用深色主题"）' },
    },
    required: ['imagePath'],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { imagePath: string; framework?: string; instruction?: string }): Promise<string> {
    if (!this.ctx.imageToCodeService) {
      return '[image_to_code] 服务不可用'
    }
    const modelConfigId = this.ctx.getDefaultModelId()
    if (!modelConfigId) {
      return '[image_to_code] 未配置模型'
    }

    const service = this.ctx.imageToCodeService

    try {
      // Step 1: 分析图片
      const analysis = await service.analyze(args.imagePath, modelConfigId)

      // Step 2: 生成代码
      const framework = (args.framework || 'react') as 'react'
      const request = {
        imagePath: args.imagePath,
        framework,
        modelConfigId,
        customPrompt: args.instruction,
      }
      const result = await service.generate(request)

      const lines: string[] = [
        '图片转代码结果',
        `框架: ${args.framework || 'react'}`,
        `UI 描述: ${analysis.description}`,
        `布局: ${analysis.layout}`,
        `组件: ${analysis.components.map(c => c.type).join(', ')}`,
        '',
        '--- 生成的代码 ---',
      ]

      for (const file of result.files) {
        lines.push(`// ${file.fileName}`)
        lines.push(file.content)
        lines.push('')
      }

      return lines.join('\n')
    } catch (err) {
      return `[image_to_code] 执行失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

// ===== 7. 任务规划工具 =====
export class PlanTaskTool implements Tool {
  name = 'plan_task'
  description = '将复杂任务分解为结构化的子任务列表，含依赖关系和执行顺序。适用于多步骤复杂任务：重构、迁移、功能开发等。返回可执行的分步计划。'
  parameters = {
    type: 'object' as const,
    properties: {
      task: { type: 'string', description: '要分解的复杂任务描述' },
      mode: {
        type: 'string',
        description: "分解模式: 'decompose' 仅分解子任务 | 'plan' 生成含依赖关系的完整计划（默认 plan）",
      },
    },
    required: ['task'],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { task: string; mode?: string }): Promise<string> {
    if (!this.ctx.planningService) {
      return '[plan_task] 服务不可用'
    }
    const modelConfigId = this.ctx.getDefaultModelId()
    if (!modelConfigId) {
      return '[plan_task] 未配置模型'
    }

    const service = this.ctx.planningService
    const mode = args.mode || 'plan'

    try {
      if (mode === 'decompose') {
        const subtasks = await service.decompose(args.task, modelConfigId)
        const lines: string[] = [
          `任务分解结果 (${subtasks.length} 个子任务)`,
          `目标: ${args.task}`,
          '',
        ]
        for (const st of subtasks) {
          const deps = st.dependsOn.length > 0 ? ` [依赖: ${st.dependsOn.join(', ')}]` : ''
          lines.push(`${st.id}. ${st.description}${deps}`)
        }
        return lines.join('\n')
      } else {
        const plan = await service.generatePlan(args.task, modelConfigId)
        const lines: string[] = [
          `执行计划`,
          `目标: ${plan.goal}`,
          `子任务数: ${plan.subtasks.length}`,
          '',
          '--- 子任务详情 ---',
        ]
        for (const st of plan.subtasks) {
          const deps = st.dependsOn.length > 0 ? ` [依赖: ${st.dependsOn.join(', ')}]` : ''
          const status = st.status !== 'pending' ? ` (${st.status})` : ''
          lines.push(`${st.id}. ${st.description}${deps}${status}`)
        }
        return lines.join('\n')
      }
    } catch (err) {
      return `[plan_task] 执行失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

// ===== 8. RAG 文档搜索工具 =====
export class RagSearchTool implements Tool {
  name = 'rag_search'
  description = '在已索引的文档库中进行混合搜索（全文搜索 + 向量搜索 + RRF 融合 + MMR 重排序）。适用于查找项目文档、技术资料、API 文档等。'
  parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: '搜索查询语句' },
      topK: { type: 'number', description: '返回结果数量（默认 5）' },
    },
    required: ['query'],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { query: string; topK?: number }): Promise<string> {
    if (!this.ctx.ragService) {
      return '[rag_search] 服务不可用'
    }

    const service = this.ctx.ragService
    const stats = service.stats()

    if (stats.documents === 0) {
      return '[rag_search] 文档库为空，请先通过设置页面索引文档'
    }

    try {
      const results = await service.search(args.query, args.topK || 5)

      if (results.length === 0) {
        return `未找到与 "${args.query}" 相关的文档`
      }

      const lines: string[] = [
        `RAG 搜索结果 (${results.length} 条，文档库: ${stats.documents} 文档 / ${stats.chunks} 块)`,
        '',
      ]

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        const source = r.metadata?.source ?? 'unknown'
        lines.push(`[ ${i + 1} ] 相关度: ${r.score.toFixed(2)} | 来源: ${source}`)
        lines.push(r.content)
        lines.push('')
      }

      return lines.join('\n')
    } catch (err) {
      return `[rag_search] 执行失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

// ===== 6. 截图分析工具 =====
export class AnalyzeScreenshotTool implements Tool {
  name = 'analyze_screenshot'
  description = '分析截图内容，特别擅长诊断错误截图。识别错误类别（运行时/编译/网络/UI渲染等）、严重程度、提取错误文本、给出诊断分析和修复建议。'
  parameters = {
    type: 'object' as const,
    properties: {
      imagePath: { type: 'string', description: '截图文件路径（相对于工作区根目录或绝对路径）' },
      context: { type: 'string', description: '附加上下文信息（可选，如 "运行 npm start 后出现的错误"）' },
    },
    required: ['imagePath'],
  }

  constructor(private ctx: AgentToolContext) {}

  async execute(args: { imagePath: string; context?: string }): Promise<string> {
    if (!this.ctx.screenshotService) {
      return '[analyze_screenshot] 服务不可用'
    }
    const modelConfigId = this.ctx.getDefaultModelId()
    if (!modelConfigId) {
      return '[analyze_screenshot] 未配置模型'
    }

    const service = this.ctx.screenshotService

    try {
      const result = await service.analyze({
        imagePath: args.imagePath,
        modelConfigId,
        context: args.context,
      })

      const lines: string[] = [
        '截图分析结果',
        `错误类别: ${result.category}`,
        `严重程度: ${result.severity}`,
        `错误标题: ${result.errorTitle}`,
        '',
        '--- 错误文本 ---',
        result.errorText,
        '',
        '--- 诊断分析 ---',
        result.diagnosis,
        '',
        '--- 可能原因 ---',
        ...result.possibleCauses.map((c, i) => `${i + 1}. ${c}`),
        '',
        '--- 修复建议 ---',
      ]

      for (const fix of result.fixSuggestions) {
        lines.push(`• ${fix.title} (置信度: ${(fix.confidence * 100).toFixed(0)}%)`)
        lines.push(`  ${fix.description}`)
        if (fix.codeSnippet) {
          lines.push(`  代码: ${fix.codeSnippet}`)
        }
      }

      return lines.join('\n')
    } catch (err) {
      return `[analyze_screenshot] 执行失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
