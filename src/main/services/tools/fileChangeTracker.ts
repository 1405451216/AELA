// 文件变更追踪器
// 在 write_file 执行前捕获原始内容，记录变更供 Diff 视图展示

import { readFile, stat } from 'node:fs/promises'
import { relative } from 'node:path'
import { randomUUID } from 'crypto'
import type { FileChangeRecord } from '@shared/types'

/** 单实例最大记录数，防止内存无限增长 */
const DEFAULT_MAX_RECORDS = 200

export class FileChangeTracker {
  private changes: FileChangeRecord[] = []
  private maxRecords: number

  constructor(maxRecords: number = DEFAULT_MAX_RECORDS) {
    this.maxRecords = maxRecords
  }

  /**
   * 在写入文件前调用，记录原始内容
   */
  async captureBeforeWrite(
    filePath: string,
    rootDir: string,
    newContent: string,
    sessionId: string,
    agentName: string
  ): Promise<void> {
    const relPath = relative(rootDir, filePath)
    let originalContent = ''
    let changeType: 'created' | 'modified' | 'deleted' = 'created'

    try {
      const stats = await stat(filePath)
      if (stats.isFile()) {
        originalContent = await readFile(filePath, 'utf-8')
        changeType = 'modified'
      }
    } catch {
      // 文件不存在 → created
      changeType = 'created'
    }

    // 如果内容完全相同，不记录
    if (changeType === 'modified' && originalContent === newContent) {
      return
    }

    const record: FileChangeRecord = {
      id: randomUUID(),
      filePath: relPath,
      absolutePath: filePath,
      originalContent,
      newContent,
      changeType,
      timestamp: new Date().toISOString(),
      sessionId,
      agentName,
      accepted: false,
      rejected: false,
    }

    this.changes.push(record)

    // 限制记录数量
    if (this.changes.length > this.maxRecords) {
      this.changes = this.changes.slice(-this.maxRecords)
    }
  }

  list(sessionId?: string): FileChangeRecord[] {
    return sessionId
      ? this.changes.filter(c => c.sessionId === sessionId)
      : [...this.changes]
  }

  get(id: string): FileChangeRecord | undefined {
    return this.changes.find(c => c.id === id)
  }

  clear(sessionId?: string): void {
    if (sessionId) {
      this.changes = this.changes.filter(c => c.sessionId !== sessionId)
    } else {
      this.changes = []
    }
  }

  accept(id: string): FileChangeRecord | undefined {
    const record = this.changes.find(c => c.id === id)
    if (record) {
      record.accepted = true
      record.rejected = false
    }
    return record
  }

  reject(id: string): FileChangeRecord | undefined {
    const record = this.changes.find(c => c.id === id)
    if (record) {
      record.rejected = true
      record.accepted = false
    }
    return record
  }
}