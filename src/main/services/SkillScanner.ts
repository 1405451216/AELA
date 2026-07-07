// Skills 扫描服务
// 扫描用户目录和工作区中的 skill 文件（.md 格式，含 YAML frontmatter）

import { readdir, readFile, stat, mkdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { join, basename, extname, dirname } from 'node:path'
import { homedir } from 'node:os'
import type { Skill, SkillFrontmatter } from '@shared/types'

// 第三方 skills 目录名（相对 home / workspace）
const THIRD_PARTY_DIRS = [
  { sub: ['.cursor', 'skills'], label: 'Cursor' },
  { sub: ['.claude', 'skills'], label: 'Claude' },
  { sub: ['.codex', 'skills'], label: 'Codex' },
]

// 诊断日志条目
export interface ScanLogEntry {
  dir: string
  source: string
  exists: boolean
  isDirectory: boolean
  entryCount: number
  skillsFound: number
  loadErrors: string[]
  error?: string
}

// 去重冲突记录
export interface DeduplicationConflict {
  name: string
  keptSource: Skill['source']
  keptPath: string
  skippedSource: Skill['source']
  skippedPath: string
  reason: 'higher_priority' | 'same_priority_first_wins'
}

// 来源优先级（数字越小优先级越高）
const SOURCE_PRIORITY: Record<Skill['source'], number> = {
  user: 1,
  workspace: 2,
  builtin: 3,
  thirdparty: 4,
}

// Skills 扫描根目录（按优先级排序）
function getScanDirs(): Array<{ dir: string; source: Skill['source'] }> {
  const dirs: Array<{ dir: string; source: Skill['source'] }> = []

  // 1. 用户全局 skills 目录（最高优先级）
  const userSkillsDir = join(homedir(), '.aela', 'skills')
  dirs.push({ dir: userSkillsDir, source: 'user' })

  // 2. 当前工作区的 .aela/skills 目录
  if (process.env['AELA_WORKSPACE_PATH']) {
    const wsSkillsDir = join(process.env['AELA_WORKSPACE_PATH'], '.aela', 'skills')
    dirs.push({ dir: wsSkillsDir, source: 'workspace' })
  }

  // 3. 第三方 skills 目录（home 下）
  for (const { sub } of THIRD_PARTY_DIRS) {
    dirs.push({ dir: join(homedir(), ...sub), source: 'thirdparty' })
  }

  // 4. 第三方 skills 目录（工作区下）
  if (process.env['AELA_WORKSPACE_PATH']) {
    for (const { sub } of THIRD_PARTY_DIRS) {
      dirs.push({ dir: join(process.env['AELA_WORKSPACE_PATH'], ...sub), source: 'thirdparty' })
    }
  }

  return dirs
}

// 解析 YAML frontmatter（轻量解析，不依赖外部库）
function parseFrontmatter(content: string): { meta: SkillFrontmatter; body: string } {
  // 去除可能的 BOM 头和前导空白
  const cleaned = content.replace(/^\uFEFF/, '').trimStart()
  const match = cleaned.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    return { meta: {}, body: cleaned }
  }

  const meta: SkillFrontmatter = {}
  const lines = match[1].split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^(\w+):\s*(.*)$/)
    if (!m) continue
    const key = m[1] as keyof SkillFrontmatter
    let value: any = m[2].trim()
    // 处理引号
    if (typeof value === 'string') {
      value = value.replace(/^['"]|['"]$/g, '')
      // 处理布尔值（as_tool: true / false）
      if (value === 'true') value = true
      else if (value === 'false') value = false
      // 处理数组（tags: [a, b, c]）
      else if (value.startsWith('[') && value.endsWith(']')) {
        try {
          value = value.slice(1, -1).split(',').map((s: string) => s.trim().replace(/^['"]|['"]$/g, ''))
        } catch (err) {
          console.error('[SkillScanner] Failed to parse array value in frontmatter:', err)
        }
      }
    }
    meta[key] = value
  }

  return { meta, body: match[2] }
}

// 从 Markdown 提取首段作为描述
function extractDescription(body: string, fallback: string): string {
  const firstPara = body.trim().split(/\r?\n\r?\n/)[0] || ''
  const cleaned = firstPara.replace(/[#*`>[]]/g, '').trim()
  if (cleaned.length > 200) return cleaned.slice(0, 200) + '...'
  return cleaned || fallback
}

// 安全的时间戳转换（Windows 上 birthtime 可能为 0）
function safeISO(date: Date | undefined): string {
  try {
    if (!date || isNaN(date.getTime())) {
      return new Date().toISOString()
    }
    return date.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

export class SkillScanner {
  private skills: Map<string, Skill> = new Map()
  private lastScanAt: string = ''
  private scanLog: ScanLogEntry[] = []
  private dedupConflicts: DeduplicationConflict[] = []
  private skillNameIndex: Map<string, Skill> = new Map() // 用于去重：name -> skill

  /**
   * 扫描所有目录并加载 skills（带去重）
   */
  async scanAll(): Promise<Skill[]> {
    this.skills.clear()
    this.scanLog = []
    this.dedupConflicts = []
    this.skillNameIndex.clear()
    const scanDirs = getScanDirs()

    console.log(`[SkillScanner] Starting scan. homedir=${homedir()}, dirs to scan=${scanDirs.length}`)

    // 确保 AELA 用户 skills 目录存在（自动创建）
    const userSkillsDir = join(homedir(), '.aela', 'skills')
    try {
      await mkdir(userSkillsDir, { recursive: true })
    } catch (err: unknown) {
      console.error('[SkillScanner] Failed to create user skills directory:', err)
    }

    for (const { dir, source } of scanDirs) {
      const logEntry: ScanLogEntry = {
        dir,
        source,
        exists: false,
        isDirectory: false,
        entryCount: 0,
        skillsFound: 0,
        loadErrors: [],
      }
      const skillsBefore = this.skills.size
      try {
        await this.scanDir(dir, source, logEntry)
      } catch (err: unknown) {
        logEntry.error = err instanceof Error ? err.message : String(err)
        console.error(`[SkillScanner] Error scanning ${dir}:`, err)
      }
      logEntry.skillsFound = this.skills.size - skillsBefore
      this.scanLog.push(logEntry)
      console.log(`[SkillScanner] Scanned ${dir}: exists=${logEntry.exists}, entries=${logEntry.entryCount}, skills=${logEntry.skillsFound}, errors=${logEntry.loadErrors.length}`)
    }

    this.lastScanAt = new Date().toISOString()
    const result = Array.from(this.skills.values()).sort((a, b) => a.name.localeCompare(b.name))
    console.log(`[SkillScanner] Scan complete. Total skills: ${result.length}, conflicts resolved: ${this.dedupConflicts.length}`)
    return result
  }

  /**
   * 扫描目录中的 skills
   *
   * 策略（不依赖 entry.isDirectory()，兼容 Windows Dirent 类型未知的情况）：
   * - 对每个条目，先尝试 stat(entry/SKILL.md)，如果存在则作为 skill 加载
   * - 如果 SKILL.md 不存在，再 stat(entry) 判断是否目录：
   *   - 目录 → 递归扫描
   *   - .md 文件 → 作为独立 skill 加载
   * - 如果 entry 是目录且不含 SKILL.md，递归扫描其子目录
   */
  private async scanDir(dir: string, source: Skill['source'], logEntry?: ScanLogEntry): Promise<void> {
    // 1. 检查目录是否存在
    let entries: Dirent[]
    try {
      const s = await stat(dir)
      if (logEntry) {
        logEntry.exists = true
        logEntry.isDirectory = s.isDirectory()
      }
      if (!s.isDirectory()) return
      entries = await readdir(dir, { withFileTypes: true })
      if (logEntry) {
        logEntry.entryCount = entries.length
      }
    } catch (err: unknown) {
      if (logEntry) {
        logEntry.exists = false
        if (!logEntry.error) {
          const code = (err as NodeJS.ErrnoException)?.code
          logEntry.error = code ?? (err instanceof Error ? err.message : String(err))
        }
      }
      return
    }

    // 2. 处理每个条目
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue

      const fullPath = join(dir, entry.name)

      // 2a. 先尝试检查 SKILL.md（不依赖 isDirectory，直接 stat）
      const skillMdPath = join(fullPath, 'SKILL.md')
      const _skillMdFound = false
      try {
        const skillStat = await stat(skillMdPath)
        if (skillStat.isFile()) {
          // _skillMdFound = true  // unused — kept for debugging
          try {
            const skill = await this.loadSkillFile(skillMdPath, source)
            if (skill) {
              this.skills.set(skill.id, skill)
            }
          } catch (err: unknown) {
            const errMsg = `Failed to load ${skillMdPath}: ${err instanceof Error ? err.message : String(err)}`
            console.error(`[SkillScanner] ${errMsg}`)
            logEntry?.loadErrors.push(errMsg)
          }
          // 无论加载成功与否，SKILL.md 已找到，跳过后续处理
          continue
        }
      } catch {
        // SKILL.md 不存在，继续判断是否为目录或 .md 文件
      }

      // 2b. 检查是否为目录（优先用 Dirent，回退用 stat）
      let isDir = entry.isDirectory()
      if (!isDir) {
        // Windows 上 Dirent 类型可能为 Unknown，用 stat 兜底
        try {
          const entryStat = await stat(fullPath)
          isDir = entryStat.isDirectory()
        } catch {
          // stat 失败，跳过
          continue
        }
      }

      if (isDir) {
        // 目录但无 SKILL.md → 递归扫描
        await this.scanDir(fullPath, source)
        continue
      }

      // 2c. 非目录：检查是否为 .md 文件
      if (extname(entry.name).toLowerCase() !== '.md') continue

      try {
        const skill = await this.loadSkillFile(fullPath, source)
        if (skill) {
          this.skills.set(skill.id, skill)
        }
      } catch (err: unknown) {
        const errMsg = `Failed to load ${fullPath}: ${err instanceof Error ? err.message : String(err)}`
        console.error(`[SkillScanner] ${errMsg}`)
        logEntry?.loadErrors.push(errMsg)
      }
    }
  }

  /**
   * 加载单个 skill 文件（带去重检查）
   */
  private async loadSkillFile(filePath: string, source: Skill['source']): Promise<Skill | null> {
    const content = await readFile(filePath, 'utf-8')
    const stats = await stat(filePath)
    const { meta, body } = parseFrontmatter(content)

    const fileName = basename(filePath, extname(filePath))
    // SKILL.md 文件：用父目录名作为 skill 名称
    const parentDirName = basename(dirname(filePath))
    const name = meta.name || (fileName.toLowerCase() === 'skill' ? parentDirName : fileName)
    const description = meta.description || extractDescription(body, name)

    // 去重检查：基于名称（小写）
    const nameKey = name.toLowerCase().trim()
    const existingSkill = this.skillNameIndex.get(nameKey)

    if (existingSkill) {
      const existingPriority = SOURCE_PRIORITY[existingSkill.source]
      const newPriority = SOURCE_PRIORITY[source]

      if (newPriority < existingPriority) {
        // 新来源优先级更高，替换
        this.dedupConflicts.push({
          name,
          keptSource: source,
          keptPath: filePath,
          skippedSource: existingSkill.source,
          skippedPath: existingSkill.path,
          reason: 'higher_priority',
        })
        console.log(`[SkillScanner] Replacing skill "${name}" from ${existingSkill.source} with ${source} (higher priority)`)
      } else {
        // 优先级相同或更低，跳过
        this.dedupConflicts.push({
          name,
          keptSource: existingSkill.source,
          keptPath: existingSkill.path,
          skippedSource: source,
          skippedPath: filePath,
          reason: 'same_priority_first_wins',
        })
        console.log(`[SkillScanner] Skipping duplicate skill "${name}" from ${source} (already loaded from ${existingSkill.source})`)
        return null
      }
    }

    // 使用文件路径的完整 base64url 编码作为 ID（保证唯一性）
    const id = `skill_${Buffer.from(filePath).toString('base64url')}`

    const skill: Skill = {
      id,
      name,
      description,
      content: body.trim(),
      path: filePath,
      source,
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      trigger: typeof meta.trigger === 'string' ? meta.trigger : undefined,
      asTool: meta.as_tool === true,
      toolName: typeof meta.tool_name === 'string' ? meta.tool_name : undefined,
      toolDescription: typeof meta.tool_description === 'string' ? meta.tool_description : undefined,
      toolParameters: (meta.tool_parameters && typeof meta.tool_parameters === 'object')
        ? meta.tool_parameters as Record<string, unknown>
        : undefined,
      createdAt: safeISO(stats.birthtime),
      updatedAt: safeISO(stats.mtime)
    }

    // 更新名称索引
    this.skillNameIndex.set(nameKey, skill)

    return skill
  }

  /**
   * 获取所有已加载的 skills
   */
  list(): Skill[] {
    return Array.from(this.skills.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 获取单个 skill
   */
  get(id: string): Skill | undefined {
    return this.skills.get(id)
  }

  /**
   * 获取扫描目录信息（供 UI 提示用户）
   */
  getScanPaths(): Array<{ path: string; source: Skill['source'] }> {
    return getScanDirs().map(({ dir, source }) => ({ path: dir, source }))
  }

  /**
   * 获取上次扫描的诊断日志
   */
  getScanLog(): ScanLogEntry[] {
    return this.scanLog
  }

  /**
   * 获取去重冲突记录
   */
  getDedupConflicts(): DeduplicationConflict[] {
    return this.dedupConflicts
  }

  /**
   * 上次扫描时间
   */
  getLastScanAt(): string {
    return this.lastScanAt
  }
}

// 单例
let _instance: SkillScanner | null = null
export function getSkillScanner(): SkillScanner {
  if (!_instance) {
    _instance = new SkillScanner()
  }
  return _instance
}
