// AELA — LSP / Linter 集成服务
// 提供 LSP 客户端能力：诊断信息、代码补全、跳转定义、悬停信息
// 通过子进程管理 LSP 服务器（typescript-language-server 等）
//
// 当前实现：诊断信息收集框架（不启动外部 LSP 服务器，使用内置 TS 编译器）
// 未来可扩展为完整 LSP 客户端

import { spawn, type ChildProcess } from 'node:child_process'

export interface Diagnostic {
  filePath: string
  line: number
  column: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  code?: string
  source: string
}

export interface LSPServerConfig {
  id: string
  name: string
  command: string
  args: string[]
  rootDir: string
  languages: string[]
}

export class LSPService {
  private servers = new Map<string, ChildProcess>()
  private diagnostics = new Map<string, Diagnostic[]>()
  private listeners = new Set<(diags: Diagnostic[]) => void>()
  private enabled = true

  /**
   * 注册并启动 LSP 服务器
   */
  async startServer(config: LSPServerConfig): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn(config.command, config.args, {
          cwd: config.rootDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        // 处理启动失败（命令不存在等）
        proc.on('error', (err) => {
          console.error(`[LSP] Server ${config.name} error:`, err)
          this.servers.delete(config.id)
          resolve(false)
        })

        // 进程退出时清理
        proc.on('exit', (code) => {
          if (code !== 0) {
            console.warn(`[LSP] Server ${config.name} exited with code ${code}`)
          }
          this.servers.delete(config.id)
        })

        this.servers.set(config.id, proc)
        resolve(true)
      } catch (err) {
        console.error(`[LSP] Failed to start ${config.name}:`, err)
        resolve(false)
      }
    })
  }

  /**
   * 停止 LSP 服务器
   */
  stopServer(id: string): void {
    const proc = this.servers.get(id)
    if (proc) {
      proc.kill()
      this.servers.delete(id)
    }
  }

  /**
   * 获取文件诊断信息
   */
  getDiagnostics(filePath: string): Diagnostic[] {
    return this.diagnostics.get(filePath) || []
  }

  /**
   * 获取所有诊断信息
   */
  getAllDiagnostics(): Map<string, Diagnostic[]> {
    return new Map(this.diagnostics)
  }

  /**
   * 订阅诊断变更
   */
  onDiagnosticsChange(listener: (diags: Diagnostic[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 快速诊断：使用 tsc --noEmit 检查 TypeScript 错误
   * 这是不启动 LSP 服务器的轻量级方案
   */
  async runQuickDiagnostics(rootDir: string): Promise<Diagnostic[]> {
    return new Promise((resolve) => {
      let settled = false
      const finish = (diags: Diagnostic[]) => {
        if (settled) return
        settled = true
        resolve(diags)
      }

      const tsc = spawn('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
        cwd: rootDir,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      tsc.on('error', () => {
        finish([])
      })

      let output = ''
      tsc.stdout.on('data', (data) => { output += data.toString() })
      tsc.stderr.on('data', (data) => { output += data.toString() })

      tsc.on('close', () => {
        const diags = this.parseTscOutput(output)
        for (const d of diags) {
          const existing = this.diagnostics.get(d.filePath) || []
          this.diagnostics.set(d.filePath, [...existing, d])
        }
        for (const listener of this.listeners) {
          listener(diags)
        }
        finish(diags)
      })

      // 10 秒超时
      setTimeout(() => {
        tsc.kill()
        finish([])
      }, 10000)
    })
  }

  /**
   * 解析 tsc 输出为 Diagnostic 列表
   */
  private parseTscOutput(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split('\n')
    const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/

    for (const line of lines) {
      const match = line.match(errorRegex)
      if (match) {
        diagnostics.push({
          filePath: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          severity: match[4] as 'error' | 'warning',
          code: match[5],
          message: match[6],
          source: 'typescript',
        })
      }
    }

    return diagnostics
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 停止所有服务器
   */
  stop(): void {
    for (const [id] of this.servers) {
      this.stopServer(id)
    }
    this.listeners.clear()
  }
}
