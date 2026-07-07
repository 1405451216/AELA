// AELA — 插件系统服务
// 提供用户级插件管理：安装、卸载、启用/禁用、配置
// 插件格式：包含 manifest.json 的目录或 npm 包
//
// 插件 manifest.json 格式：
// {
//   "name": "my-plugin",
//   "version": "1.0.0",
//   "description": "My custom plugin",
//   "author": "Author Name",
//   "main": "index.js",
//   "hooks": {
//     "before_llm": "hooks/beforeLlm.js",
//     "after_tool": "hooks/afterTool.js"
//   },
//   "tools": ["tools/myTool.js"],
//   "skills": ["skills/mySkill.md"],
//   "config": {
//     "apiKey": { "type": "string", "required": true }
//   }
// }

import { join } from 'node:path'
import { readFile, readdir, stat, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'

export interface PluginManifest {
  name: string
  version: string
  description: string
  author?: string
  main?: string
  hooks?: Record<string, string>
  tools?: string[]
  skills?: string[]
  config?: Record<string, { type: string; required?: boolean; default?: unknown }>
}

export interface Plugin {
  id: string
  manifest: PluginManifest
  enabled: boolean
  installedAt: string
  config: Record<string, unknown>
  /** 插件目录路径 */
  dir: string
}

export interface PluginMarketplaceItem {
  name: string
  version: string
  description: string
  author: string
  downloads: number
  rating: number
}

export class PluginService {
  private plugins = new Map<string, Plugin>()
  private pluginsDir: string
  private listeners = new Set<() => void>()

  constructor() {
    this.pluginsDir = join(app.getPath('userData'), 'plugins')
    this.ensurePluginsDir()
  }

  /**
   * 确保插件目录存在
   */
  private async ensurePluginsDir(): Promise<void> {
    if (!existsSync(this.pluginsDir)) {
      await mkdir(this.pluginsDir, { recursive: true })
    }
  }

  /**
   * 加载所有已安装的插件
   */
  async loadInstalledPlugins(): Promise<Plugin[]> {
    await this.ensurePluginsDir()
    this.plugins.clear()

    try {
      const entries = await readdir(this.pluginsDir)
      for (const entry of entries) {
        const pluginDir = join(this.pluginsDir, entry)
        const statResult = await stat(pluginDir)
        if (!statResult.isDirectory()) continue

        const manifestPath = join(pluginDir, 'manifest.json')
        if (!existsSync(manifestPath)) continue

        try {
          const manifestContent = await readFile(manifestPath, 'utf8')
          const manifest: PluginManifest = JSON.parse(manifestContent)

          const plugin: Plugin = {
            id: manifest.name || randomUUID(),
            manifest,
            enabled: true,
            installedAt: new Date().toISOString(),
            config: {},
            dir: pluginDir,
          }

          this.plugins.set(plugin.id, plugin)
        } catch {
          // 跳过无效的 manifest
        }
      }
    } catch {
      // 目录不存在或读取失败
    }

    return this.listPlugins()
  }

  /**
   * 列出所有已安装插件
   */
  listPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  /**
   * 获取单个插件
   */
  getPlugin(id: string): Plugin | null {
    return this.plugins.get(id) || null
  }

  /**
   * 启用/禁用插件
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const plugin = this.plugins.get(id)
    if (!plugin) return false
    plugin.enabled = enabled
    this.notifyListeners()
    return true
  }

  /**
   * 更新插件配置
   */
  setConfig(id: string, config: Record<string, unknown>): boolean {
    const plugin = this.plugins.get(id)
    if (!plugin) return false
    plugin.config = { ...plugin.config, ...config }
    return true
  }

  /**
   * 获取插件配置
   */
  getConfig(id: string): Record<string, unknown> | null {
    const plugin = this.plugins.get(id)
    return plugin ? plugin.config : null
  }

  /**
   * 获取所有已启用插件的 hooks
   */
  getEnabledHooks(): Record<string, Array<{ pluginId: string; hookPath: string }>> {
    const result: Record<string, Array<{ pluginId: string; hookPath: string }>> = {}
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.hooks) continue
      for (const [hookName, hookPath] of Object.entries(plugin.manifest.hooks)) {
        if (!result[hookName]) result[hookName] = []
        result[hookName].push({ pluginId: plugin.id, hookPath: join(plugin.dir, hookPath) })
      }
    }
    return result
  }

  /**
   * 获取所有已启用插件的 tools
   */
  getEnabledTools(): Array<{ pluginId: string; toolPath: string }> {
    const result: Array<{ pluginId: string; toolPath: string }> = []
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.tools) continue
      for (const toolPath of plugin.manifest.tools) {
        result.push({ pluginId: plugin.id, toolPath: join(plugin.dir, toolPath) })
      }
    }
    return result
  }

  /**
   * 获取所有已启用插件的 skills
   */
  getEnabledSkills(): Array<{ pluginId: string; skillPath: string }> {
    const result: Array<{ pluginId: string; skillPath: string }> = []
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.skills) continue
      for (const skillPath of plugin.manifest.skills) {
        result.push({ pluginId: plugin.id, skillPath: join(plugin.dir, skillPath) })
      }
    }
    return result
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; enabled: number; disabled: number } {
    let enabled = 0
    for (const p of this.plugins.values()) {
      if (p.enabled) enabled++
    }
    return { total: this.plugins.size, enabled, disabled: this.plugins.size - enabled }
  }

  /**
   * 订阅插件列表变更
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  stop(): void {
    this.listeners.clear()
  }
}
