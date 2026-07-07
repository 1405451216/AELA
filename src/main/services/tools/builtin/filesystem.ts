// Builtin tools: 文件系统（读/写/列目录）
// 拆分自 ToolManager.ts，2026-07-01 重构

import type { Tool } from '@agentprimordia/sdk'
import { stat, readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { safeResolve, MAX_FILE_SIZE } from '../pathSafety'
import type { FileChangeTracker } from '../fileChangeTracker'

// ===== 读取文件 =====
export class ReadFileTool implements Tool {
  name = 'read_file'
  description = '读取指定路径的文件内容。支持文本文件、代码文件等。'
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '文件路径（相对于工作区根目录或绝对路径）' }
    },
    required: ['path']
  }

  constructor(private rootDir: string) {}

  async execute(args: { path: string }): Promise<string> {
    const filePath = this.resolvePath(args.path)
    const stats = await stat(filePath)
    if (stats.size > MAX_FILE_SIZE) {
      return `[安全限制] 文件过大 (${(stats.size / 1024 / 1024).toFixed(2)} MB)，超过 ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB 限制。\n文件: ${args.path}`
    }
    const content = await readFile(filePath, 'utf-8')
    return `文件: ${args.path}\n大小: ${stats.size} bytes\n\n${content}`
  }

  protected resolvePath(p: string): string {
    return safeResolve(this.rootDir, p)
  }
}

// ===== 写入文件 =====

/** Checkpoint 回调类型 — 在文件写入前创建快照 */
export type CheckpointCallback = (sessionId: string, filePaths: string[], description: string) => Promise<void>

export class WriteFileTool implements Tool {
  name = 'write_file'
  description = '写入内容到指定文件。如果文件不存在则创建，如果存在则覆盖。'
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '文件路径' },
      content: { type: 'string', description: '文件内容' }
    },
    required: ['path', 'content']
  }

  private checkpointCallback?: CheckpointCallback

  constructor(
    private rootDir: string,
    private changeTracker?: FileChangeTracker,
    private sessionId?: string,
    private agentName?: string
  ) {}

  setContext(sessionId: string, agentName: string): void {
    this.sessionId = sessionId
    this.agentName = agentName
  }

  /** 设置 Checkpoint 回调（由 ToolManager 注入） */
  setCheckpointCallback(cb: CheckpointCallback): void {
    this.checkpointCallback = cb
  }

  async execute(args: { path: string; content: string }): Promise<string> {
    const filePath = this.resolvePath(args.path)

    // 在写入前创建 Checkpoint 快照（用于回滚）
    if (this.checkpointCallback && this.sessionId) {
      try {
        await this.checkpointCallback(this.sessionId, [args.path], `AI 写入 ${args.path}`)
      } catch (err) {
        console.error('[WriteFileTool] Checkpoint creation failed:', err)
      }
    }

    // 在写入前捕获原始内容（用于 Diff 视图）
    if (this.changeTracker && this.sessionId) {
      await this.changeTracker.captureBeforeWrite(
        filePath,
        this.rootDir,
        args.content,
        this.sessionId,
        this.agentName || 'agent'
      )
    }

    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, args.content, 'utf-8')
    return `文件已写入: ${args.path} (${args.content.length} bytes)`
  }

  protected resolvePath(p: string): string {
    return safeResolve(this.rootDir, p)
  }
}

// ===== 列目录 =====
export class ListDirectoryTool implements Tool {
  name = 'list_directory'
  description = '列出指定目录下的文件和子目录。'
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: '目录路径（默认为工作区根目录）' }
    },
    required: []
  }

  constructor(private rootDir: string) {}

  async execute(args: { path?: string }): Promise<string> {
    const dirPath = this.resolvePath(args.path || '.')
    const entries = await readdir(dirPath, { withFileTypes: true })
    const lines: string[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const type = entry.isDirectory() ? '📁' : '📄'
      lines.push(`${type} ${entry.name}`)
    }

    return `目录: ${args.path || '.'}\n${lines.join('\n')}`
  }

  protected resolvePath(p: string): string {
    return safeResolve(this.rootDir, p)
  }
}
