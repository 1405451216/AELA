/**
 * PluginService 单元测试
 *
 * 覆盖: 插件加载 / 启用禁用 / 配置管理 / hooks/tools/skills 获取 / 订阅
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { PluginService } from '../../src/main/services/PluginService'

// mock electron app.getPath
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => join(tmpdir(), 'aela-test-plugins')),
  },
}))

describe('PluginService', () => {
  let service: PluginService
  let pluginsDir: string

  beforeEach(async () => {
    pluginsDir = await mkdtemp(join(tmpdir(), 'aela-plugin-'))
    service = new PluginService()
    // 覆盖插件目录为临时目录
    ;(service as any).pluginsDir = pluginsDir
  })

  afterEach(async () => {
    await rm(pluginsDir, { recursive: true, force: true })
  })

  // ===== 辅助函数 =====

  async function createTestPlugin(
    name: string,
    manifest: object,
  ): Promise<string> {
    const pluginDir = join(pluginsDir, name)
    await mkdir(pluginDir, { recursive: true })
    await writeFile(join(pluginDir, 'manifest.json'), JSON.stringify(manifest), 'utf8')
    return pluginDir
  }

  // ===== 插件加载 =====

  describe('插件加载', () => {
    it('空目录应返回空列表', async () => {
      const plugins = await service.loadInstalledPlugins()
      expect(plugins).toEqual([])
    })

    it('应加载有效的插件', async () => {
      await createTestPlugin('test-plugin', {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
      })

      const plugins = await service.loadInstalledPlugins()
      expect(plugins.length).toBe(1)
      expect(plugins[0].manifest.name).toBe('test-plugin')
      expect(plugins[0].manifest.version).toBe('1.0.0')
      expect(plugins[0].enabled).toBe(true)
    })

    it('应跳过无效的 manifest', async () => {
      const pluginDir = join(pluginsDir, 'bad-plugin')
      await mkdir(pluginDir, { recursive: true })
      await writeFile(join(pluginDir, 'manifest.json'), 'not valid json', 'utf8')

      const plugins = await service.loadInstalledPlugins()
      expect(plugins.length).toBe(0)
    })

    it('应跳过没有 manifest.json 的目录', async () => {
      const pluginDir = join(pluginsDir, 'no-manifest')
      await mkdir(pluginDir, { recursive: true })
      await writeFile(join(pluginDir, 'index.js'), 'module.exports = {}', 'utf8')

      const plugins = await service.loadInstalledPlugins()
      expect(plugins.length).toBe(0)
    })

    it('应加载多个插件', async () => {
      await createTestPlugin('plugin-a', { name: 'plugin-a', version: '1.0.0', description: 'A' })
      await createTestPlugin('plugin-b', { name: 'plugin-b', version: '2.0.0', description: 'B' })
      await createTestPlugin('plugin-c', { name: 'plugin-c', version: '3.0.0', description: 'C' })

      const plugins = await service.loadInstalledPlugins()
      expect(plugins.length).toBe(3)
    })

    it('应跳过文件（非目录）', async () => {
      await writeFile(join(pluginsDir, 'not-a-directory.txt'), 'file content', 'utf8')
      await createTestPlugin('valid-plugin', { name: 'valid', version: '1.0.0', description: 'V' })

      const plugins = await service.loadInstalledPlugins()
      expect(plugins.length).toBe(1)
      expect(plugins[0].manifest.name).toBe('valid')
    })
  })

  // ===== 插件列表 =====

  describe('插件列表', () => {
    it('listPlugins 应返回所有已加载插件', async () => {
      await createTestPlugin('p1', { name: 'p1', version: '1.0.0', description: '1' })
      await service.loadInstalledPlugins()

      const list = service.listPlugins()
      expect(list.length).toBe(1)
    })

    it('getPlugin 应返回指定插件', async () => {
      await createTestPlugin('findable', { name: 'findable', version: '1.0.0', description: 'F' })
      await service.loadInstalledPlugins()

      const plugin = service.getPlugin('findable')
      expect(plugin).not.toBeNull()
      expect(plugin!.manifest.name).toBe('findable')
    })

    it('getPlugin 不存在的插件应返回 null', () => {
      expect(service.getPlugin('nonexistent')).toBeNull()
    })
  })

  // ===== 启用/禁用 =====

  describe('启用/禁用', () => {
    beforeEach(async () => {
      await createTestPlugin('toggle-plugin', { name: 'toggle-plugin', version: '1.0.0', description: 'T' })
      await service.loadInstalledPlugins()
    })

    it('默认应启用', () => {
      const plugin = service.getPlugin('toggle-plugin')
      expect(plugin!.enabled).toBe(true)
    })

    it('setEnabled(false) 应禁用', () => {
      expect(service.setEnabled('toggle-plugin', false)).toBe(true)
      expect(service.getPlugin('toggle-plugin')!.enabled).toBe(false)
    })

    it('setEnabled(true) 应重新启用', () => {
      service.setEnabled('toggle-plugin', false)
      service.setEnabled('toggle-plugin', true)
      expect(service.getPlugin('toggle-plugin')!.enabled).toBe(true)
    })

    it('设置不存在的插件应返回 false', () => {
      expect(service.setEnabled('nonexistent', false)).toBe(false)
    })

    it('禁用变更应通知订阅者', () => {
      const listener = vi.fn()
      service.subscribe(listener)
      service.setEnabled('toggle-plugin', false)
      expect(listener).toHaveBeenCalled()
    })
  })

  // ===== 配置管理 =====

  describe('配置管理', () => {
    beforeEach(async () => {
      await createTestPlugin('config-plugin', { name: 'config-plugin', version: '1.0.0', description: 'C' })
      await service.loadInstalledPlugins()
    })

    it('setConfig 应更新配置', () => {
      expect(service.setConfig('config-plugin', { apiKey: 'secret123' })).toBe(true)
      expect(service.getConfig('config-plugin')).toEqual({ apiKey: 'secret123' })
    })

    it('setConfig 应合并配置', () => {
      service.setConfig('config-plugin', { key1: 'value1' })
      service.setConfig('config-plugin', { key2: 'value2' })
      expect(service.getConfig('config-plugin')).toEqual({ key1: 'value1', key2: 'value2' })
    })

    it('setConfig 不存在的插件应返回 false', () => {
      expect(service.setConfig('nonexistent', { key: 'val' })).toBe(false)
    })

    it('getConfig 不存在的插件应返回 null', () => {
      expect(service.getConfig('nonexistent')).toBeNull()
    })
  })

  // ===== Hooks / Tools / Skills =====

  describe('Hooks / Tools / Skills 获取', () => {
    it('应获取已启用插件的 hooks', async () => {
      await createTestPlugin('hook-plugin', {
        name: 'hook-plugin',
        version: '1.0.0',
        description: 'H',
        hooks: {
          before_llm: 'hooks/beforeLlm.js',
          after_tool: 'hooks/afterTool.js',
        },
      })
      await service.loadInstalledPlugins()

      const hooks = service.getEnabledHooks()
      expect(hooks.before_llm).toBeDefined()
      expect(hooks.before_llm.length).toBe(1)
      expect(hooks.before_llm[0].pluginId).toBe('hook-plugin')
      expect(hooks.after_tool).toBeDefined()
    })

    it('禁用插件的 hooks 不应被返回', async () => {
      await createTestPlugin('disabled-hook', {
        name: 'disabled-hook',
        version: '1.0.0',
        description: 'D',
        hooks: { before_llm: 'hooks/before.js' },
      })
      await service.loadInstalledPlugins()
      service.setEnabled('disabled-hook', false)

      const hooks = service.getEnabledHooks()
      expect(hooks.before_llm || []).toEqual([])
    })

    it('应获取已启用插件的 tools', async () => {
      await createTestPlugin('tool-plugin', {
        name: 'tool-plugin',
        version: '1.0.0',
        description: 'T',
        tools: ['tools/myTool.js', 'tools/anotherTool.js'],
      })
      await service.loadInstalledPlugins()

      const tools = service.getEnabledTools()
      expect(tools.length).toBe(2)
      expect(tools[0].pluginId).toBe('tool-plugin')
    })

    it('应获取已启用插件的 skills', async () => {
      await createTestPlugin('skill-plugin', {
        name: 'skill-plugin',
        version: '1.0.0',
        description: 'S',
        skills: ['skills/mySkill.md'],
      })
      await service.loadInstalledPlugins()

      const skills = service.getEnabledSkills()
      expect(skills.length).toBe(1)
      expect(skills[0].pluginId).toBe('skill-plugin')
    })

    it('无 hooks/tools/skills 的插件应返回空', async () => {
      await createTestPlugin('bare-plugin', {
        name: 'bare-plugin',
        version: '1.0.0',
        description: 'B',
      })
      await service.loadInstalledPlugins()

      expect(service.getEnabledHooks()).toEqual({})
      expect(service.getEnabledTools()).toEqual([])
      expect(service.getEnabledSkills()).toEqual([])
    })
  })

  // ===== 统计 =====

  describe('统计信息', () => {
    it('应返回正确的统计', async () => {
      await createTestPlugin('s1', { name: 's1', version: '1.0.0', description: '1' })
      await createTestPlugin('s2', { name: 's2', version: '1.0.0', description: '2' })
      await createTestPlugin('s3', { name: 's3', version: '1.0.0', description: '3' })
      await service.loadInstalledPlugins()

      service.setEnabled('s2', false)

      const stats = service.getStats()
      expect(stats.total).toBe(3)
      expect(stats.enabled).toBe(2)
      expect(stats.disabled).toBe(1)
    })

    it('空服务应返回零统计', () => {
      const stats = service.getStats()
      expect(stats.total).toBe(0)
      expect(stats.enabled).toBe(0)
      expect(stats.disabled).toBe(0)
    })
  })

  // ===== 订阅 =====

  describe('订阅', () => {
    it('应支持订阅插件变更', () => {
      const listener = vi.fn()
      const unsubscribe = service.subscribe(listener)

      expect(typeof unsubscribe).toBe('function')

      // 触发通知
      service.setEnabled('nonexistent', false) // 返回 false 不触发
      expect(listener).not.toHaveBeenCalled()

      unsubscribe()
    })
  })

  // ===== 生命周期 =====

  describe('生命周期', () => {
    it('stop 不应抛出异常', () => {
      expect(() => service.stop()).not.toThrow()
    })

    it('stop 应清理监听器', () => {
      const listener = vi.fn()
      service.subscribe(listener)
      service.stop()
      // 停止后监听器应被清理
    })
  })
})
