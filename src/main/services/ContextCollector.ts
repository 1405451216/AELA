import { execSync } from 'child_process'
import { existsSync, statSync } from 'fs'
import { join, relative } from 'path'

export interface EditorContext {
  activeFile: string | null
  cursorLine: number
  selectedText: string
  openFiles: string[]
}

export interface TerminalEntry {
  command: string
  output: string
  timestamp: string
}

export interface DiagnosticInfo {
  errors: number
  warnings: number
  files: string[]
}

export interface ContextBlock {
  activeFile?: EditorContext
  terminalHistory: TerminalEntry[]
  gitStatus?: { modified: string[]; untracked: string[] }
  diagnostics?: DiagnosticInfo
  timestamp: string
}

export class ContextCollector {
  private editorContext: EditorContext = { activeFile: null, cursorLine: 0, selectedText: '', openFiles: [] }
  private terminalHistory: TerminalEntry[] = []
  private maxTerminalHistory = 20
  private workspaceRoot: string | null = null

  setWorkspaceRoot(root: string): void {
    this.workspaceRoot = root
  }

  updateEditor(ctx: Partial<EditorContext>): void {
    this.editorContext = { ...this.editorContext, ...ctx }
  }

  addTerminalOutput(cmd: string, output: string): void {
    this.terminalHistory.push({
      command: cmd,
      output: output.slice(0, 500),
      timestamp: new Date().toISOString(),
    })
    if (this.terminalHistory.length > this.maxTerminalHistory) {
      this.terminalHistory.shift()
    }
  }

  async collect(): Promise<ContextBlock> {
    const block: ContextBlock = {
      activeFile: this.editorContext.activeFile ? { ...this.editorContext } : undefined,
      terminalHistory: [...this.terminalHistory],
      timestamp: new Date().toISOString(),
    }

    if (this.workspaceRoot && existsSync(join(this.workspaceRoot, '.git'))) {
      try {
        const output = execSync('git status --porcelain', { cwd: this.workspaceRoot, encoding: 'utf-8', timeout: 2000 })
        const lines = output.split('\n').filter(Boolean)
        const modified: string[] = []
        const untracked: string[] = []
        for (const line of lines) {
          const status = line.slice(0, 2)
          const file = line.slice(3)
          if (status === '??') untracked.push(file)
          else modified.push(file)
        }
        if (modified.length > 0 || untracked.length > 0) {
          block.gitStatus = { modified, untracked }
        }
      } catch {
      }
    }

    if (this.workspaceRoot) {
      const tsErrors = this.scanTsDiagnostics()
      if (tsErrors.errors > 0 || tsErrors.warnings > 0) {
        block.diagnostics = tsErrors
      }
    }

    return block
  }

  private scanTsDiagnostics(): DiagnosticInfo {
    const result: DiagnosticInfo = { errors: 0, warnings: 0, files: [] }
    const eslintPath = this.workspaceRoot ? join(this.workspaceRoot, '.eslintrc.json') : null
    if (!this.workspaceRoot) return result

    try {
      const output = execSync(
        'npx tsc --noEmit --pretty false 2>&1 || true',
        { cwd: this.workspaceRoot, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
      )
      const errorLines = output.split('\n').filter(l => l.includes('error TS'))
      const files = new Set<string>()
      for (const line of errorLines) {
        const match = line.match(/^(.+)\((\d+,\d+):/)
        if (match) files.add(match[1])
      }
      result.errors = errorLines.length
      result.files = Array.from(files).slice(0, 10)
    } catch {
    }

    return result
  }

  formatForPrompt(block: ContextBlock): string {
    const parts: string[] = []
    if (block.activeFile) {
      parts.push(`## 当前编辑上下文`)
      parts.push(`活跃文件: ${block.activeFile.activeFile}`)
      parts.push(`光标行: ${block.activeFile.cursorLine}`)
      if (block.activeFile.selectedText) {
        parts.push(`选中内容:\n\`\`\`\n${block.activeFile.selectedText.slice(0, 500)}\n\`\`\``)
      }
    }
    if (block.terminalHistory.length > 0) {
      parts.push(`## 最近终端命令`)
      for (const entry of block.terminalHistory.slice(-5)) {
        parts.push(`> ${entry.command}\n${entry.output.slice(0, 300)}`)
      }
    }
    if (block.gitStatus) {
      const { modified, untracked } = block.gitStatus
      if (modified.length > 0) parts.push(`## Git 修改: ${modified.join(', ')}`)
      if (untracked.length > 0) parts.push(`## 未跟踪: ${untracked.join(', ')}`)
    }
    if (block.diagnostics) {
      parts.push(`## 诊断: ${block.diagnostics.errors} 错误, ${block.diagnostics.warnings} 警告`)
    }
    return parts.join('\n\n')
  }
}
