// 内置终端服务
// 基于 child_process.spawn 创建伪终端会话
// 支持 Windows (cmd.exe / powershell) 和 Unix (bash / sh)
// [升级] 增加多 Tab 管理 + 命令历史 + Agent 协作

import { spawn, exec } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import Store from 'electron-store'
import type { TerminalTabInfo, TerminalCommandHistoryEntry } from '@shared/types'
import { assessCommandRisk } from './tools/shellRisk'

interface TerminalSession {
  id: string
  title: string
  process: ChildProcess
  cwd: string
  shell: string
  createdAt: string
  isActive: boolean
  agentLinked: boolean
  // 命令历史缓冲区（用于检测完整命令执行）
  inputBuffer: string
  commandStartTime: number | null
}

interface TerminalStoreSchema {
  commandHistory: TerminalCommandHistoryEntry[]
}

export class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map()
  private getMainWindow: () => BrowserWindow | null
  private store: Store<TerminalStoreSchema>
  private commandHistory: TerminalCommandHistoryEntry[]
  private maxHistoryEntries = 500
  private activeTabId: string | null = null

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow
    this.store = new Store<TerminalStoreSchema>({
      name: 'aela-terminal',
      defaults: { commandHistory: [] },
    })
    this.commandHistory = this.store.get('commandHistory', [])
  }

  /**
   * 获取系统默认 shell
   */
  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      // 优先使用 PowerShell，回退到 cmd
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  /**
   * 创建终端会话
   */
  create(opts?: { cwd?: string; shell?: string; title?: string }): string {
    const id = randomUUID()
    const shell = opts?.shell || this.getDefaultShell()
    const cwd = opts?.cwd || process.cwd()
    const title = opts?.title || `Terminal ${this.sessions.size + 1}`

    // 构建 shell 启动参数
    const shellArgs: string[] = []
    if (process.platform === 'win32') {
      if (shell.includes('powershell') || shell.includes('pwsh')) {
        shellArgs.push('-NoLogo', '-NoExit', '-Command', 'Write-Host "AELA Terminal Ready"')
      } else {
        // cmd.exe
        shellArgs.push('/K', 'echo AELA Terminal Ready')
      }
    } else {
      shellArgs.push('--login')
    }

    // 设置环境变量模拟终端 — 使用显式白名单，避免泄漏敏感环境变量（AWS keys、tokens 等）
    const env: Record<string, string | undefined> = {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      HOME: process.env.HOME,
      PATH: process.env.PATH,
      LANG: process.env.LANG || 'en_US.UTF-8',
      USER: process.env.USER,
      SHELL: process.env.SHELL,
      TERM_PROGRAM: 'aela',
    }

    const childProcess = spawn(shell, shellArgs, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: false,
    })

    // 将之前的 active 设为非 active
    for (const [, session] of this.sessions) {
      session.isActive = false
    }

    const session: TerminalSession = {
      id,
      title,
      process: childProcess,
      cwd,
      shell,
      createdAt: new Date().toISOString(),
      isActive: true,
      agentLinked: false,
      inputBuffer: '',
      commandStartTime: null,
    }

    this.sessions.set(id, session)
    this.activeTabId = id

    // 转发 stdout 数据到渲染进程
    childProcess.stdout?.on('data', (data: Buffer) => {
      const win = this.getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(`terminal:data:${id}`, data.toString('utf-8'))
      }
    })

    // 转发 stderr 数据到渲染进程
    childProcess.stderr?.on('data', (data: Buffer) => {
      const win = this.getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(`terminal:data:${id}`, data.toString('utf-8'))
      }
    })

    // 进程退出
    childProcess.on('exit', (code: number | null) => {
      const win = this.getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(`terminal:exit:${id}`, code ?? 0)
      }
      this.sessions.delete(id)
      if (this.activeTabId === id) {
        this.activeTabId = this.sessions.size > 0 ? Array.from(this.sessions.keys())[0] : null
      }
    })

    // 错误处理
    childProcess.on('error', (err: Error) => {
      const win = this.getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send(`terminal:data:${id}`, `\r\n\x1b[31mTerminal Error: ${err.message}\x1b[0m\r\n`)
        win.webContents.send(`terminal:exit:${id}`, 1)
      }
      this.sessions.delete(id)
    })

    return id
  }

  /**
   * 向终端发送输入（同时记录命令历史）
   */
  input(id: string, data: string): boolean {
    const session = this.sessions.get(id)
    if (!session || !session.process.stdin) return false

    // 检测回车键，记录命令
    if (data.includes('\r') || data.includes('\n')) {
      const command = session.inputBuffer.trim()
      if (command.length > 0) {
        this.recordCommand(id, command)
        session.commandStartTime = Date.now()
      }
      session.inputBuffer = ''
    } else {
      // 过滤控制字符
      if (data.charCodeAt(0) >= 32 || data === '\b') {
        if (data === '\b') {
          session.inputBuffer = session.inputBuffer.slice(0, -1)
        } else {
          session.inputBuffer += data
        }
      }
    }

    session.process.stdin.write(data)
    return true
  }

  /**
   * 调整终端大小（通过环境变量模拟）
   */
  resize(id: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    // child_process 不支持真正的 PTY resize，
    // 但可以尝试发送 resize 信号（仅 Unix）
    if (process.platform !== 'win32') {
      try {
        session.process.emit('resize', cols, rows)
      } catch (err) {
        console.error('[TerminalService] resize failed:', err)
      }
    }
    return true
  }

  /**
   * 销毁终端会话
   */
  destroy(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    try {
      session.process.kill()
    } catch (err) {
      console.error('[TerminalService] destroy failed:', err)
    }
    this.sessions.delete(id)
    if (this.activeTabId === id) {
      this.activeTabId = this.sessions.size > 0 ? Array.from(this.sessions.keys())[0] : null
    }
    return true
  }

  /**
   * 列出所有终端会话 ID
   */
  list(): string[] {
    return Array.from(this.sessions.keys())
  }

  /**
   * [升级] 列出所有终端 Tab 信息
   */
  listTabs(): TerminalTabInfo[] {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      title: s.title,
      shell: s.shell,
      cwd: s.cwd,
      createdAt: s.createdAt,
      isActive: s.isActive,
      agentLinked: s.agentLinked,
    }))
  }

  /**
   * [升级] 设置活跃 Tab
   */
  setActiveTab(id: string): boolean {
    if (!this.sessions.has(id)) return false
    for (const [, session] of this.sessions) {
      session.isActive = (session.id === id)
    }
    this.activeTabId = id
    return true
  }

  /**
   * [升级] 获取活跃 Tab ID
   */
  getActiveTab(): string | null {
    return this.activeTabId
  }

  /**
   * [升级] 设置 Tab 标题
   */
  setTabTitle(id: string, title: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.title = title
    return true
  }

  /**
   * [升级] 标记 Tab 为 Agent 关联
   */
  linkToAgent(id: string): boolean {
    const session = this.sessions.get(id)
    if (!session) return false
    session.agentLinked = true
    session.title = `Agent Terminal`
    return true
  }

  // ===== [升级] 命令历史 =====

  /**
   * 记录命令到历史
   */
  private recordCommand(terminalId: string, command: string): void {
    const entry: TerminalCommandHistoryEntry = {
      id: randomUUID(),
      terminalId,
      command,
      exitCode: null, // 退出码在命令完成后通过其他方式获取
      timestamp: new Date().toISOString(),
      duration: 0,
    }
    this.commandHistory.push(entry)

    // 限制历史记录数量
    if (this.commandHistory.length > this.maxHistoryEntries) {
      this.commandHistory = this.commandHistory.slice(-this.maxHistoryEntries)
    }
    this.store.set('commandHistory', this.commandHistory)
  }

  /**
   * 获取命令历史
   */
  getCommandHistory(terminalId?: string, limit?: number): TerminalCommandHistoryEntry[] {
    let history = terminalId
      ? this.commandHistory.filter(h => h.terminalId === terminalId)
      : [...this.commandHistory]
    history = history.reverse()
    return limit ? history.slice(0, limit) : history
  }

  /**
   * 清空命令历史
   */
  clearCommandHistory(): void {
    this.commandHistory = []
    this.store.set('commandHistory', this.commandHistory)
  }

  // ===== [升级] Agent 协作：执行命令并返回结果 =====

  /**
   * 执行单条命令并返回输出（非交互式，供 Agent 调用）
   */
  runCommand(command: string, opts?: { cwd?: string; timeout?: number }): Promise<{
    stdout: string
    stderr: string
    exitCode: number
    duration: number
  }> {
    // 安全检查：复用 agent 命令路径的风险评估，阻止危险命令直接通过非交互通道执行
    const assessment = assessCommandRisk(command)
    if (assessment.risk === 'dangerous') {
      return Promise.resolve({
        stdout: '',
        stderr: `[安全拦截] 危险命令被阻止执行。\n命令: ${command}\n风险: ${assessment.reasons.join('; ')}`,
        exitCode: 1,
        duration: 0,
      })
    }

    return new Promise((resolve) => {
      const startTime = Date.now()
      const cwd = opts?.cwd || process.cwd()
      const timeout = opts?.timeout ?? 30000

      exec(command, { cwd, timeout, maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
        const duration = Date.now() - startTime
        // err.code 在 child_process 中通常是字符串（如 'ENOENT'），而非数字
        const rawCode = err ? (err as NodeJS.ErrnoException).code : null
        const exitCode = err
          ? (typeof rawCode === 'number' ? rawCode : 1)
          : 0

        // 记录到历史
        const entry: TerminalCommandHistoryEntry = {
          id: randomUUID(),
          terminalId: 'agent-exec',
          command,
          exitCode,
          timestamp: new Date().toISOString(),
          duration,
        }
        this.commandHistory.push(entry)
        if (this.commandHistory.length > this.maxHistoryEntries) {
          this.commandHistory = this.commandHistory.slice(-this.maxHistoryEntries)
        }
        this.store.set('commandHistory', this.commandHistory)

        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode,
          duration,
        })
      })
    })
  }

  /**
   * 销毁所有终端会话
   */
  destroyAll(): void {
    for (const [, session] of this.sessions) {
      try {
        session.process.kill()
      } catch (err) {
        console.error('[TerminalService] destroy session failed:', err)
      }
    }
    this.sessions.clear()
    this.activeTabId = null
  }

  /** 生命周期停止方法，确保子进程在应用退出时被清理 */
  stop(): void {
    this.destroyAll()
  }
}
