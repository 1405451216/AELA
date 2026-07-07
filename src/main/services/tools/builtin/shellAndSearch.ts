// Builtin tools: Shell / CodeSearch / ProjectStructure / HttpFetch
// 拆分自 ToolManager.ts，2026-07-01 重构

import type { Tool } from '@agentprimordia/sdk'
import { readFile, readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join, relative, extname } from 'node:path'
import { assessCommandRisk } from '../shellRisk'
import type { ShellConfirmCallback } from '../../ToolManager'

// ===== 执行 Shell 命令 =====
export class ShellTool implements Tool {
  name = 'execute_command'
  description = '在工作区目录下执行 Shell 命令。支持 git、npm、go、python 等命令。危险命令需要用户确认。'
  parameters = {
    type: 'object' as const,
    properties: {
      command: { type: 'string', description: '要执行的命令' },
      timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' }
    },
    required: ['command']
  }

  // 会话级别的命令审批缓存
  private sessionApprovals: Map<string, boolean> = new Map()

  constructor(private rootDir: string, private confirmCallback?: ShellConfirmCallback) {}

  /**
   * 重置会话级审批缓存（新会话时调用）
   */
  resetSessionApprovals(): void {
    this.sessionApprovals.clear()
  }

  async execute(args: { command: string; timeout?: number }): Promise<string> {
    const command = args.command.trim()

    // 1. 安全检查
    const assessment = assessCommandRisk(command)

    // 2. 安全命令直接执行，无需确认
    if (assessment.risk === 'safe') {
      return this.runCommand(command, args.timeout)
    }

    // 3. 检查会话级别缓存（用户选择了"本次会话允许同类命令"）
    const cacheKey = assessment.risk
    if (this.sessionApprovals.get(cacheKey) === true) {
      return this.runCommand(command, args.timeout)
    }

    // 4. 危险/中度风险命令需要确认
    if (assessment.risk === 'dangerous') {
      // 危险命令：必须确认
      if (!this.confirmCallback) {
        return `[安全拦截] 危险命令被阻止，当前环境不支持交互式确认。\n命令: ${command}\n风险: ${assessment.reasons.join('; ')}`
      }

      const response = await this.confirmCallback({
        command,
        workingDir: this.rootDir,
        risk: assessment.risk,
        riskReasons: assessment.reasons
      })

      if (!response.approved) {
        return `[安全拦截] 用户拒绝了该危险命令的执行。\n命令: ${command}`
      }

      if (response.rememberChoice === 'allow_session') {
        this.sessionApprovals.set(cacheKey, true)
      }
    } else if (assessment.risk === 'moderate') {
      // 中度风险命令：需要确认
      if (!this.confirmCallback) {
        return `[安全拦截] 该命令需要用户确认，当前环境不支持交互式确认。\n命令: ${command}\n风险: ${assessment.reasons.join('; ')}`
      }

      const response = await this.confirmCallback({
        command,
        workingDir: this.rootDir,
        risk: assessment.risk,
        riskReasons: assessment.reasons
      })

      if (!response.approved) {
        return `[安全拦截] 用户拒绝了该命令的执行。\n命令: ${command}`
      }

      if (response.rememberChoice === 'allow_session') {
        this.sessionApprovals.set(cacheKey, true)
      }
    }

    // 5. 执行命令
    return this.runCommand(command, args.timeout)
  }

  private runCommand(command: string, timeoutMs?: number): Promise<string> {
    return new Promise((resolve) => {
      const timeout = timeoutMs ?? 30000
      const isWin = process.platform === 'win32'
      const shell = isWin ? 'cmd.exe' : '/bin/bash'
      const shellArg = isWin ? '/c' : '-c'

      // 环境变量白名单：避免将 AWS keys、API tokens 等敏感变量泄露给子进程
      const safeEnv: Record<string, string | undefined> = {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        LANG: process.env.LANG,
        USER: process.env.USER,
        SHELL: process.env.SHELL,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'aela',
      }
      const proc = spawn(shell, [shellArg, command], {
        cwd: this.rootDir,
        env: safeEnv,
        timeout,
      })

      // stdout/stderr 输出上限（防止 OOM）
      const MAX_BUFFER_BYTES = 5 * 1024 * 1024 // 5 MB
      const TRUNCATION_MARKER = '\n[... output truncated ...]'
      let stdout = ''
      let stderr = ''
      let stdoutTruncated = false
      let stderrTruncated = false

      const appendWithCap = (
        target: 'stdout' | 'stderr',
        data: string
      ): boolean => {
        const buf = target === 'stdout' ? stdout : stderr
        const remaining = MAX_BUFFER_BYTES - buf.length
        if (remaining <= 0) {
          if (target === 'stdout') stdoutTruncated = true
          else stderrTruncated = true
          return false
        }
        const slice = data.length <= remaining ? data : data.slice(0, remaining)
        if (target === 'stdout') {
          stdout += slice
          if (slice.length < data.length) stdoutTruncated = true
        } else {
          stderr += slice
          if (slice.length < data.length) stderrTruncated = true
        }
        return true
      }

      proc.stdout.on('data', (data) => {
        appendWithCap('stdout', data.toString())
      })
      proc.stderr.on('data', (data) => {
        appendWithCap('stderr', data.toString())
      })

      // 主动超时清理：Node spawn 的 timeout 选项先发 SIGTERM，
      // 留 2 秒优雅退出窗口后，再发 SIGKILL 强杀（避免 SIGTERM/SIGKILL 竞争）
      // 注意：Windows 上 proc.kill() 直接调用 TerminateProcess，无 SIGTERM/SIGKILL 区分，
      // 2 秒优雅期在 Windows 上仅是空等，但为保持跨平台一致性和未来 Node API 变更兼容性予以保留
      let timedOut = false
      const killTimer = setTimeout(() => {
        timedOut = true
        try {
          if (process.platform === 'win32') {
            // Windows: TerminateProcess 是即时操作，无需 SIGKILL
            proc.kill()
          } else {
            proc.kill('SIGKILL')
          }
        } catch {
          /* ignore */
        }
      }, timeout + 2000)
      // 不阻止进程退出
      if (typeof killTimer.unref === 'function') killTimer.unref()

      const finalize = (code: number | null) => {
        clearTimeout(killTimer)
        const output: string[] = []
        if (stdout) {
          output.push(`[stdout]\n${stdout}`)
          if (stdoutTruncated) output.push(TRUNCATION_MARKER)
        }
        if (stderr) {
          output.push(`[stderr]\n${stderr}`)
          if (stderrTruncated) output.push(TRUNCATION_MARKER)
        }
        if (timedOut) {
          output.push(`[error] 命令执行超时 (${timeout}ms)，已强制终止`)
        } else {
          output.push(`[exit code: ${code}]`)
        }
        resolve(output.join('\n'))
      }

      proc.on('close', (code) => finalize(code))
      proc.on('error', (err) => {
        clearTimeout(killTimer)
        resolve(`[error] ${err.message}`)
      })
    })
  }
}

