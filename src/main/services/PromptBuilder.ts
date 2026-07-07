// AELA 提示词构建服务
// 参考 CodeCast prompt_builder.go 的架构：
// - 三层提示词：共享基础层 + 模式专属层 + 变体层
// - 动态注入：项目信息 / 自定义指令 / 技能 / 工具目录 / 记忆 / 规则
// - 变体系统：default / concise / safety-first

import {
  promptBase,
  promptCodingDefault,
  promptDailyDefault,
  promptCodingConcise,
  promptDailyConcise,
  promptCodingSafetyFirst,
  promptDailySafetyFirst,
  promptCodeReviewer,
  promptDailyCodeReviewer,
  promptCodingPairProgrammer,
  promptDailyPairProgrammer,
  promptCodingMentorCoach,
  promptDailyMentorCoach,
} from './promptContents'

// ===== 变体定义 =====

export interface PromptVariant {
  name: string
  description: string
  coding: string
  daily: string
}

export interface VariantInfo {
  name: string
  description: string
}

// ===== 变体注册表 =====

const builtinVariants: PromptVariant[] = [
  {
    name: 'default',
    description: '平衡版本：完整工具指南 + 质量标准 + 自检 + No TODO',
    coding: promptCodingDefault,
    daily: promptDailyDefault,
  },
  {
    name: 'concise',
    description: '极简版本：节省 token，适合小模型或长任务',
    coding: promptCodingConcise,
    daily: promptDailyConcise,
  },
  {
    name: 'safety-first',
    description: '安全优先：强制验证步骤 + 保守变更 + 风险评估',
    coding: promptCodingSafetyFirst,
    daily: promptDailySafetyFirst,
  },
  {
    name: 'code-reviewer',
    description: '代码审查：分级问题反馈（Blocker/Major/Minor）+ 修复建议',
    coding: promptCodeReviewer,
    daily: promptDailyCodeReviewer,
  },
  {
    name: 'pair-programmer',
    description: '结对编程：边做边讲 + 小步推进 + 关键决策征求意见',
    coding: promptCodingPairProgrammer,
    daily: promptDailyPairProgrammer,
  },
  {
    name: 'mentor-coach',
    description: '导师教练：因材施教 + 建设性反馈 + 教学优先',
    coding: promptCodingMentorCoach,
    daily: promptDailyMentorCoach,
  },
]

const variantRegistry = new Map<string, PromptVariant>()
for (const v of builtinVariants) {
  variantRegistry.set(v.name, v)
}

// ===== 工具目录项 =====

interface ToolCatalogItem {
  name: string
  description: string
  category: string
}

// 工具类别中文名
const categoryNames: Record<string, string> = {
  filesystem: '文件系统',
  shell: '命令执行',
  web: '网络请求',
  data: '数据加载',
  utility: '实用工具',
  agent: 'Agent 能力',
}

