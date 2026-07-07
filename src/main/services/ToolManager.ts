// 工具管理器（编排层）
// 注册内置工具（文件系统、Shell、搜索）+ MCP 工具 + Skill 工具
// 基于 @agentprimordia/sdk 的 ToolRegistry
//
// 本文件仅包含编排逻辑；具体工具实现见 ./tools/builtin/* 下的拆分文件。
// 抽出到独立模块的：
//   - Shell 命令风险评估 → ./tools/shellRisk.ts
//   - 路径解析与穿越防护 → ./tools/pathSafety.ts
//   - 文件变更追踪器 → ./tools/fileChangeTracker.ts
//   - 行级 diff 计算 → ./tools/diff.ts
//   - 数学表达式解析器 → ./tools/mathParser.ts

import { ToolRegistry, MCPClient } from '@agentprimordia/sdk'
import type { Tool } from '@agentprimordia/sdk'
import type { MCPServerConfig, MCPServerStatus, MCPResourceInfo, ShellConfirmRequest, ShellConfirmResponse, BuiltinToolInfo, FileChangeRecord, FileDiffLine, MultiFileEdit, MultiFileEditResult } from '@shared/types'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import { safeResolve } from './tools/pathSafety'
import { FileChangeTracker } from './tools/fileChangeTracker'
import { computeLineDiff } from './tools/diff'
// [重构] 内置工具拆分为 3 个文件
import {
  ReadFileTool,
  WriteFileTool,
  ListDirectoryTool,
} from './tools/builtin/filesystem'
import {
  ShellTool,
  CodeSearchTool,
  ProjectStructureTool,
  HttpFetchTool,
} from './tools/builtin/shellAndSearch'
import {
  CsvLoaderTool,
  JsonLoaderTool,
  MarkdownLoaderTool,
  CalculatorTool,
  DateTimeTool,
} from './tools/builtin/dataLoaders'
import {
  GenerateTestTool,
  ReviewCodeTool,
  GenerateWikiTool,
  SpawnSubAgentTool,
  ImageToCodeTool,
  AnalyzeScreenshotTool,
  PlanTaskTool,
  RagSearchTool,
} from './tools/builtin/agentTools'
import { createFindSkillTool, getFindSkillTool } from './tools/builtin/findSkill'
import type { SkillRouter } from './SkillRouter'
import type { AgentToolContext } from './tools/builtin/agentTools'

// ===== 类型导出（向后兼容） =====
export type ShellConfirmCallback = (request: ShellConfirmRequest) => Promise<ShellConfirmResponse>

// ===== MCP 工具适配器 =====
// 将 MCP server 的工具包装为 SDK Tool 接口
class MCPToolAdapter implements Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
  private mcpClient: MCPClient
  private toolName: string

  constructor(mcpClient: MCPClient, toolName: string, description: string, inputSchema: Record<string, unknown>) {
    this.mcpClient = mcpClient
    this.toolName = toolName
    this.name = `mcp_${toolName}`
    this.description = description
    this.parameters = inputSchema
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    const result = await this.mcpClient.callTool({
      name: this.toolName,
      arguments: args
    })

    if (result.isError) {
      throw new Error(result.content.map(c => c.text || '').join('\n'))
    }

    return result.content.map(c => c.text || '').join('\n')
  }
}

