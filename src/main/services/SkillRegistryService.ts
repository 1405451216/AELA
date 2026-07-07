import { net } from 'electron'
import { mkdir, readFile, rm, readdir, stat, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { tmpdir, homedir } from 'os'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'
import type { SkillRegistryEntry, InstalledSkillInfo } from '@shared/types/skill'

// Manual tar module type declaration
declare const tar: {
  x: (options: { cwd: string; strip?: number }) => NodeJS.ReadWriteStream
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tarImpl: typeof tar = require('tar')

export interface SkillInstallResult {
  success: boolean
  skillId: string
  error?: string
}

export interface SkillMarketListResult {
  registry: SkillRegistryEntry[]
  installed: InstalledSkillInfo[]
  offline: boolean
}

/**
 * Skill 市场服务 — 远程注册表 + 本地安装管理
 */
export class SkillRegistryService {
  private registryCache: SkillRegistryEntry[] | null = null
  private installedCache: InstalledSkillInfo[] | null = null
  private cacheExpiry = 0
  private readonly CACHE_TTL = 5 * 60 * 1000

  constructor(
    private registryUrl = process.env.AELA_REGISTRY_URL || 'https://registry.aela.dev/api/v1/skills'
  ) {}

  private getUserSkillsDir(): string {
    return join(homedir(), '.aela', 'skills')
  }

  /** 获取远程 skill 列表（带缓存） */
  async fetchRegistry(force = false): Promise<SkillRegistryEntry[]> {
    if (!force && this.registryCache && Date.now() < this.cacheExpiry) {
      return this.registryCache
    }
    if (this.registryUrl.startsWith('file://')) {
      const localPath = this.registryUrl.replace('file://', '')
      try {
        const data = await readFile(localPath, 'utf-8')
        const parsed = JSON.parse(data)
        this.registryCache = parsed.skills || []
        this.cacheExpiry = Date.now() + this.CACHE_TTL
        return this.registryCache!;
      } catch {
        this.registryCache = []
        return []
      }
    }
    try {
      const data = await this.netFetch(this.registryUrl)
      const parsed = JSON.parse(data)
      this.registryCache = parsed.skills || []
      this.cacheExpiry = Date.now() + this.CACHE_TTL
      return this.registryCache!;
    } catch {
      return this.registryCache ?? []
    }
  }

  /** 获取已安装的 skill 列表 */
  async getInstalledSkills(force = false): Promise<InstalledSkillInfo[]> {
    if (!force && this.installedCache) {
      return this.installedCache
    }
    const skillsDir = this.getUserSkillsDir()
    const result: InstalledSkillInfo[] = []
    try {
      const entries = await readdir(skillsDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const skillJsonPath = join(skillsDir, entry.name, 'skill.json')
        try {
          const raw = await readFile(skillJsonPath, 'utf-8')
          const manifest = JSON.parse(raw)
          result.push({
            id: entry.name,
            name: manifest.name || entry.name,
            version: manifest.version || '0.0.0',
            path: join(skillsDir, entry.name),
            permissions: manifest.permissions || {},
          })
        } catch {
          // skip invalid skill dirs
        }
      }
    } catch {
      // directory doesn't exist
    }
    this.installedCache = result
    return result
  }

  /** 检查 skill 是否已安装 */
  async isInstalled(skillId: string): Promise<boolean> {
    const installed = await this.getInstalledSkills()
    return installed.some(s => s.id === skillId)
  }

  /** 安装 skill（下载 tgz -> 解压 -> 校验） */
  async installSkill(entry: SkillRegistryEntry): Promise<SkillInstallResult> {
    const tmpDir = join(tmpdir(), 'aela-skill-install', entry.id)
    const tmpFile = join(tmpDir, 'skill.tgz')
    const targetDir = join(this.getUserSkillsDir(), entry.id)
    try {
      await mkdir(tmpDir, { recursive: true })
      await this.downloadFile(entry.tarballUrl, tmpFile)
      await this.extractTarball(tmpFile, targetDir)
      await stat(join(targetDir, 'SKILL.md'))
      await stat(join(targetDir, 'skill.json'))
      const rawManifest = await readFile(join(targetDir, 'skill.json'), 'utf-8')
      const manifest = JSON.parse(rawManifest)
      if (!manifest.name) throw new Error('skill.json 缺少 name 字段')
      await rm(tmpDir, { recursive: true, force: true })
      this.installedCache = null
      return { success: true, skillId: entry.id }
    } catch (err) {
      await rm(targetDir, { recursive: true, force: true }).catch(() => {})
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
      return {
        success: false,
        skillId: entry.id,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /** 卸载 skill */
  async uninstallSkill(skillId: string): Promise<SkillInstallResult> {
    const targetDir = join(this.getUserSkillsDir(), skillId)
    try {
      await stat(targetDir)
      await rm(targetDir, { recursive: true, force: true })
      this.installedCache = null
      return { success: true, skillId }
    } catch (err) {
      return {
        success: false,
        skillId,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /** 网络请求 */
  private netFetch(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url)
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        response.on('error', reject)
      })
      request.on('error', reject)
      request.end()
    })
  }

  /** 下载文件到本地 */
  private async downloadFile(url: string, dest: string): Promise<void> {
    const data = await this.netFetch(url)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, data)
  }

  /** 解压 tarball */
  private async extractTarball(tgzPath: string, dest: string): Promise<void> {
    await mkdir(dest, { recursive: true })
    await pipeline(
      await this.createReadStream(tgzPath),
      createGunzip(),
      tarImpl.x({ cwd: dest, strip: 1 })
    )
  }

  /** 创建可读流（兼容 fs/promises） */
  private async createReadStream(path: string): Promise<NodeJS.ReadableStream> {
    const fs = await import('fs')
    return fs.createReadStream(path)
  }
}