// 内置工具目录（与 ToolManager.registerBuiltinTools 对应）
const builtinToolCatalog: ToolCatalogItem[] = [
  { name: 'read_file', description: '读取指定路径的文件内容', category: 'filesystem' },
  { name: 'write_file', description: '写入内容到指定文件（全量覆写）', category: 'filesystem' },
  { name: 'list_directory', description: '列出目录下的文件和子目录', category: 'filesystem' },
  { name: 'search_code', description: '在工作区中搜索代码内容（支持正则）', category: 'filesystem' },
  { name: 'get_project_structure', description: '获取项目目录结构树', category: 'filesystem' },
  { name: 'execute_command', description: '执行 Shell 命令（安全分级，危险命令需确认）', category: 'shell' },
  { name: 'http_fetch', description: '发起 HTTP/HTTPS 请求', category: 'web' },
  { name: 'load_csv', description: '加载 CSV 文件并解析为结构化数据', category: 'data' },
  { name: 'load_json', description: '加载 JSON 文件并格式化显示', category: 'data' },
  { name: 'load_markdown', description: '加载 Markdown 文件并提取标题结构', category: 'data' },
  { name: 'calculator', description: '执行数学计算', category: 'utility' },
  { name: 'datetime', description: '获取当前日期时间', category: 'utility' },
  // Agent 能力工具
  { name: 'generate_test', description: '为指定源代码文件自动生成单元测试（分析函数/类，LLM 生成测试代码）', category: 'agent' },
  { name: 'review_code', description: '对源代码文件进行自动化审查（静态规则 + LLM 增强，输出评分和建议）', category: 'agent' },
  { name: 'generate_wiki', description: '扫描代码仓库结构，自动生成项目文档 Wiki', category: 'agent' },
  { name: 'spawn_subagent', description: '在隔离环境中启动子 Agent 执行任务（独立资源配额和工具权限）', category: 'agent' },
  { name: 'image_to_code', description: '将 UI 截图转换为前端代码（支持 React/Vue/HTML 等框架）', category: 'agent' },
  { name: 'analyze_screenshot', description: '分析截图内容，诊断错误截图并给出修复建议', category: 'agent' },
  { name: 'plan_task', description: '将复杂任务分解为结构化子任务列表（含依赖关系和执行顺序）', category: 'agent' },
  { name: 'rag_search', description: '在已索引文档库中混合搜索（全文+向量+RRF融合+MMR重排序）', category: 'agent' },
]

// ===== 提示词构建器 =====

export interface BuildPromptParams {
  mode: 'code' | 'office'          // 对话模式
  variantName?: string              // 提示词变体名称
  projectPath?: string              // 项目路径
  globalMemory?: string             // 全局记忆
  customRules?: string              // 自定义规则
  customInstructions?: string       // 自定义指令（模式级别）
  skillPrompt?: string              // 技能提示
  mcpTools?: Array<{ name: string; description: string }>  // MCP 工具列表
  disabledBuiltinTools?: ReadonlyArray<string>  // 已禁用的内置工具名列表（不会出现在提示词中）
  includeAgentsMd?: boolean         // 是否包含 AGENTS.md
  includeClaudeMd?: boolean         // 是否包含 CLAUDE.md
  agentsMdContent?: string          // AGENTS.md 内容（由调用方读取）
  claudeMdContent?: string          // CLAUDE.md 内容（由调用方读取）
  permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'  // 执行权限等级
}

export class PromptBuilder {
  /**
   * 解析变体名称，找不到时 fallback 到 default
   */
  static resolveVariant(name?: string): PromptVariant {
    if (!name || name === '') {
      return variantRegistry.get('default')!
    }
    return variantRegistry.get(name) ?? variantRegistry.get('default')!
  }

  /**
   * 列出所有可用变体
   */
  static listVariants(): VariantInfo[] {
    return builtinVariants.map(v => ({
      name: v.name,
      description: v.description,
    }))
  }

  /**
   * 根据模式获取变体的模式提示词
   */
  static resolveModePrompt(mode: string, variant: PromptVariant): string {
    if (mode === 'office') {
      return variant.daily
    }
    return variant.coding
  }

  /**
   * 构建工具目录文本
   * @param disabledTools 被禁用（关闭）的内置工具名集合；这些工具不会出现在提示词中
   */
  static buildToolCatalogText(
    mode: string,
    mcpTools?: Array<{ name: string; description: string }>,
    disabledTools?: ReadonlySet<string>
  ): string {
const categoriesToShow = mode === 'code'
? ['filesystem', 'shell', 'data', 'utility', 'web', 'agent']
: ['web', 'data', 'utility', 'agent']

    const byCategory = new Map<string, ToolCatalogItem[]>()
    for (const item of builtinToolCatalog) {
      // 跳过被用户关闭的内置工具，避免误导 LLM 调用不存在的工具
      if (disabledTools && disabledTools.has(item.name)) continue
      if (!byCategory.has(item.category)) {
        byCategory.set(item.category, [])
      }
      byCategory.get(item.category)!.push(item)
    }

    let out = ''
    for (const cat of categoriesToShow) {
      const items = byCategory.get(cat)
      if (!items || items.length === 0) continue
      const label = categoryNames[cat] ?? cat
      out += `### ${label} (${items.length})\n`
      for (const it of items) {
        out += `- **${it.name}**: ${it.description}\n`
      }
      out += '\n'
    }

    // MCP 工具
    if (mcpTools && mcpTools.length > 0) {
      out += `### MCP 工具 (${mcpTools.length})\n`
      const limit = Math.min(mcpTools.length, 10)
      for (let i = 0; i < limit; i++) {
        out += `- **${mcpTools[i].name}**: ${mcpTools[i].description}\n`
      }
      if (mcpTools.length > limit) {
        out += `- ... +${mcpTools.length - limit} 个\n`
      }
      out += '\n'
    }

    return out
  }