// ===== Skill 工具适配器 =====
// 当 skill 的 frontmatter 含 as_tool: true 时，将其注册为 Agent 工具
// 工具执行时：把 skill 的完整内容作为 prompt 上下文返回，供 Agent 阅读后应用
class SkillToolAdapter implements Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
  private skillContent: string

  constructor(skillName: string, description: string, inputSchema: Record<string, unknown>, skillContent: string) {
    // 工具名必须是英文标识符
    const safeName = skillName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
    this.name = `skill_${safeName}`
    this.description = description
    // 提供默认参数 schema
    this.parameters = Object.keys(inputSchema || {}).length > 0
      ? inputSchema
      : {
          type: 'object',
          properties: {
            context: {
              type: 'string',
              description: '执行此 skill 时的上下文（可选）'
            }
          }
        }
    this.skillContent = skillContent
  }

  async execute(args: Record<string, unknown>): Promise<string> {
    // 返回 skill 完整内容 + 用户提供的 context（如果有）
    const context = typeof args.context === 'string' ? args.context : ''
    const header = `# Skill: ${this.description}\n\n`
    if (context) {
      return `${header}## 调用上下文\n${context}\n\n## Skill 指引\n${this.skillContent}`
    }
    return `${header}## Skill 指引\n${this.skillContent}`
  }
}


// ===== 工具管理器 =====
export class ToolManager {
  private registry: ToolRegistry
  private rootDir: string
  private mcpClients: Map<string, MCPClient> = new Map()
  private shellTool: ShellTool | null = null
  private confirmCallback?: ShellConfirmCallback
  // 内置工具开关
  private builtinToolEnabled: Map<string, boolean> = new Map()
  // 文件变更追踪
  private changeTracker: FileChangeTracker = new FileChangeTracker()
  private writeToolRef: WriteFileTool | null = null
  // Agent 高级工具上下文（通过 setAgentTools 注入）
  private agentToolCtx: AgentToolContext | null = null
  // 已注册为工具的 skill（保留完整信息，以便在重建注册表时恢复）
  private skillTools: Map<string, {
    id: string
    name: string
    description: string
    content: string
    toolName?: string
    toolDescription?: string
    toolParameters?: Record<string, unknown>
  }> = new Map()

  constructor(rootDir: string, confirmCallback?: ShellConfirmCallback) {
    this.rootDir = rootDir
    this.confirmCallback = confirmCallback
    this.registry = new ToolRegistry()
    this.registerBuiltinTools()
  }

  /**
   * 设置当前会话上下文（用于文件变更追踪）
   */  setSessionContext(sessionId: string, agentName: string): void {
    this.writeToolRef?.setContext(sessionId, agentName)
  }

  /**
   * 获取文件变更列表
   */
  getFileChanges(sessionId?: string): FileChangeRecord[] {
    return this.changeTracker.list(sessionId)
  }

  /**
   * 获取单个文件变更记录
   */
  getFileChange(id: string): FileChangeRecord | undefined {
    return this.changeTracker.get(id)
  }

  /**
   * 计算文件变更的 diff
   */
  getFileDiff(id: string): FileDiffLine[] | null {
    const record = this.changeTracker.get(id)
    if (!record) return null
    return computeLineDiff(record.originalContent, record.newContent)
  }

  /**
   * 清除文件变更记录
   */
  clearFileChanges(sessionId?: string): void {
    this.changeTracker.clear(sessionId)
  }

  /**
   * 接受文件变更
   */
  acceptFileChange(id: string): FileChangeRecord | undefined {
    return this.changeTracker.accept(id)
  }

  /**
   * 拒绝文件变更（回滚到原始内容）
   */
  async rejectFileChange(id: string): Promise<FileChangeRecord | undefined> {
    const record = this.changeTracker.reject(id)
    if (record && record.changeType === 'modified') {
      // 回滚到原始内容
      try {
        await writeFile(record.absolutePath, record.originalContent, 'utf-8')
      } catch (err: unknown) {
        console.error('[ToolManager] 回滚修改后的文件失败:', err)
      }
    } else if (record && record.changeType === 'created') {
      // 删除新创建的文件
      try {
        const { unlink } = await import('node:fs/promises')
        await unlink(record.absolutePath)
      } catch (err) {
        console.error('[ToolManager] delete created file during reject failed:', err)
      }
    }
    return record
  }

