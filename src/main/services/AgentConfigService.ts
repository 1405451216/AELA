// 自定义 Agent 配置服务
// 持久化管理用户自定义的 Agent 配置（角色、工具、模型、参数）

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { CustomAgentConfig } from '@shared/types'

export class AgentConfigService {
  private configPath: string
  private configs: Map<string, CustomAgentConfig> = new Map()
  private loaded = false

  constructor() {
    const userDataPath = app.getPath('userData')
    this.configPath = join(userDataPath, 'agent-configs.json')
  }

  private async load(): Promise<void> {
    if (this.loaded) return
    try {
      const data = await readFile(this.configPath, 'utf-8')
      const arr = JSON.parse(data) as CustomAgentConfig[]
      for (const c of arr) {
        this.configs.set(c.id, c)
      }
    } catch (err) {
      // 文件不存在或解析失败 → 初始化为空
      console.error('[AgentConfigService] 加载配置失败:', err)
    }
    this.loaded = true

    // 如果没有预设 Agent，创建默认的
    if (this.configs.size === 0) {
      this.createDefaults()
    }
  }

  private async save(): Promise<void> {
    const arr = Array.from(this.configs.values())
    try {
      await mkdir(join(this.configPath, '..'), { recursive: true })
      await writeFile(this.configPath, JSON.stringify(arr, null, 2), 'utf-8')
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('[AgentConfigService] 保存配置失败:', errMsg)
      throw new Error(`保存 Agent 配置失败: ${errMsg}`)
    }
  }

  private createDefaults(): void {
    const defaults: Array<Omit<CustomAgentConfig, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        name: '代码工程师',
        description: '专注于代码编写、重构和调试',
        systemPrompt: '你是一个资深软件工程师。你擅长编写高质量、可维护的代码。在实现功能时，你会考虑边界条件、错误处理和性能。请总是给出完整的代码实现。',
        modelConfigId: '',
        tools: ['read_file', 'write_file', 'list_directory', 'search_code', 'execute_command'],
        maxTurns: 30,
        temperature: 0.2,
        tags: ['code', 'engineering'],
      },
      {
        name: '代码审查员',
        description: '专注于代码质量和安全审查',
        systemPrompt: '你是一个严格的代码审查员。你会检查代码中的安全漏洞、性能问题、代码风格和潜在 bug。请给出具体的改进建议，并标注严重级别。',
        modelConfigId: '',
        tools: ['read_file', 'list_directory', 'search_code'],
        maxTurns: 15,
        temperature: 0.1,
        tags: ['review', 'security'],
      },
      {
        name: '架构师',
        description: '专注于系统设计和架构决策',
        systemPrompt: '你是一个经验丰富的系统架构师。你擅长分析需求、设计系统架构、选择技术栈和定义接口。请用清晰的图表和文档说明你的设计决策。',
        modelConfigId: '',
        tools: ['read_file', 'list_directory', 'search_code', 'write_file'],
        maxTurns: 20,
        temperature: 0.4,
        tags: ['architecture', 'design'],
      },
      {
        name: '测试工程师',
        description: '专注于生成和运行测试',
        systemPrompt: '你是一个测试工程师。你会分析代码并生成全面的单元测试，覆盖正常路径、边界条件和错误场景。你熟悉 vitest、jest 和 pytest 框架。',
        modelConfigId: '',
        tools: ['read_file', 'write_file', 'execute_command', 'search_code'],
        maxTurns: 25,
        temperature: 0.3,
        tags: ['test', 'quality'],
      },
    ]

    const now = new Date().toISOString()
    for (const d of defaults) {
      const config: CustomAgentConfig = {
        ...d,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      }
      this.configs.set(config.id, config)
    }
  }

  async list(): Promise<CustomAgentConfig[]> {
    await this.load()
    return Array.from(this.configs.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<CustomAgentConfig | null> {
    await this.load()
    return this.configs.get(id) || null
  }

  async add(config: Omit<CustomAgentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomAgentConfig> {
    await this.load()
    const now = new Date().toISOString()
    const newConfig: CustomAgentConfig = {
      ...config,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    this.configs.set(newConfig.id, newConfig)
    await this.save()
    return newConfig
  }

  async update(id: string, partial: Partial<CustomAgentConfig>): Promise<CustomAgentConfig | null> {
    await this.load()
    const existing = this.configs.get(id)
    if (!existing) return null
    const updated: CustomAgentConfig = {
      ...existing,
      ...partial,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    }
    this.configs.set(id, updated)
    await this.save()
    return updated
  }

  async delete(id: string): Promise<boolean> {
    await this.load()
    const deleted = this.configs.delete(id)
    if (deleted) await this.save()
    return deleted
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
