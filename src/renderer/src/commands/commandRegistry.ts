// AELA — 命令注册表
// 所有可在命令面板中搜索和执行的命令
// 支持动态注册（插件/视图可在运行时添加命令）

import type { ViewType } from '../stores/viewStore'

export interface Command {
  /** 唯一 ID */
  id: string
  /** 显示名称（中英文混合，直接显示） */
  label: string
  /** 可选的分类 */
  category: 'navigation' | 'action' | 'settings' | 'agent'
  /** 可选的快捷键（显示用，实际绑定在 useKeyboardShortcuts 中） */
  shortcut?: string
  /** 可选的图标（emoji 或 SVG name） */
  icon?: string
  /** 执行命令的回调 */
  run: () => void
}

type CommandChangeListener = () => void

class CommandRegistryImpl {
  private commands = new Map<string, Command>()
  private listeners = new Set<CommandChangeListener>()

  /**
   * 注册一个命令
   */
  register(cmd: Command): void {
    this.commands.set(cmd.id, cmd)
    this.notifyListeners()
  }

  /**
   * 批量注册命令
   */
  registerAll(cmds: Command[]): void {
    for (const cmd of cmds) {
      this.commands.set(cmd.id, cmd)
    }
    this.notifyListeners()
  }

  /**
   * 注销一个命令
   */
  unregister(id: string): void {
    this.commands.delete(id)
    this.notifyListeners()
  }

  /**
   * 获取所有命令
   */
  list(): Command[] {
    return Array.from(this.commands.values())
  }

  /**
   * 模糊搜索命令（按 label 匹配）
   */
  search(query: string): Command[] {
    if (!query.trim()) return this.list()
    const q = query.toLowerCase().trim()
    return this.list().filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.id.toLowerCase().includes(q)
    )
  }

  /**
   * 执行命令
   */
  execute(id: string): boolean {
    const cmd = this.commands.get(id)
    if (cmd) {
      cmd.run()
      return true
    }
    return false
  }

  /**
   * 订阅命令列表变更
   */
  subscribe(listener: CommandChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export const commandRegistry = new CommandRegistryImpl()

/**
 * 创建导航命令
 */
export function createNavigationCommand(id: string, label: string, view: ViewType, setView: (v: ViewType) => void, shortcut?: string): Command {
  return {
    id,
    label,
    category: 'navigation',
    shortcut,
    icon: '→',
    run: () => setView(view),
  }
}
