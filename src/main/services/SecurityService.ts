// 安全沙箱服务
// 基于 SDK 的 ACL + Sandbox + FileScopePolicy
// 提供: Agent 级文件访问控制 / 命令白名单黑名单 / 路径穿越防护 / 多 Agent 文件作用域隔离
// [升级] 增加安全策略模板: 严格 / 标准 / 宽松 三档一键应用

import { ACL, Sandbox, FileScopePolicy } from '@agentprimordia/sdk'
// [SDK 集成] 命令安全工具: Shell 元字符检测 / 输入消毒 / 命令护栏
import { containsShellMetacharacter, validatePathTraversal, resolvePathSafe, InputSanitizer, CommandGuard } from '@agentprimordia/sdk'
import type { AccessLevel, SandboxConfig, ACLRule, SecurityPreset, SecurityPresetLevel, GuardrailRuleConfig, HITLInterruptPoint } from '@shared/types'

// ===== 安全策略模板 =====

const SECURITY_PRESETS: Record<SecurityPresetLevel, SecurityPreset> = {
  strict: {
    level: 'strict',
    name: '严格模式',
    description: '最高安全级别：所有文件操作和命令执行都需要人工确认，禁止危险命令，启用所有护栏',
    config: {
      aclRules: [
        { agentId: '*', resource: '*', level: 'read', denied: false },
        { agentId: '*', resource: '*', level: 'write', denied: true },
        { agentId: '*', resource: '*', level: 'execute', denied: true },
      ],
      allowedCommands: [],
      blockedCommands: [
        'rm', 'del', 'rmdir', 'format', 'mkfs', 'dd',
        'shutdown', 'reboot', 'kill', 'killall',
        'curl', 'wget', 'scp', 'rsync',
        'chmod', 'chown', 'sudo', 'su',
        'git push', 'git reset --hard', 'git clean',
        'npm publish', 'docker', 'kubectl',
      ],
    },
    guardrailRules: [
      {
        id: 'strict-injection',
        name: '严格注入防护',
        type: 'injection',
        enabled: true,
        checkPoint: 'input',
        config: { sensitivity: 'high' },
      },
      {
        id: 'strict-pii',
        name: 'PII 检测',
        type: 'pii',
        enabled: true,
        checkPoint: 'output',
        config: { redact: true },
      },
      {
        id: 'strict-topic',
        name: '话题限制',
        type: 'topic',
        enabled: true,
        checkPoint: 'input',
        config: { allowedTopics: ['programming', 'technical'] },
      },
    ],
    hitlInterruptPoints: [
      { type: 'tool_confirm', toolName: '*', message: '所有工具调用需要人工确认' },
      { type: 'decision_point', toolName: '', message: '关键决策点需要人工确认' },
    ],
  },

  standard: {
    level: 'standard',
    name: '标准模式',
    description: '平衡安全与效率：允许文件读写，危险命令需要确认，启用基本护栏',
    config: {
      aclRules: [
        { agentId: '*', resource: '*', level: 'read', denied: false },
        { agentId: '*', resource: '*', level: 'write', denied: false },
        { agentId: '*', resource: '*', level: 'execute', denied: true },
      ],
      allowedCommands: [
        'git', 'npm', 'node', 'python', 'pip',
        'ls', 'cat', 'grep', 'find', 'head', 'tail',
        'mkdir', 'cp', 'mv', 'touch',
        'echo', 'pwd', 'which', 'where',
      ],
      blockedCommands: [
        'rm -rf', 'format', 'mkfs', 'dd',
        'shutdown', 'reboot',
        'sudo', 'su',
        'git push --force',
        'npm publish',
      ],
    },
    guardrailRules: [
      {
        id: 'standard-injection',
        name: '基本注入防护',
        type: 'injection',
        enabled: true,
        checkPoint: 'input',
        config: { sensitivity: 'medium' },
      },
    ],
    hitlInterruptPoints: [
      { type: 'tool_confirm', toolName: 'execute_command', message: 'Shell 命令执行需要确认' },
    ],
  },

  relaxed: {
    level: 'relaxed',
    name: '宽松模式',
    description: '最低限制：允许所有操作，自动批准工具调用，适合信任的本地开发环境',
    config: {
      aclRules: [
        { agentId: '*', resource: '*', level: 'all', denied: false },
      ],
      allowedCommands: ['*'],
      blockedCommands: [
        'rm -rf /',
        'format C:',
        'mkfs',
        'shutdown',
        'reboot',
      ],
    },
    guardrailRules: [],
    hitlInterruptPoints: [],
  },
}

