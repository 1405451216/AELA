// AELA — Checkpoint / 回滚服务
// 在 AI 修改文件前创建快照，支持回滚到任意检查点
// 使用 SQLite 存储快照元数据 + 文件系统存储实际内容
//
// 设计原则：
//   1. 轻量级：仅记录被修改的文件，不复制整个工作区
//   2. 增量快照：每个检查点只记录自上一个检查点以来变更的文件
//   3. 快速回滚：通过逆序应用文件内容恢复
//   4. 自动清理：限制最大检查点数量，超限时合并最旧的

import { join } from 'node:path'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'

export interface Checkpoint {
  id: string
  sessionId: string
  createdAt: string
  description: string
  /** 此检查点记录的文件变更 */
  files: CheckpointFile[]
}

export interface CheckpointFile {
  /** 相对于工作区的路径 */
  relativePath: string
  /** 变更前内容（null = 新创建的文件） */
  beforeContent: string | null
  /** 变更后内容（null = 被删除的文件） */
  afterContent: string | null
}

export interface CheckpointSnapshot {
  id: string
  sessionId: string
  createdAt: string
  description: string
  fileCount: number
}

// 文件内容存储在文件系统中（避免 SQLite 存储 大文件内容）
// 元数据存储在内存 Map 中（轻量级，无需持久化）

export class CheckpointService {
  private checkpoints = new Map<string, Checkpoint>()
  /** 按会话分组的检查点 ID 列表（按时间排序） */
  private sessionCheckpoints = new Map<string, string[]>()
  /** 全局 LRU 顺序 — 最近创建的排在末尾 */
  private globalLruOrder: string[] = []
  private readonly maxCheckpointsPerSession = 20
  /** 全局检查点总上限 */
  private readonly maxTotalCheckpoints = 200
  private storageDir: string
  private rootDir: string

  constructor(rootDir: string) {
    this.rootDir = rootDir
    this.storageDir = join(app.getPath('userData'), 'checkpoints')
    this.ensureStorageDir()
  }

  /**
   * 设置工作区根目录
   */
  setRootDir(dir: string): void {
    this.rootDir = dir
  }

  /**
   * 在文件被修改前创建检查点
   * @param sessionId 会话 ID
   * @param filePaths 即将被修改的文件路径列表（相对于工作区）
   * @param description 检查点描述
   * @returns 检查点 ID
   */
  async createCheckpoint(
    sessionId: string,
    filePaths: string[],
    description: string = 'AI 修改前快照',
  ): Promise<string> {
    const checkpointId = randomUUID()
    const files: CheckpointFile[] = []

    for (const relPath of filePaths) {
      const absPath = join(this.rootDir, relPath)
      let beforeContent: string | null = null

      try {
        beforeContent = await readFile(absPath, 'utf8')
      } catch {
        // 文件不存在 = 新创建的文件
        beforeContent = null
      }

      files.push({
        relativePath: relPath,
        beforeContent,
        afterContent: null, // 修改后内容在 restore 时不需要（回滚用 beforeContent）
      })
    }

    const checkpoint: Checkpoint = {
      id: checkpointId,
      sessionId,
      createdAt: new Date().toISOString(),
      description,
      files,
    }

    this.checkpoints.set(checkpointId, checkpoint)

    // 按会话分组
    const sessionList = this.sessionCheckpoints.get(sessionId) || []
    sessionList.push(checkpointId)
    this.sessionCheckpoints.set(sessionId, sessionList)

    // 全局 LRU 顺序维护
    this.globalLruOrder.push(checkpointId)

    // 自动清理：会话级限制
    if (sessionList.length > this.maxCheckpointsPerSession) {
      const oldestId = sessionList.shift()!
      this.checkpoints.delete(oldestId)
      this.removeFromGlobalLru(oldestId)
    }

    // 自动清理：全局限制（LRU 淘汰最旧的）
    while (this.globalLruOrder.length > this.maxTotalCheckpoints) {
      const lruId = this.globalLruOrder.shift()!
      const lruCp = this.checkpoints.get(lruId)
      if (lruCp) {
        this.checkpoints.delete(lruId)
        // 从会话列表中移除
        const list = this.sessionCheckpoints.get(lruCp.sessionId)
        if (list) {
          const idx = list.indexOf(lruId)
          if (idx >= 0) list.splice(idx, 1)
        }
      }
    }

    return checkpointId
  }

