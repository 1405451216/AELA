/**
 * ToolManager 单元测试
 *
 * 覆盖: 内置工具注册/开关 / 工具缓存 / Skill 工具 / 工作区切换 / 命令风险分级
 * 使用真实临时目录 + 真实 SDK ToolRegistry，避免 mock
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ToolManager, type ShellConfirmCallback } from '../../src/main/services/ToolManager'
import type { ShellConfirmRequest, ShellConfirmResponse } from '@shared/types'

describe('ToolManager', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aela-tm-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  // ===== 构造与内置工具 =====

  describe('构造与内置工具', () => {
    it('应注册 21 个内置工具（12 基础 + 9 Agent 能力）', () => {
      const tm = new ToolManager(tempDir)
      const tools = tm.listBuiltinTools()
      expect(tools.length).toBe(21)
    })

    it('内置工具应包含正确的分类', () => {
      const tm = new ToolManager(tempDir)
      const tools = tm.listBuiltinTools()

      const categories = new Set(tools.map(t => t.category))
      expect(categories.has('filesystem')).toBe(true)
      expect(categories.has('shell')).toBe(true)
      expect(categories.has('web')).toBe(true)
      expect(categories.has('data')).toBe(true)
      expect(categories.has('utility')).toBe(true)
      expect(categories.has('agent')).toBe(true)
    })

    it('所有内置工具默认启用', () => {
      const tm = new ToolManager(tempDir)
      const tools = tm.listBuiltinTools()
      expect(tools.every(t => t.enabled)).toBe(true)
    })

    it('read_file 工具应有正确的名称和描述', () => {
      const tm = new ToolManager(tempDir)
      const tools = tm.listBuiltinTools()
      const readFileTool = tools.find(t => t.name === 'read_file')
      expect(readFileTool).toBeDefined()
      expect(readFileTool!.category).toBe('filesystem')
      expect(readFileTool!.description).toBeTruthy()
    })

    it('execute_command 工具应为 shell 分类', () => {
      const tm = new ToolManager(tempDir)
      const tools = tm.listBuiltinTools()
      const shellTool = tools.find(t => t.name === 'execute_command')
      expect(shellTool).toBeDefined()
      expect(shellTool!.category).toBe('shell')
    })
  })

  // ===== 工具开关 =====

  describe('toggleBuiltinTool', () => {
    it('禁用工具后该工具不应出现在列表中', () => {
      const tm = new ToolManager(tempDir)
      tm.toggleBuiltinTool('calculator', false)

      const allTools = tm.listTools()
      expect(allTools.find(t => t.name === 'calculator')).toBeUndefined()
    })

    it('重新启用工具后该工具应出现在列表中', () => {
      const tm = new ToolManager(tempDir)
      tm.toggleBuiltinTool('calculator', false)
      tm.toggleBuiltinTool('calculator', true)

      const allTools = tm.listTools()
      expect(allTools.find(t => t.name === 'calculator')).toBeDefined()
    })

    it('禁用工具后内置工具列表仍包含该工具但 enabled 为 false', () => {
      const tm = new ToolManager(tempDir)
      tm.toggleBuiltinTool('datetime', false)

      const builtinTools = tm.listBuiltinTools()
      const dtTool = builtinTools.find(t => t.name === 'datetime')
      expect(dtTool).toBeDefined()
      expect(dtTool!.enabled).toBe(false)
    })
  })

  // ===== Skill 工具 =====

  describe('Skill 工具注册', () => {
    it('registerSkillAsTool 应将 skill 注册为工具', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({
        id: 'skill_1',
        name: 'My Skill',
        description: 'A test skill',
        content: 'Skill content here',
      })

      const tools = tm.listTools()
      expect(tools.find(t => t.name === 'skill_my_skill')).toBeDefined()
    })

    it('registerSkillAsTool 应使用自定义 toolName', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({
        id: 'skill_2',
        name: 'Custom Name',
        description: 'Custom skill',
        content: 'Content',
        toolName: 'my_custom_tool',
      })

      const tools = tm.listTools()
      expect(tools.find(t => t.name === 'skill_my_custom_tool')).toBeDefined()
    })

    it('unregisterSkillAsTool 应移除 skill 工具', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({
        id: 'skill_3',
        name: 'Removable',
        description: 'Will be removed',
        content: 'Content',
      })

      expect(tm.listTools().find(t => t.name === 'skill_removable')).toBeDefined()

      tm.unregisterSkillAsTool({ id: 'skill_3', name: 'Removable' })
      expect(tm.listTools().find(t => t.name === 'skill_removable')).toBeUndefined()
    })

    it('getRegisteredSkillTools 应返回已注册的 skill 列表', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({
        id: 's1', name: 'Skill One', description: 'desc1', content: 'c1',
      })
      tm.registerSkillAsTool({
        id: 's2', name: 'Skill Two', description: 'desc2', content: 'c2',
      })

      const skills = tm.getRegisteredSkillTools()
      expect(skills.length).toBe(2)
    })

    it('clearSkillTools 应移除所有 skill 工具', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({ id: 's1', name: 'A', description: 'd', content: 'c' })
      tm.registerSkillAsTool({ id: 's2', name: 'B', description: 'd', content: 'c' })

      tm.clearSkillTools()
      expect(tm.getRegisteredSkillTools().length).toBe(0)
    })

    it('重复注册同一 skill 应替换而非追加', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({ id: 's1', name: 'Same', description: 'v1', content: 'c1' })
      tm.registerSkillAsTool({ id: 's1', name: 'Same', description: 'v2', content: 'c2' })

      const skills = tm.getRegisteredSkillTools()
      expect(skills.length).toBe(1)
    })
  })

  // ===== 工作区切换 =====

  describe('工作区切换', () => {
    it('getRootDir 应返回当前工作区根目录', () => {
      const tm = new ToolManager(tempDir)
      expect(tm.getRootDir()).toBe(tempDir)
    })

    it('setRootDir 应更新工作区根目录', () => {
      const tm = new ToolManager(tempDir)
      const newDir = join(tempDir, 'subdir')
      tm.setRootDir(newDir)
      expect(tm.getRootDir()).toBe(newDir)
    })

    it('setRootDir 后内置工具仍可用', () => {
      const tm = new ToolManager(tempDir)
      tm.setRootDir(join(tempDir, 'other'))
      const tools = tm.listBuiltinTools()
      expect(tools.length).toBe(21)
    })

    it('setRootDir 后 skill 工具应保留', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({ id: 's1', name: 'X', description: 'd', content: 'c' })
      tm.setRootDir(join(tempDir, 'other'))
      expect(tm.getRegisteredSkillTools().length).toBe(1)
    })
  })

  // ===== Shell 确认回调 =====

  describe('Shell 确认回调', () => {
    it('setConfirmCallback 不应抛出异常', () => {
      const tm = new ToolManager(tempDir)
      const cb: ShellConfirmCallback = async (_req: ShellConfirmRequest): Promise<ShellConfirmResponse> => {
        return { approved: true }
      }
      expect(() => tm.setConfirmCallback(cb)).not.toThrow()
    })

    it('resetSessionApprovals 不应抛出异常', () => {
      const tm = new ToolManager(tempDir)
      expect(() => tm.resetSessionApprovals()).not.toThrow()
    })
  })

  // ===== 工具注册表 =====

  describe('工具注册表', () => {
    it('getRegistry 应返回 ToolRegistry 实例', () => {
      const tm = new ToolManager(tempDir)
      const registry = tm.getRegistry()
      expect(registry).toBeDefined()
      expect(typeof registry.list).toBe('function')
      expect(typeof registry.register).toBe('function')
    })

    it('listTools 应返回所有已注册工具（内置 + skill）', () => {
      const tm = new ToolManager(tempDir)
      tm.registerSkillAsTool({ id: 's1', name: 'Extra', description: 'd', content: 'c' })

      const tools = tm.listTools()
      // 12 内置 + 1 skill = 13
      expect(tools.length).toBe(13)
    })
  })

  // ===== 内置工具执行 (使用真实文件系统) =====

  describe('内置工具执行', () => {
    it('read_file 应读取文件内容', async () => {
      const tm = new ToolManager(tempDir)
      await writeFile(join(tempDir, 'test.txt'), 'hello world')

      const registry = tm.getRegistry()
      const tools = registry.list()
      const readFileTool = tools.find(t => t.name === 'read_file')
      expect(readFileTool).toBeDefined()

      const result = await readFileTool!.execute({ path: 'test.txt' })
      expect(result).toContain('hello world')
    })

    it('write_file 应写入文件内容', async () => {
      const tm = new ToolManager(tempDir)
      const registry = tm.getRegistry()
      const tools = registry.list()
      const writeFileTool = tools.find(t => t.name === 'write_file')
      expect(writeFileTool).toBeDefined()

      await writeFileTool!.execute({ path: 'output.txt', content: 'written content' })
      const content = await readFile(join(tempDir, 'output.txt'), 'utf-8')
      expect(content).toBe('written content')
    })

    it('write_file 应自动创建嵌套目录', async () => {
      const tm = new ToolManager(tempDir)
      const registry = tm.getRegistry()
      const writeFileTool = registry.list().find(t => t.name === 'write_file')!

      await writeFileTool.execute({ path: 'nested/dir/file.txt', content: 'deep' })
      const content = await readFile(join(tempDir, 'nested/dir/file.txt'), 'utf-8')
      expect(content).toBe('deep')
    })

    it('list_directory 应列出目录内容', async () => {
      const tm = new ToolManager(tempDir)
      await mkdir(join(tempDir, 'subfolder'), { recursive: true })
      await writeFile(join(tempDir, 'file1.txt'), 'a')
      await writeFile(join(tempDir, 'file2.ts'), 'b')

      const listDirTool = tm.getRegistry().list().find(t => t.name === 'list_directory')!
      const result = await listDirTool.execute({})
      expect(result).toContain('file1.txt')
      expect(result).toContain('file2.ts')
      expect(result).toContain('subfolder')
    })

    it('list_directory 应跳过隐藏文件和 node_modules', async () => {
      const tm = new ToolManager(tempDir)
      await mkdir(join(tempDir, '.hidden'), { recursive: true })
      await mkdir(join(tempDir, 'node_modules'), { recursive: true })
      await writeFile(join(tempDir, 'visible.txt'), 'a')

      const listDirTool = tm.getRegistry().list().find(t => t.name === 'list_directory')!
      const result = await listDirTool.execute({})
      expect(result).toContain('visible.txt')
      expect(result).not.toContain('.hidden')
      expect(result).not.toContain('node_modules')
    })

    it('calculator 应正确计算数学表达式', async () => {
      const tm = new ToolManager(tempDir)
      const calcTool = tm.getRegistry().list().find(t => t.name === 'calculator')!
      const result = await calcTool.execute({ expression: '2+3*4' })
      expect(result).toContain('14')
    })

    it('datetime 应返回当前时间', async () => {
      const tm = new ToolManager(tempDir)
      const dtTool = tm.getRegistry().list().find(t => t.name === 'datetime')!
      const result = await dtTool.execute({})
      expect(result).toBeTruthy()
      expect(result.length).toBeGreaterThan(5)
    })

    it('load_json 应解析 JSON 文件', async () => {
      const tm = new ToolManager(tempDir)
      await writeFile(join(tempDir, 'data.json'), JSON.stringify({ name: 'test', value: 42 }))

      const jsonTool = tm.getRegistry().list().find(t => t.name === 'load_json')!
      const result = await jsonTool.execute({ path: 'data.json' })
      expect(result).toContain('test')
      expect(result).toContain('42')
    })

    it('load_markdown 应提取标题结构', async () => {
      const tm = new ToolManager(tempDir)
      await writeFile(join(tempDir, 'doc.md'), '# Title\n\n## Section\n\nContent here.\n\n### Subsection')

      const mdTool = tm.getRegistry().list().find(t => t.name === 'load_markdown')!
      const result = await mdTool.execute({ path: 'doc.md' })
      expect(result).toContain('# Title')
      expect(result).toContain('## Section')
      expect(result).toContain('### Subsection')
    })

    it('load_csv 应解析 CSV 文件', async () => {
      const tm = new ToolManager(tempDir)
      await writeFile(join(tempDir, 'data.csv'), 'name,age\nAlice,30\nBob,25')

      const csvTool = tm.getRegistry().list().find(t => t.name === 'load_csv')!
      const result = await csvTool.execute({ path: 'data.csv' })
      expect(result).toContain('name')
      expect(result).toContain('age')
      expect(result).toContain('Alice')
      expect(result).toContain('30')
    })
  })

  // ===== 路径解析 =====

  describe('路径解析', () => {
    it('相对路径应相对于工作区根目录解析', async () => {
      const tm = new ToolManager(tempDir)
      await writeFile(join(tempDir, 'relative.txt'), 'relative content')

      const readFileTool = tm.getRegistry().list().find(t => t.name === 'read_file')!
      const result = await readFileTool.execute({ path: 'relative.txt' })
      expect(result).toContain('relative content')
    })

    it('绝对路径应直接使用', async () => {
      const tm = new ToolManager(tempDir)
      const absPath = join(tempDir, 'absolute.txt')
      await writeFile(absPath, 'absolute content')

      const readFileTool = tm.getRegistry().list().find(t => t.name === 'read_file')!
      const result = await readFileTool.execute({ path: absPath })
      expect(result).toContain('absolute content')
    })
  })

  // ===== close =====

  describe('close', () => {
    it('close 不应抛出异常', async () => {
      const tm = new ToolManager(tempDir)
      await expect(tm.close()).resolves.not.toThrow()
    })
  })

  // ===== 大文件 diff 降级 =====

  describe('大文件 diff 降级保护', () => {
    it('getFileDiff 对超大文件应能安全返回结果（不 OOM）', async () => {
      const tm = new ToolManager(tempDir)
      const sessionId = 'diff-session'
      tm.setSessionContext(sessionId, 'test-agent')

      // 创建两个 1500 行的文件（m*n = 2,250,000 > MAX_DIFF_CELLS=2,000,000）
      const lines = Array.from({ length: 1500 }, (_, i) => `line ${i + 1}`).join('\n')
      const modifiedLines = Array.from({ length: 1500 }, (_, i) =>
        i % 5 === 0 ? `MODIFIED ${i + 1}` : `line ${i + 1}`
      ).join('\n')

      const filePath = join(tempDir, 'big.txt')
      await writeFile(filePath, lines)

      // 触发 captureBeforeWrite + write
      const writeTool = tm.getRegistry().list().find(t => t.name === 'write_file')!
      await writeTool.execute({ path: filePath, content: modifiedLines })

      // 取出 FileChangeRecord → 用 getFileDiff 得到 diff
      const records = tm.getFileChanges(sessionId)
      expect(records.length).toBe(1)
      const diff = tm.getFileDiff(records[0].id)

      // 降级路径应仍能返回非 null 结果（O(m+n) 内存）
      expect(diff).not.toBeNull()
      expect(diff!.length).toBeGreaterThan(0)

      // 修改的行（每 5 行一行）应被标记为 removed + added
      // 降级算法：共同前缀为 0（line 1 立即不同），共同后缀取决于尾部是否相同
      const removedCount = diff!.filter(d => d.type === 'removed').length
      const addedCount = diff!.filter(d => d.type === 'added').length
      // 至少有改动行被标记（不强制 300 — 降级算法按对齐可能把相同后缀识别为 context）
      expect(removedCount).toBeGreaterThan(0)
      expect(addedCount).toBeGreaterThan(0)
      // 总行数 = removed + added + context，应等于原始或修改后的总行数
      expect(removedCount + addedCount + diff!.filter(d => d.type === 'context').length)
        .toBeGreaterThanOrEqual(1500)

      tm.close()
    })

    it('小文件 diff 应使用 LCS 精确算法', async () => {
      const tm = new ToolManager(tempDir)
      const sessionId = 'small-diff-session'
      tm.setSessionContext(sessionId, 'test-agent')

      const filePath = join(tempDir, 'small.txt')
      await writeFile(filePath, 'a\nb\nc')

      const writeTool = tm.getRegistry().list().find(t => t.name === 'write_file')!
      await writeTool.execute({ path: filePath, content: 'a\nB\nc' })

      const records = tm.getFileChanges(sessionId)
      const diff = tm.getFileDiff(records[0].id)
      expect(diff).not.toBeNull()
      // LCS 精确：a,c 是 context（2 条），b→B 是 1 removed + 1 added
      expect(diff!.filter(d => d.type === 'context').length).toBe(2)
      expect(diff!.filter(d => d.type === 'removed').length).toBe(1)
      expect(diff!.filter(d => d.type === 'added').length).toBe(1)

      tm.close()
    })
  })
})
