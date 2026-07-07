/**
 * SkillScanner 单元测试
 * 
 * 通过 AELA_WORKSPACE_PATH 环境变量指向临时目录，避免 mock node:os
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillScanner, getSkillScanner } from '../../src/main/services/SkillScanner'

// Helper: 在指定目录下创建技能文件结构
async function createSkillFiles(baseDir: string) {
  // Skill 1: 完整 frontmatter 的 SKILL.md
  const skill1Dir = join(baseDir, 'my-skill')
  await mkdir(skill1Dir, { recursive: true })
  await writeFile(
    join(skill1Dir, 'SKILL.md'),
    '---\nname: My Skill\ndescription: A test skill for unit testing\ntags: [test, unit, mock]\ntrigger: when user asks for test\nas_tool: true\ntool_name: my_skill_tool\ntool_description: Executes a test skill\n---\n\n# My Skill\n\nThis is the body content of the test skill.\n\n## Instructions\n\n- Do thing A\n- Do thing B\n'
  )

  // Skill 2: 无 frontmatter 的 SKILL.md
  const skill2Dir = join(baseDir, 'simple-skill')
  await mkdir(skill2Dir, { recursive: true })
  await writeFile(
    join(skill2Dir, 'SKILL.md'),
    '# Simple Skill\n\nThis is a simple skill without frontmatter.\n\nJust some plain text instructions.\n'
  )

  // Skill 3: 独立 .md 文件
  await writeFile(
    join(baseDir, 'standalone-skill.md'),
    '---\nname: Standalone\ndescription: A standalone markdown skill\n---\n\n# Standalone Skill\n\nContent here.\n'
  )

  // Skill 4: 嵌套目录中的 SKILL.md
  const nestedDir = join(baseDir, 'category', 'nested-skill')
  await mkdir(nestedDir, { recursive: true })
  await writeFile(
    join(nestedDir, 'SKILL.md'),
    '---\nname: Nested Skill\ndescription: A skill in a nested directory\n---\n\n# Nested Skill\n\nNested content.\n'
  )

  // 非 .md 文件（应被忽略）
  await writeFile(join(baseDir, 'readme.txt'), 'not a skill')

  // 隐藏目录（应被忽略）
  const hiddenDir = join(baseDir, '.hidden')
  await mkdir(hiddenDir, { recursive: true })
  await writeFile(
    join(hiddenDir, 'SKILL.md'),
    '---\nname: Hidden Skill\n---\n\nShould not be loaded.\n'
  )
}

// 测试用技能名称前缀，避免与用户真实技能冲突
const TEST_PREFIX = 'AELA_TEST_'

describe('SkillScanner', () => {
  let tempWorkspace: string
  let wsSkillsDir: string
  let prevEnv: string | undefined

  beforeEach(async () => {
    tempWorkspace = await mkdtemp(join(tmpdir(), 'aela-ws-'))
    // 设置环境变量，让扫描器扫描工作区目录
    prevEnv = process.env['AELA_WORKSPACE_PATH']
    process.env['AELA_WORKSPACE_PATH'] = tempWorkspace

    // 创建 .aela/skills 目录并放入技能文件
    wsSkillsDir = join(tempWorkspace, '.aela', 'skills')
    await mkdir(wsSkillsDir, { recursive: true })
    await createSkillFiles(wsSkillsDir)
  })

  afterEach(async () => {
    // 恢复环境变量
    if (prevEnv === undefined) {
      delete process.env['AELA_WORKSPACE_PATH']
    } else {
      process.env['AELA_WORKSPACE_PATH'] = prevEnv
    }
    await rm(tempWorkspace, { recursive: true, force: true })
  })

  // 辅助：从扫描结果中筛选出工作区下的技能（排除用户全局目录的技能）
  function filterWorkspaceSkills(skills: ReturnType<SkillScanner['list']>) {
    return skills.filter(s => s.path.startsWith(tempWorkspace))
  }

  describe('scanAll — 全量扫描', () => {
    it('应扫描到所有有效技能', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      // 应找到: My Skill, simple-skill, Standalone, Nested Skill
      expect(wsSkills.length).toBe(4)

      const names = wsSkills.map(s => s.name).sort()
      expect(names).toEqual(['My Skill', 'Nested Skill', 'Standalone', 'simple-skill'])
    })

    it('应跳过隐藏目录', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      expect(wsSkills.find(s => s.name === 'Hidden Skill')).toBeUndefined()
    })

    it('应跳过非 .md 文件', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      expect(wsSkills.find(s => s.name === 'readme')).toBeUndefined()
    })

    it('应递归扫描嵌套目录', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      const nested = wsSkills.find(s => s.name === 'Nested Skill')
      expect(nested).toBeDefined()
      expect(nested!.path).toContain('category')
      expect(nested!.path).toContain('nested-skill')
    })
  })

  describe('frontmatter 解析', () => {
    it('应正确解析 frontmatter 字段', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      const skill = wsSkills.find(s => s.name === 'My Skill')
      expect(skill).toBeDefined()
      expect(skill!.description).toBe('A test skill for unit testing')
      expect(skill!.tags).toEqual(['test', 'unit', 'mock'])
      expect(skill!.trigger).toBe('when user asks for test')
      expect(skill!.asTool).toBe(true)
      expect(skill!.toolName).toBe('my_skill_tool')
      expect(skill!.toolDescription).toBe('Executes a test skill')
    })

    it('无 frontmatter 的 SKILL.md 应使用父目录名', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      const skill = wsSkills.find(s => s.name === 'simple-skill')
      expect(skill).toBeDefined()
      expect(skill!.description).toBeTruthy()
      expect(skill!.content).toContain('Simple Skill')
    })

    it('独立 .md 文件应用 frontmatter 中的 name', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      const skill = wsSkills.find(s => s.name === 'Standalone')
      expect(skill).toBeDefined()
      expect(skill!.path).toBe(join(wsSkillsDir, 'standalone-skill.md'))
    })

    it('body 内容应去除 frontmatter', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      const skill = wsSkills.find(s => s.name === 'My Skill')
      expect(skill).toBeDefined()
      expect(skill!.content).not.toContain('---')
      expect(skill!.content).toContain('# My Skill')
      expect(skill!.content).toContain('Do thing A')
    })

    it('source 字段应为 workspace', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      // 工作区下的技能 source 为 'workspace'
      expect(wsSkills.every(s => s.source === 'workspace')).toBe(true)
    })

    it('id 应基于文件路径且稳定', async () => {
      const scanner1 = new SkillScanner()
      await scanner1.scanAll()
      const skill1 = filterWorkspaceSkills(scanner1.list()).find(s => s.name === 'My Skill')
      expect(skill1).toBeDefined()
      expect(skill1!.id).toMatch(/^skill_/)

      const scanner2 = new SkillScanner()
      await scanner2.scanAll()
      const skill2 = filterWorkspaceSkills(scanner2.list()).find(s => s.name === 'My Skill')
      expect(skill2!.id).toBe(skill1!.id)
    })
  })

  describe('list / get — 查询接口', () => {
    it('list() 应按名称排序', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const skills = scanner.list()
      for (let i = 1; i < skills.length; i++) {
        expect(skills[i].name.localeCompare(skills[i - 1].name)).toBeGreaterThanOrEqual(0)
      }
    })

    it('get(id) 应返回对应 skill', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      expect(wsSkills.length).toBeGreaterThan(0)
      const first = wsSkills[0]
      const found = scanner.get(first.id)
      expect(found).toBeDefined()
      expect(found!.id).toBe(first.id)
    })

    it('get(不存在) 应返回 undefined', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      expect(scanner.get('nonexistent-id')).toBeUndefined()
    })
  })

  describe('getScanPaths — 扫描路径', () => {
    it('应返回扫描路径列表', () => {
      const scanner = new SkillScanner()

      const paths = scanner.getScanPaths()
      expect(paths.length).toBeGreaterThan(0)
      expect(paths.every(p => typeof p.path === 'string' && p.path.length > 0)).toBe(true)
      expect(paths.every(p => ['user', 'workspace', 'thirdparty'].includes(p.source))).toBe(true)
    })

    it('应包含用户全局 skills 路径', () => {
      const scanner = new SkillScanner()

      const paths = scanner.getScanPaths()
      const userPaths = paths.filter(p => p.source === 'user')
      expect(userPaths.length).toBeGreaterThan(0)
      expect(userPaths[0].path).toContain('.aela')
      expect(userPaths[0].path).toContain('skills')
    })

    it('应包含工作区 skills 路径', () => {
      const scanner = new SkillScanner()

      const paths = scanner.getScanPaths()
      const wsPaths = paths.filter(p => p.source === 'workspace')
      expect(wsPaths.length).toBeGreaterThan(0)
      expect(wsPaths[0].path).toBe(join(tempWorkspace, '.aela', 'skills'))
    })

    it('应包含第三方 skills 路径', () => {
      const scanner = new SkillScanner()

      const paths = scanner.getScanPaths()
      const thirdpartyPaths = paths.filter(p => p.source === 'thirdparty')
      expect(thirdpartyPaths.length).toBeGreaterThan(0)
      const allPaths = thirdpartyPaths.map(p => p.path).join('|')
      expect(allPaths).toContain('.claude')
      expect(allPaths).toContain('.cursor')
      expect(allPaths).toContain('.codex')
    })
  })

  describe('getScanLog / getLastScanAt — 诊断信息', () => {
    it('未扫描时 getScanLog 应返回空数组', () => {
      const scanner = new SkillScanner()
      expect(scanner.getScanLog()).toEqual([])
    })

    it('未扫描时 getLastScanAt 应返回空字符串', () => {
      const scanner = new SkillScanner()
      expect(scanner.getLastScanAt()).toBe('')
    })

    it('扫描后应返回诊断日志', async () => {
      const scanner = new SkillScanner()
      await scanner.scanAll()

      const log = scanner.getScanLog()
      expect(log.length).toBeGreaterThan(0)

      // 应有 workspace 源的日志
      const wsLog = log.find(l => l.source === 'workspace')
      expect(wsLog).toBeDefined()
      expect(wsLog!.exists).toBe(true)
      expect(wsLog!.isDirectory).toBe(true)
      expect(wsLog!.entryCount).toBeGreaterThan(0)

      expect(scanner.getLastScanAt()).not.toBe('')
    })
  })

  describe('BOM 处理', () => {
    it('应正确处理带 BOM 的文件', async () => {
      const bomDir = join(wsSkillsDir, 'bom-skill')
      await mkdir(bomDir, { recursive: true })
      const bomBuffer = Buffer.concat([
        Buffer.from([0xEF, 0xBB, 0xBF]),
        Buffer.from('---\nname: BOM Skill\ndescription: Has BOM\n---\n\n# BOM Skill\n\nContent.', 'utf-8'),
      ])
      await writeFile(join(bomDir, 'SKILL.md'), bomBuffer)

      const scanner = new SkillScanner()
      await scanner.scanAll()

      const wsSkills = filterWorkspaceSkills(scanner.list())
      const skill = wsSkills.find(s => s.name === 'BOM Skill')
      expect(skill).toBeDefined()
      expect(skill!.description).toBe('Has BOM')
      expect(skill!.content).not.toContain('\uFEFF')
    })
  })

  describe('单例模式', () => {
    it('getSkillScanner 应返回同一实例', () => {
      const s1 = getSkillScanner()
      const s2 = getSkillScanner()
      expect(s1).toBe(s2)
    })
  })
})