export class SecurityService {
  private acl: ACL
  private sandbox: InstanceType<typeof Sandbox>
  private scopePolicy: FileScopePolicy
  private config: SandboxConfig
  // [SDK 集成] SDK CommandGuard — 命令白/黑名单 + 参数黑名单 + Shell 元字符检测
  private commandGuard: CommandGuard
  // [SDK 集成] SDK InputSanitizer — 输入消毒（空字节/Unicode 规范化/长度限制/模式过滤）
  private inputSanitizer: InputSanitizer

  constructor() {
    this.acl = new ACL()
    this.sandbox = new Sandbox(this.acl)
    this.scopePolicy = new FileScopePolicy()
    this.config = {
      aclRules: [],
      allowedCommands: [],
      blockedCommands: [],
    }

    // 默认安全策略: 仅允许所有 Agent 读取资源（最小权限原则）
    // 写入和执行权限需要通过 setConfig / addACLRule 显式授予
    this.acl.allow('*', '*', 'read')

    // [SDK 集成] 初始化 CommandGuard 和 InputSanitizer
    this.commandGuard = new CommandGuard()
    this.inputSanitizer = new InputSanitizer({ maxLength: 100_000 })
  }

  /**
   * 获取当前配置
   */
  getConfig(): SandboxConfig {
    return { ...this.config }
  }

  /**
   * 设置配置
   */
  setConfig(config: SandboxConfig): void {
    this.config = { ...config }

    // 重建 ACL
    this.acl.reset()
    for (const rule of config.aclRules) {
      if (rule.denied) {
        this.acl.deny(rule.agentId, rule.resource)
      } else {
        this.acl.allow(rule.agentId, rule.resource, rule.level)
      }
    }

    // 重建命令白名单/黑名单
    this.sandbox = new Sandbox(this.acl)
    for (const cmd of config.allowedCommands) {
      this.sandbox.allowCommand(cmd)
    }
    for (const cmd of config.blockedCommands) {
      this.sandbox.blockCommand(cmd)
    }
  }

  /**
   * 检查 Agent 是否有权访问资源
   */
  checkAccess(agentId: string, resource: string, level: AccessLevel): {
    allowed: boolean
    error?: string
  } {
    const err = this.sandbox.canAccess(agentId, resource, level)
    if (err) {
      return { allowed: false, error: err.message }
    }

    // 路径穿越防护
    const pathErr = this.sandbox.validatePath(agentId, resource, level)
    if (pathErr) {
      return { allowed: false, error: pathErr.message }
    }

    return { allowed: true }
  }

  /**
   * 检查 Agent 是否可以执行命令
   */
  checkCommand(agentId: string, cmd: string): {
    allowed: boolean
    error?: string
  } {
    const err = this.sandbox.canExecute(agentId, cmd)
    if (err) {
      return { allowed: false, error: err.message }
    }
    return { allowed: true }
  }

  /**
   * 设置 Agent 文件作用域
   */
  setAgentScope(agentId: string, paths: string[]): void {
    this.scopePolicy.setScope(agentId, paths)
  }

  /**
   * 获取 Agent 文件作用域
   */
  getAgentScope(agentId: string): string[] | undefined {
    return this.scopePolicy.getScope(agentId)
  }

  /**
   * 移除 Agent 文件作用域
   */
  removeAgentScope(agentId: string): void {
    this.scopePolicy.removeScope(agentId)
  }

  /**
   * 检查 Agent 是否可以访问指定路径 (scope 级别)
   */
  isPathInScope(agentId: string, path: string): boolean {
    return this.scopePolicy.allow(agentId, path)
  }

  /**
   * 验证多个 Agent 的 scope 是否存在冲突
   */
  validateScopes(scopes: Map<string, string[]>): { valid: boolean; error?: string } {
    const err = this.scopePolicy.validate(scopes)
    if (err) {
      return { valid: false, error: err.message }
    }
    return { valid: true }
  }

  /**
   * 添加 ACL 规则
   */
  addACLRule(rule: ACLRule): void {
    if (rule.denied) {
      this.acl.deny(rule.agentId, rule.resource)
    } else {
      this.acl.allow(rule.agentId, rule.resource, rule.level)
    }
    this.config.aclRules.push(rule)
  }