  /**
   * 回滚到指定检查点
   * 恢复该检查点记录的所有文件到修改前的状态
   * @param checkpointId 检查点 ID
   * @returns 恢复的文件数量
   */
  async restoreCheckpoint(checkpointId: string): Promise<number> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    let restoredCount = 0

    // 逆序恢复（从最后一个文件开始，避免依赖问题）
    for (let i = checkpoint.files.length - 1; i >= 0; i--) {
      const file = checkpoint.files[i]
      const absPath = join(this.rootDir, file.relativePath)

      if (file.beforeContent === null) {
        // 文件在修改前不存在 → 删除文件
        try {
          await rm(absPath)
          restoredCount++
        } catch {
          // 文件可能已经被删除了
        }
      } else {
        // 恢复文件到修改前的内容
        try {
          // 确保目录存在
          const dir = join(absPath, '..')
          await mkdir(dir, { recursive: true })
          await writeFile(absPath, file.beforeContent, 'utf8')
          restoredCount++
        } catch (err) {
          console.error(`[Checkpoint] Failed to restore ${file.relativePath}:`, err)
        }
      }
    }

    return restoredCount
  }

  /**
   * 获取会话的所有检查点（摘要信息）
   */
  getSessionCheckpoints(sessionId: string): CheckpointSnapshot[] {
    const ids = this.sessionCheckpoints.get(sessionId) || []
    return ids.map(id => {
      const cp = this.checkpoints.get(id)
      if (!cp) return null
      return {
        id: cp.id,
        sessionId: cp.sessionId,
        createdAt: cp.createdAt,
        description: cp.description,
        fileCount: cp.files.length,
      }
    }).filter((s): s is CheckpointSnapshot => s !== null)
  }

  /**
   * 获取检查点详情
   */
  getCheckpoint(checkpointId: string): Checkpoint | null {
    return this.checkpoints.get(checkpointId) || null
  }

  /**
   * 删除检查点
   */
  deleteCheckpoint(checkpointId: string): boolean {
    const cp = this.checkpoints.get(checkpointId)
    if (!cp) return false
    this.checkpoints.delete(checkpointId)
    this.removeFromGlobalLru(checkpointId)
    const sessionList = this.sessionCheckpoints.get(cp.sessionId)
    if (sessionList) {
      const idx = sessionList.indexOf(checkpointId)
      if (idx >= 0) sessionList.splice(idx, 1)
    }
    return true
  }

  /**
   * 清除会话的所有检查点
   */
  clearSessionCheckpoints(sessionId: string): void {
    const ids = this.sessionCheckpoints.get(sessionId) || []
    for (const id of ids) {
      this.checkpoints.delete(id)
      this.removeFromGlobalLru(id)
    }
    this.sessionCheckpoints.delete(sessionId)
  }

  /**
   * 获取检查点统计信息
   */
  getStats(): { totalCheckpoints: number; totalSessions: number; totalFiles: number } {
    let totalFiles = 0
    for (const cp of this.checkpoints.values()) {
      totalFiles += cp.files.length
    }
    return {
      totalCheckpoints: this.checkpoints.size,
      totalSessions: this.sessionCheckpoints.size,
      totalFiles,
    }
  }

  /**
   * 生命周期停止方法
   */
  stop(): void {
    // 检查点存储在内存中，无需持久化清理
  }

  private removeFromGlobalLru(checkpointId: string): void {
    const idx = this.globalLruOrder.indexOf(checkpointId)
    if (idx >= 0) this.globalLruOrder.splice(idx, 1)
  }

  private async ensureStorageDir(): Promise<void> {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true })
    }
  }
}