  /**
   * 构建完整的系统提示词
   */
  static build(params: BuildPromptParams): string {
    const mode = params.mode === 'office' ? 'office' : 'code'
    const modeKey = mode === 'office' ? 'daily' : 'coding'
    const variant = this.resolveVariant(params.variantName)
    const modePrompt = this.resolveModePrompt(modeKey, variant)

    // 构建动态上下文部分
    const contextParts: string[] = []

    // 项目信息
    contextParts.push(`## 项目信息`)
    contextParts.push(`- 项目路径: ${params.projectPath || '未设置'}`)
    contextParts.push(`- 对话模式: ${mode === 'code' ? '编程开发' : '日常办公'}`)
    contextParts.push(`- 提示词变体: ${variant.name}`)
    if (params.permissionLevel) {
      const permLabels: Record<string, string> = {
        ask: '询问权限（CLI请求时确认文件编辑和高风险命令）',
        auto_edit: '自动接受编辑（无需询问即可写入磁盘）',
        plan: '计划模式（仅架构和推理，不操作文件）',
        skip: '跳过权限（完整的 Shell 和文件系统访问）',
      }
      contextParts.push(`- 执行权限: ${permLabels[params.permissionLevel] || params.permissionLevel}`)
    }

    // 计划模式专属指令
    if (params.permissionLevel === 'plan') {
      contextParts.push(``)
      contextParts.push(`## 📋 计划模式 — 架构与推理`)
      contextParts.push(`**你当前处于「计划模式」。请严格遵守以下规则：**`)
      contextParts.push(``)
      contextParts.push(`1. **禁止执行任何文件写入或命令执行工具**（write_file / edit_file / execute_command 等）。你只能使用只读工具（read_file / list_directory / search_code / get_project_structure）来了解项目状况。`)
      contextParts.push(`2. **分析用户需求**：理解用户想要实现什么，评估技术可行性。`)
      contextParts.push(`3. **制定详细计划**：输出一份结构化的实施计划，包含：`)
      contextParts.push(`   - 📌 **目标概述**：简要描述要实现的功能或解决的问题`)
      contextParts.push(`   - 🏗️ **架构设计**：涉及哪些模块/文件、数据流、接口设计`)
      contextParts.push(`   - 📝 **实施步骤**：按顺序列出每一步要做什么，标注依赖关系`)
      contextParts.push(`   - ⚠️ **风险与注意事项**：可能的坑、边界情况、兼容性问题`)
      contextParts.push(`   - ✅ **验收标准**：如何验证计划完成后功能正确`)
      contextParts.push(`4. **不要直接修改代码**，只输出计划。用户确认计划后，切换到其他权限模式再执行。`)
      contextParts.push(`5. 如果需要查看现有代码结构，可以使用只读工具进行分析。`)
    }

    // 自定义指令
    if (params.customInstructions) {
      contextParts.push(``)
      contextParts.push(`## 自定义指令`)
      contextParts.push(params.customInstructions)
    }

    // 自定义规则
    if (params.customRules) {
      contextParts.push(``)
      contextParts.push(`## 自定义规则`)
      contextParts.push(params.customRules)
    }

    // 技能提示
    if (params.skillPrompt) {
      contextParts.push(``)
      contextParts.push(`## 技能提示`)
      contextParts.push(params.skillPrompt)
    }

    // 全局记忆
    if (params.globalMemory) {
      contextParts.push(``)
      contextParts.push(`## 全局记忆`)
      contextParts.push(params.globalMemory)
    }

    // 项目上下文（AGENTS.md / CLAUDE.md）
    const projectContextParts: string[] = []
    if (params.includeAgentsMd && params.agentsMdContent) {
      projectContextParts.push(`## AGENTS.md\n${params.agentsMdContent}`)
    }
    if (params.includeClaudeMd && params.claudeMdContent) {
      projectContextParts.push(`## CLAUDE.md\n${params.claudeMdContent}`)
    }
    if (projectContextParts.length > 0) {
      contextParts.push(``)
      contextParts.push(`## 项目上下文`)
      contextParts.push(projectContextParts.join('\n\n'))
    }

    // 工具目录
    const toolCatalog = this.buildToolCatalogText(
      mode,
      params.mcpTools,
      params.disabledBuiltinTools ? new Set(params.disabledBuiltinTools) : undefined
    )
    if (toolCatalog) {
      contextParts.push(``)
      contextParts.push(`## 可用工具`)
      contextParts.push(`你有以下工具可在对话中调用。当用户请求匹配工具能力时，**主动调用工具**而不是用纯文本回答。`)
      contextParts.push(``)
      contextParts.push(toolCatalog)
      contextParts.push(`调用规则：`)
      contextParts.push(`1. 当用户请求涉及某个工具的能力时，必须调用该工具`)
      contextParts.push(`2. 参数从用户消息中提取；缺失时使用合理默认值`)
      contextParts.push(`3. 调用后展示结果给用户，并解释结果`)
      contextParts.push(`4. 如果不确定该用哪个工具，先问用户`)
      contextParts.push(``)
      contextParts.push(`Agent 能力工具使用场景指南：`)
      contextParts.push(`- **plan_task**: 用户提出复杂多步骤任务（如"重构整个认证模块"、"迁移到 TypeScript"）时，先调用此工具分解任务再执行`)
      contextParts.push(`- **generate_test**: 用户要求为代码写测试、或你在实现功能后需要验证时，调用此工具自动生成单元测试`)
      contextParts.push(`- **review_code**: 用户要求代码审查、或你完成代码修改后需要自检时，调用此工具进行结构化审查`)
      contextParts.push(`- **generate_wiki**: 用户要求生成项目文档、或需要理解整个项目结构时，调用此工具自动生成 Wiki`)
      contextParts.push(`- **rag_search**: 当需要查阅已索引的项目文档、技术资料时，调用此工具进行混合搜索`)
      contextParts.push(`- **spawn_subagent**: 遇到需要隔离执行的高风险任务、或需要不同角色（编码/审查/测试）并行工作时，调用此工具`)
      contextParts.push(`- **image_to_code**: 用户提供 UI 截图/设计稿并要求转为代码时，调用此工具`)
      contextParts.push(`- **analyze_screenshot**: 用户提供错误截图、或需要诊断界面问题时，调用此工具`)
      contextParts.push(`- **find_skill**: 当用户任务需要特定能力（如代码审查、测试生成、文档编写等）时，调用此工具搜索相关技能。高相关性技能会自动激活，中相关性技能会注入推荐提示。`)
      contextParts.push(`- **search_code**: 当你需要查找特定函数/类的定义或用法、定位代码位置时，调用此工具在工作区搜索`)
      contextParts.push(`- **execute_command**: 当你需要运行构建命令、测试、git 操作或查看程序输出时，调用此工具执行 shell 命令`)
      contextParts.push(`- **read_file**: 当你需要查看文件内容时，调用此工具。优先用 read_file 而非 execute_command cat`)
      contextParts.push(`- **write_file**: 当你需要创建或修改文件时，调用此工具。修改前建议先 read_file 了解现有内容`)
    }

    // 组装最终提示词
    const contextBlock = contextParts.join('\n')
    return `${promptBase}\n\n${modePrompt}\n\n${contextBlock}`
  }
}