  /**
   * 允许命令
   */
  allowCommand(cmd: string): void {
    this.sandbox.allowCommand(cmd)
    if (!this.config.allowedCommands.includes(cmd)) {
      this.config.allowedCommands.push(cmd)
    }
  }

  /**
   * 阻止命令
   */
  blockCommand(cmd: string): void {
    this.sandbox.blockCommand(cmd)
    if (!this.config.blockedCommands.includes(cmd)) {
      this.config.blockedCommands.push(cmd)
    }
  }

  /**
   * 获取底层 ACL (供编排服务复用)
   */
  getACL(): ACL {
    return this.acl
  }

  /**
   * 获取底层 Sandbox
   */
  getSandbox(): InstanceType<typeof Sandbox> {
    return this.sandbox
  }

  /**
   * 获取底层 FileScopePolicy
   */
  getScopePolicy(): FileScopePolicy {
    return this.scopePolicy
  }

  // ===== [升级] 安全策略模板 =====

  /**
   * 列出所有可用安全策略模板
   */
  listPresets(): SecurityPreset[] {
    return Object.values(SECURITY_PRESETS)
  }

  /**
   * 获取单个安全策略模板
   */
  getPreset(level: SecurityPresetLevel): SecurityPreset | undefined {
    return SECURITY_PRESETS[level]
  }

  /**
   * 应用安全策略模板
   * 返回需要外部应用的配置（guardrailRules 和 hitlInterruptPoints 需要由对应服务应用）
   */
  applyPreset(level: SecurityPresetLevel): {
    applied: boolean
    preset: SecurityPreset
    sandboxConfig: SandboxConfig
    guardrailRules: GuardrailRuleConfig[]
    hitlInterruptPoints: HITLInterruptPoint[]
  } {
    const preset = SECURITY_PRESETS[level]
    if (!preset) {
      throw new Error(`未知的安全策略级别: ${level}`)
    }

    // 应用沙箱配置
    this.setConfig(preset.config)

    return {
      applied: true,
      preset,
      sandboxConfig: preset.config,
      guardrailRules: preset.guardrailRules,
      hitlInterruptPoints: preset.hitlInterruptPoints,
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }

  // ===== [SDK 集成] SDK 安全扩展 =====
  // containsShellMetacharacter / InputSanitizer / CommandGuard
  // 提供比 Sandbox.canExecute 更精细的命令安全检测

  /**
   * 检测命令中是否包含 Shell 元字符（; | & $ ` > < 换行等）
   * 防止命令注入攻击
   */
  checkShellMetacharacter(cmd: string): { found: boolean; char?: string } {
    return containsShellMetacharacter(cmd)
  }

  /**
   * 验证路径是否包含路径穿越攻击（.. / 空字节 / URL 编码穿越）
   */
  checkPathTraversal(path: string): { safe: boolean; reason?: string } {
    return validatePathTraversal(path)
  }

  /**
   * 安全路径解析 — 确保路径在指定根目录内，检测符号链接逃逸
   */
  resolvePathSafe(rootDir: string, filePath: string): { safe: boolean; resolved?: string; reason?: string } {
    return resolvePathSafe(rootDir, filePath)
  }

  /**
   * 输入消毒 — 去除空字节、Unicode 规范化、长度限制、模式过滤
   * 适用于用户输入 / Agent 输入的预处理
   */
  sanitizeInput(input: string): { safe: boolean; sanitized: string; issues: string[] } {
    return this.inputSanitizer.sanitize(input)
  }

  /**
   * 使用 SDK CommandGuard 检查命令安全性
   * 集成 Shell 元字符检测 + 命令白/黑名单 + 参数黑名单
   * 比 checkCommand 更严格，包含元字符和参数级检测
   */
  checkCommandGuard(command: string): { allowed: boolean; reason?: string } {
    return this.commandGuard.check(command)
  }

  /**
   * 添加命令到白名单
   */
  addWhitelistCommand(cmd: string): void {
    this.commandGuard.addToWhitelist(cmd)
  }

  /**
   * 添加命令到黑名单
   */
  addBlacklistCommand(cmd: string): void {
    this.commandGuard.addToBlacklist(cmd)
  }

  /**
   * 更新 CommandGuard 配置
   */
  setCommandGuardConfig(opts: { whitelist?: string[]; blacklist?: string[]; argBlacklist?: string[] }): void {
    this.commandGuard = new CommandGuard(opts)
  }
}
