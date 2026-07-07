// 应用配置持久化服务
// 使用 electron-store 将配置保存到 userData 目录
// API Key 等敏感字段通过 safeStorage 加密后存盘

import Store from 'electron-store'
import type { AppConfig, ModelConfig, Workspace, MCPServerConfig } from '@shared/types'
import { createSecretStore, type SecretStore, SecretStoreInsecureError } from '../secretStore'

interface StoreSchema {
  config: AppConfig
  models: ModelConfig[]
  workspaces: Workspace[]
  mcpServers: MCPServerConfig[]
  defaultModelId: string | null
}

const DEFAULT_CONFIG: AppConfig = {
  theme: 'dark',
  language: 'zh',
  defaultModelId: null,
  defaultSystemPrompt: '你是一个专业的 AI 编码助手，帮助用户分析代码、回答问题、执行命令。',
  maxTurns: 20,
  maxMessages: 80,
  fontSize: 14,
  sendOnEnter: true,
  globalMemory: '',
  customRules: '',
  includeAgentsMd: false,
  includeClaudeMd: false,
  promptVariant: 'default',
  slashCommands: []
}

export class ConfigStore {
  private store: Store<StoreSchema>
  private secrets: SecretStore
  /** OS Keyring 不可用时的内存兜底：模型 id -> 明文 API Key（不落盘，重启即失效） */
  private memoryApiKeys: Map<string, string> = new Map<string, string>()

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'aela-config',
      defaults: {
        config: DEFAULT_CONFIG,
        models: [],
        workspaces: [],
        mcpServers: [],
        defaultModelId: null
      }
    })
    this.secrets = createSecretStore(() => {
      // 审计：OS Keyring 不可用。此时 API Key 不会落盘（失败即关闭），
      // 调用方改为仅在内存中持有。实际审计日志由 AuditService 接管（如果已注入）。
      // eslint-disable-next-line no-console
      console.warn('[ConfigStore] OS Keyring 不可用，API Key 将以内存方式持有（重启失效），不会写入磁盘。')
    })
  }

  /**
   * 检查存储的 API Key 是否使用 OS 级加密
   */
  isApiKeyStorageSecure(): boolean {
    return this.secrets.isSecure()
  }

  // ===== 应用配置 =====
  getConfig(): AppConfig {
    return this.store.get('config', DEFAULT_CONFIG)
  }

  setConfig(partial: Partial<AppConfig>): AppConfig {
    const current = this.getConfig()
    // 深合并：仅覆盖 partial 中显式定义的顶层字段，保留未提及的字段
    // 对于嵌套对象字段，如果 partial 中提供了该字段，则整体替换（与原行为一致）
    // 但对于独立字段（如 globalMemory, customRules），spread 合并已足够
    const updated = { ...current, ...partial }
    this.store.set('config', updated)
    return updated
  }

  // ===== 模型配置 =====
  getModels(): ModelConfig[] {
    return this.store.get('models', []).map((m) => this.decryptModelApiKey(m))
  }

  getModel(id: string): ModelConfig | undefined {
    const model = this.getModels().find((m) => m.id === id)
    return model ? this.decryptModelApiKey(model) : undefined
  }

  addModel(model: ModelConfig): void {
    const models = this.store.get('models', [])
    // 加密 apiKey 后存盘
    models.push(this.encryptModelApiKey(model))
    this.store.set('models', models)
  }

  updateModel(id: string, partial: Partial<ModelConfig>): void {
    const models = this.store.get('models', [])
    const idx = models.findIndex((m) => m.id === id)
    if (idx >= 0) {
      const merged = { ...models[idx], ...partial }
      models[idx] = this.encryptModelApiKey(merged)
      this.store.set('models', models)
    }
  }

  deleteModel(id: string): void {
    this.memoryApiKeys.delete(id)
    const models = this.store.get('models', []).filter((m) => m.id !== id)
    this.store.set('models', models)
    // 如果删除的是默认模型，清除默认设置
    if (this.getDefaultModelId() === id) {
      this.setDefaultModelId(models[0]?.id ?? null)
    }
  }

  // ===== 内部：apiKey 加密/解密 =====
  private encryptModelApiKey(model: ModelConfig): ModelConfig {
    if (!model.apiKey) return model
    // 已经是加密格式 / 降级格式 — 不重复加密
    if (model.apiKey.startsWith('enc:v1:') || model.apiKey.startsWith('b64:')) {
      return model
    }
    try {
      return { ...model, apiKey: this.secrets.encrypt(model.apiKey) }
    } catch (err) {
      // 失败即关闭：OS Keyring 不可用，encrypt() 会抛错。
      // 拒绝把明文写盘，改为仅本次会话内存持有。
      if (err instanceof SecretStoreInsecureError) {
        this.memoryApiKeys.set(model.id, model.apiKey)
        // eslint-disable-next-line no-console
        console.warn(`[ConfigStore] OS Keyring 不可用，模型「${model.id}」的 API Key 仅保存在内存，重启后失效。`)
        return { ...model, apiKey: '' }
      }
      throw err
    }
  }

  private decryptModelApiKey(model: ModelConfig): ModelConfig {
    // 内存兜底优先：OS Keyring 不可用时，密钥仅保存在内存
    const memKey = this.memoryApiKeys.get(model.id)
    if (memKey !== undefined) {
      return { ...model, apiKey: memKey }
    }
    if (!model.apiKey) return model
    // 仅在存盘格式（enc:/b64:/无前缀）时尝试解密；
    // 解密失败时保留原值（避免误清空）
    try {
      const plain = this.secrets.decrypt(model.apiKey)
      return { ...model, apiKey: plain }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ConfigStore] 解密模型 API Key 失败，保留原值', err)
      return model
    }
  }

  getDefaultModelId(): string | null {
    return this.store.get('defaultModelId', null)
  }

  setDefaultModelId(id: string | null): void {
    this.store.set('defaultModelId', id)
    this.setConfig({ defaultModelId: id })
  }

  // ===== 工作区 =====
  getWorkspaces(): Workspace[] {
    return this.store.get('workspaces', [])
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.getWorkspaces().find((w) => w.id === id)
  }

  addWorkspace(workspace: Workspace): void {
    const workspaces = this.getWorkspaces()
    // 避免重复路径
    const existing = workspaces.findIndex((w) => w.path === workspace.path)
    if (existing >= 0) {
      workspaces[existing] = { ...workspace, id: workspaces[existing].id }
    } else {
      workspaces.push(workspace)
    }
    this.store.set('workspaces', workspaces)
  }

  removeWorkspace(id: string): void {
    const workspaces = this.getWorkspaces().filter((w) => w.id !== id)
    this.store.set('workspaces', workspaces)
  }

  updateWorkspaceLastOpened(id: string): void {
    const workspaces = this.getWorkspaces()
    const idx = workspaces.findIndex((w) => w.id === id)
    if (idx >= 0) {
      workspaces[idx].lastOpenedAt = new Date().toISOString()
      this.store.set('workspaces', workspaces)
    }
  }

  // ===== MCP 服务器 =====
  getMCPServers(): MCPServerConfig[] {
    return this.store.get('mcpServers', [])
  }

  getMCPServer(id: string): MCPServerConfig | undefined {
    return this.getMCPServers().find((s) => s.id === id)
  }

  addMCPServer(server: MCPServerConfig): void {
    const servers = this.getMCPServers()
    servers.push(server)
    this.store.set('mcpServers', servers)
  }

  updateMCPServer(id: string, partial: Partial<MCPServerConfig>): void {
    const servers = this.getMCPServers()
    const idx = servers.findIndex((s) => s.id === id)
    if (idx >= 0) {
      servers[idx] = { ...servers[idx], ...partial }
      this.store.set('mcpServers', servers)
    }
  }

  deleteMCPServer(id: string): void {
    const servers = this.getMCPServers().filter((s) => s.id !== id)
    this.store.set('mcpServers', servers)
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