  /**
   * 批量写入多个文件（多文件协同编辑）
   */
  async writeBatch(edits: MultiFileEdit[], sessionId?: string, agentName?: string): Promise<MultiFileEditResult[]> {
    const results: MultiFileEditResult[] = []
    for (const edit of edits) {
      try {
        const filePath = safeResolve(this.rootDir, edit.filePath)
        // 在写入前捕获原始内容
        if (this.changeTracker && sessionId) {
          await this.changeTracker.captureBeforeWrite(
            filePath,
            this.rootDir,
            edit.content,
            sessionId,
            agentName || 'multifile-editor'
          )
        }
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, edit.content, 'utf-8')
        results.push({
          filePath: edit.filePath,
          success: true,
          bytesWritten: Buffer.byteLength(edit.content, 'utf-8'),
        })
      } catch (err: unknown) {
        results.push({
          filePath: edit.filePath,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          bytesWritten: 0,
        })
      }
    }
    return results
  }

  /**
   * 将 skill 注册为 Agent 工具（as_tool: true 的 skill）
   */
  registerSkillAsTool(skill: {
    id: string
    name: string
    description: string
    content: string
    toolName?: string
    toolDescription?: string
    toolParameters?: Record<string, unknown>
  }): void {
    const safeName = (skill.toolName || skill.name).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
    const toolName = `skill_${safeName}`
    // 已存在则先移除
    this.registry.remove(toolName)
    const adapter = new SkillToolAdapter(
      skill.toolName || skill.name,
      skill.toolDescription || skill.description,
      skill.toolParameters || {},
      skill.content
    )
    this.registry.register(adapter)
    this.skillTools.set(skill.id, skill)
  }

  /**
   * 取消注册 skill 工具
   */
  unregisterSkillAsTool(skill: { id: string; name: string; toolName?: string }): void {
    const safeName = (skill.toolName || skill.name).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
    const toolName = `skill_${safeName}`
    this.registry.remove(toolName)
    this.skillTools.delete(skill.id)
  }

  /**
   * 清除所有 skill 工具
   */
  clearSkillTools(): void {
    for (const [, skill] of this.skillTools) {
      const safeName = (skill.toolName || skill.name).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
      this.registry.remove(`skill_${safeName}`)
    }
    this.skillTools.clear()
  }

  /**
   * 获取当前已注册的 skill 工具
   */
  getRegisteredSkillTools() {
    return Array.from(this.skillTools.values())
  }

  /**
   * 设置命令确认回调（在 IPC 注册完成后调用）
   */
  setConfirmCallback(callback: ShellConfirmCallback): void {
    this.confirmCallback = callback
    // 重建 ShellTool 以更新回调
    this.rebuildShellTool()
  }

  /**
   * 设置 Checkpoint 回调（在 WriteFileTool 写入前创建快照）
   */
  setCheckpointCallback(callback: (sessionId: string, filePaths: string[], description: string) => Promise<void>): void {
    this.writeToolRef?.setCheckpointCallback(callback)
  }

  /**
   * 重置会话级审批（新会话时调用）
   */
  resetSessionApprovals(): void {
    this.shellTool?.resetSessionApprovals()
  }

  /**
   * 注册内置工具
   */
  private registerBuiltinTools(): void {
    // 文件系统工具
    this.registerBuiltin('read_file', 'filesystem', new ReadFileTool(this.rootDir))
    this.writeToolRef = new WriteFileTool(this.rootDir, this.changeTracker)
    this.registerBuiltin('write_file', 'filesystem', this.writeToolRef)
    this.registerBuiltin('list_directory', 'filesystem', new ListDirectoryTool(this.rootDir))
    this.registerBuiltin('search_code', 'filesystem', new CodeSearchTool(this.rootDir))
    this.registerBuiltin('get_project_structure', 'filesystem', new ProjectStructureTool(this.rootDir))

    // Shell 工具
    this.shellTool = new ShellTool(this.rootDir, this.confirmCallback)
    this.registerBuiltin('execute_command', 'shell', this.shellTool)

    // Web 工具
    this.registerBuiltin('http_fetch', 'web', new HttpFetchTool())

    // 数据工具
    this.registerBuiltin('load_csv', 'data', new CsvLoaderTool(this.rootDir))
    this.registerBuiltin('load_json', 'data', new JsonLoaderTool(this.rootDir))
    this.registerBuiltin('load_markdown', 'data', new MarkdownLoaderTool(this.rootDir))

    // 实用工具
    this.registerBuiltin('calculator', 'utility', new CalculatorTool())
    this.registerBuiltin('datetime', 'utility', new DateTimeTool())

    // Agent 高级工具（如果上下文已注入）
    this.registerAgentTools()

    // ===== MCP 客户端连接 =====
  }

  /**
   * 注入 Agent 高级工具所需的服务上下文并注册工具
   */
  setAgentTools(ctx: AgentToolContext): void {
    this.agentToolCtx = ctx
    this.registerAgentTools()
  }

  /**
   * 注入 SkillRouter 到 find_skill 工具
   */
  setSkillRouter(skillRouter: SkillRouter): void {
    const findSkill = getFindSkillTool()
    if (findSkill) {
      findSkill.setSkillRouter(skillRouter)
    }
  }

  /**
   * 注册 Agent 高级工具（依赖 setAgentTools 注入的上下文）
   */
  private registerAgentTools(): void {
    if (!this.agentToolCtx) return
    const ctx = this.agentToolCtx
    this.registerBuiltin('generate_test', 'agent', new GenerateTestTool(ctx))
    this.registerBuiltin('review_code', 'agent', new ReviewCodeTool(ctx))
    this.registerBuiltin('generate_wiki', 'agent', new GenerateWikiTool(ctx))
    this.registerBuiltin('spawn_subagent', 'agent', new SpawnSubAgentTool(ctx))
    this.registerBuiltin('image_to_code', 'agent', new ImageToCodeTool(ctx))
    this.registerBuiltin('analyze_screenshot', 'agent', new AnalyzeScreenshotTool(ctx))
    this.registerBuiltin('plan_task', 'agent', new PlanTaskTool(ctx))
    this.registerBuiltin('rag_search', 'agent', new RagSearchTool(ctx))
    this.registerBuiltin('find_skill', 'agent', createFindSkillTool())
  }

  /**
   * 连接 MCP 服务器
   */
  async connectMCP(config: MCPServerConfig): Promise<MCPServerStatus> {
    try {
      // SDK MCPClient 期望 @agentprimordia/sdk 的 MCPServerConfig（含 name/version）
      const mcpConfig = {
        name: config.name ?? '',
        version: '1.0.0',
        transport: config.transport,
        command: config.command,
        args: config.args,
        env: config.env,
        url: config.url,
        timeout: 30000,
      }

      const client = new MCPClient(mcpConfig)
      await client.connect()

      this.mcpClients.set(config.id, client)
      this.registerMCPTools(client)

      const tools = client.listTools().map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }))

      return {
        id: config.id,
        name: config.name,
        connected: true,
        toolCount: tools.length,
        tools
      }
    } catch (err: unknown) {
      return {
        id: config.id,
        name: config.name,
        connected: false,
        toolCount: 0,
        tools: [],
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /**
   * 断开 MCP 服务器
   */
  async disconnectMCP(id: string): Promise<void> {
    const client = this.mcpClients.get(id)
    if (client) {
      // 移除该 MCP 的工具
      const tools = client.listTools()
      for (const tool of tools) {
        this.registry.remove(`mcp_${tool.name}`)
      }
      await client.disconnect()
      this.mcpClients.delete(id)
    }
  }

  /**
   * 获取所有 MCP 服务器状态
   */
  getMCPStatus(): MCPServerStatus[] {
    const statuses: MCPServerStatus[] = []
    for (const [id, client] of this.mcpClients) {
      const tools = client.listTools().map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema
      }))
      statuses.push({
        id,
        name: client.getServerInfo()?.name || 'unknown',
        connected: client.isConnected(),
        toolCount: tools.length,
        tools
      })
    }
    return statuses
  }

  /**
   * 将 MCP 客户端的工具注册到注册表
   */
  private registerMCPTools(client: MCPClient): void {
    const tools = client.listTools()
    for (const tool of tools) {
      const adapter = new MCPToolAdapter(client, tool.name, tool.description, tool.inputSchema)
      this.registry.register(adapter)
    }
  }

  /**
   * 获取已注册工具列表
   */
  listTools(): Array<{ name: string; description: string }> {
    return this.registry.list().map(t => ({ name: t.name, description: t.description }))
  }

  /**
   * 关闭所有 MCP 连接
   */
  async close(): Promise<void> {
    for (const [id] of this.mcpClients) {
      await this.disconnectMCP(id)
    }
  }

  // ===== [重构补回] sed 误删的公开方法 =====

  /** 获取底层 ToolRegistry（供 AgentService 注入到 ReActAgent） */
  getRegistry(): ToolRegistry {
    return this.registry
  }

  /**
   * 创建基于推荐结果的优先级 ToolRegistry
   *
   * 策略：
   *   - 高优先级工具（推荐分数 >= threshold）：始终保留
   *   - 基础工具（read_file, write_file, search_code 等常驻）：始终保留
   *   - 低优先级工具（推荐分数 < threshold 且非常驻）：从返回列表中排除
   *
   * 注意：此方法不修改原始 registry，仅返回过滤后的工具名列表供 AgentService 使用
   * AgentService 可通过此列表在系统提示词中标注优先级，而非物理删除工具
   *
   * @param recommendedTools 推荐工具列表（按分数降序）
   * @param threshold 推荐阈值（默认 0.3，低于此值且非常驻工具被标记为低优先级）
   * @returns 工具优先级分类
   */
  getToolPriorityMap(
    recommendedTools: Array<{ toolName: string; score: number }>,
    threshold: number = 0.3,
  ): { highPriority: string[]; normalPriority: string[]; lowPriority: string[] } {
    // 常驻工具：无论推荐分数如何，始终为高优先级
    const ALWAYS_AVAILABLE = new Set([
      'read_file', 'write_file', 'list_directory', 'search_code',
      'execute_command', 'find_skill',
    ])

    const recommendedSet = new Set(recommendedTools.map(r => r.toolName))
    const highPriority: string[] = []
    const normalPriority: string[] = []
    const lowPriority: string[] = []

    // 遍历注册表中所有工具
    const allTools = this.registry.list()
    for (const tool of allTools) {
      const isRecommended = recommendedSet.has(tool.name)
      const recEntry = recommendedTools.find(r => r.toolName === tool.name)
      const score = recEntry?.score ?? 0
      const isAlwaysAvailable = ALWAYS_AVAILABLE.has(tool.name)

      if (isAlwaysAvailable || (isRecommended && score >= threshold)) {
        highPriority.push(tool.name)
      } else if (isRecommended || score > 0.15) {
        normalPriority.push(tool.name)
      } else {
        lowPriority.push(tool.name)
      }
    }

    return { highPriority, normalPriority, lowPriority }
  }

  /** 获取工作区根目录 */
  getRootDir(): string {
    return this.rootDir
  }

  /** 设置工作区根目录（重建工具注册） */
  setRootDir(dir: string): void {
    this.rootDir = dir
    this.registerBuiltinTools()
  }

  /** 列出 MCP server 资源 */
  listMCPResources(_serverId: string): MCPResourceInfo[] {
    // 占位：实际实现需要 SDK 支持
    return []
  }

  /** 读取 MCP 资源 */
  readMCPResource(_serverId: string, _uri: string): string {
    // 占位：实际实现需要 SDK 支持
    return ''
  }

  /** 列出所有内置工具（带 category 元信息） */
  listBuiltinTools(): BuiltinToolInfo[] {
    // 内置工具的元数据（name + description + category），与 registerBuiltinTools 保持一致
    const builtinMeta: Array<{ name: string; description: string; category: BuiltinToolInfo['category'] }> = [
      { name: 'read_file', description: '读取指定路径的文件内容。支持文本文件、代码文件等。', category: 'filesystem' },
      { name: 'write_file', description: '写入内容到指定文件。如果文件不存在则创建，如果存在则覆盖。', category: 'filesystem' },
      { name: 'list_directory', description: '列出指定目录下的文件和子目录。', category: 'filesystem' },
      { name: 'search_code', description: '在工作区中搜索代码内容。支持正则表达式和文件扩展名过滤。', category: 'filesystem' },
      { name: 'get_project_structure', description: '获取工作区的项目目录结构树。', category: 'filesystem' },
      { name: 'execute_command', description: '在工作区目录下执行 Shell 命令。', category: 'shell' },
      { name: 'http_fetch', description: '发起 HTTP/HTTPS 请求，获取网页内容或 API 响应。', category: 'web' },
      { name: 'load_csv', description: '加载 CSV 文件并解析为结构化数据。', category: 'data' },
      { name: 'load_json', description: '加载 JSON 文件并格式化显示。', category: 'data' },
      { name: 'load_markdown', description: '加载 Markdown 文件并提取标题结构。', category: 'data' },
      { name: 'calculator', description: '执行数学计算。', category: 'utility' },
      { name: 'datetime', description: '获取当前日期时间或格式化指定时间戳。', category: 'utility' },
      { name: 'generate_test', description: '为指定的源代码文件自动生成单元测试。分析函数和类，使用 LLM 生成测试代码。', category: 'agent' },
      { name: 'review_code', description: '对源代码文件进行自动化审查。结合静态规则和 LLM 增强 review，生成结构化报告。', category: 'agent' },
      { name: 'generate_wiki', description: '扫描代码仓库结构，自动生成项目文档 Wiki。', category: 'agent' },
      { name: 'spawn_subagent', description: '在隔离环境中启动子 Agent 执行任务。', category: 'agent' },
      { name: 'image_to_code', description: '将 UI 截图转换为前端代码。支持 React/Vue/HTML 等框架。', category: 'agent' },
      { name: 'analyze_screenshot', description: '分析截图内容，诊断错误截图，给出修复建议。', category: 'agent' },
      { name: 'plan_task', description: '将复杂任务分解为结构化子任务列表，含依赖关系和执行顺序。', category: 'agent' },
      { name: 'rag_search', description: '在已索引的文档库中进行混合搜索（全文+向量+RRF融合）。', category: 'agent' },
      { name: 'find_skill', description: '根据当前任务搜索可用的 Skill 技能。当需要特定领域能力时调用此工具。', category: 'agent' },
    ]
    return builtinMeta.map(meta => ({
      ...meta,
      enabled: this.builtinToolEnabled.get(meta.name) ?? true,
    }))
  }

  /** 切换内置工具开关 */
  toggleBuiltinTool(name: string, enabled: boolean): void {
    this.builtinToolEnabled.set(name, enabled)
    if (!enabled) {
      this.registry.remove(name)
    } else {
      // 重新注册对应工具
      this.registerBuiltinTools()
    }
  }

  /** 注册单个内置工具（带开关过滤） */
  private registerBuiltin(name: string, category: BuiltinToolInfo['category'], tool: Tool): void {
    if (this.builtinToolEnabled.has(name) && !this.builtinToolEnabled.get(name)) return
    this.builtinToolEnabled.set(name, true)
    this.registry.register(tool)
  }

  /** 重建 ShellTool（rootDir 改变时调用） */
  rebuildShellTool(): void {
    if (this.shellTool) {
      this.registry.remove('execute_command')
    }
    this.shellTool = new ShellTool(this.rootDir, this.confirmCallback)
    this.registerBuiltin('execute_command', 'shell', this.shellTool)
  }

}