// ===== 代码搜索 =====
export class CodeSearchTool implements Tool {
  name = 'search_code'
  description = '在工作区中搜索代码内容。支持正则表达式和文件扩展名过滤。'
  parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: '搜索关键词或正则表达式' },
      extension: { type: 'string', description: '文件扩展名过滤，如 .ts, .go（可选）' },
      maxResults: { type: 'number', description: '最大结果数，默认 50' }
    },
    required: ['query']
  }

  constructor(private rootDir: string) {}

  async execute(args: { query: string; extension?: string; maxResults?: number }): Promise<string> {
    const maxResults = args.maxResults ?? 50
    const results: string[] = []
    let regex: RegExp
    try {
      regex = new RegExp(args.query, 'i')
    } catch {
      regex = new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }

    await this.searchDir(this.rootDir, regex, args.extension, results, maxResults)

    if (results.length === 0) {
      return `未找到匹配 "${args.query}" 的内容`
    }

    return `找到 ${results.length} 个匹配:\n\n${results.join('\n\n')}`
  }

  private async searchDir(
    dir: string,
    regex: RegExp,
    extension: string | undefined,
    results: string[],
    max: number
  ): Promise<void> {
    if (results.length >= max) return

    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (results.length >= max) return
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === '.git') continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await this.searchDir(fullPath, regex, extension, results, max)
      } else {
        if (extension && extname(entry.name) !== extension) continue
        // 跳过二进制文件
        const ext = extname(entry.name)
        if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.gz', '.tar'].includes(ext)) continue

        try {
          const content = await readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          const relPath = relative(this.rootDir, fullPath)
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`)
              if (results.length >= max) return
            }
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  }
}

// ===== 获取项目结构 =====
export class ProjectStructureTool implements Tool {
  name = 'get_project_structure'
  description = '获取工作区的项目目录结构树。'
  parameters = {
    type: 'object' as const,
    properties: {
      depth: { type: 'number', description: '目录深度，默认 3' }
    },
    required: []
  }

  constructor(private rootDir: string) {}

  async execute(args: { depth?: number }): Promise<string> {
    const maxDepth = args.depth ?? 3
    const lines: string[] = []
    await this.buildTree(this.rootDir, '', 0, maxDepth, lines)
    return `项目结构:\n${lines.join('\n')}`
  }

  private async buildTree(dir: string, prefix: string, depth: number, maxDepth: number, lines: string[]): Promise<void> {
    if (depth >= maxDepth) return

    const entries = await readdir(dir, { withFileTypes: true })
    const filtered = entries.filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.git')
    filtered.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i]
      const isLast = i === filtered.length - 1
      const connector = isLast ? '└── ' : '├── '
      lines.push(`${prefix}${connector}${entry.name}`)

      if (entry.isDirectory()) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ')
        await this.buildTree(join(dir, entry.name), newPrefix, depth + 1, maxDepth, lines)
      }
    }
  }
}

// ===== HTTP 请求 =====
export class HttpFetchTool implements Tool {
  name = 'http_fetch'
  description = '发起 HTTP/HTTPS 请求，获取网页内容或 API 响应。'
  parameters = {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: '请求 URL' },
      method: { type: 'string', description: 'HTTP 方法 (GET/POST/PUT/DELETE)，默认 GET' },
      headers: { type: 'object', description: '请求头' },
      body: { type: 'string', description: '请求体 (POST/PUT 时使用)' }
    },
    required: ['url']
  }

  async execute(args: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<string> {
    try {
      const resp = await fetch(args.url, {
        method: args.method ?? 'GET',
        headers: args.headers,
        body: args.body,
      })
      const text = await resp.text()
      return `HTTP ${resp.status} ${resp.statusText}\n\n${text.slice(0, 10000)}`
    } catch (err: unknown) {
      return `HTTP 请求失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}
