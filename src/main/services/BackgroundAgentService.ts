import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type { MicroAgent, MicroAgentResult } from './MicroAgent'
import type { CheckpointService } from './CheckpointService'
import type { CostTrackerService } from './CostTrackerService'
import type { TerminalService } from './TerminalService'
import type { LSPService } from './LSPService'
import { TERMINAL_ERROR_PATTERNS } from './terminalErrorPatterns'

export type BackgroundAgentStatus = 'idle' | 'running' | 'paused'

export interface PendingDiff {
  id: string
  filePath: string
  description: string
  originalContent: string
  fixedContent: string
  checkpointId: string
  timestamp: string
  triggerSource: 'terminal' | 'fileWatcher' | 'lspDiagnostic'
}

interface DiffDecision {
  diffId: string
  accepted: boolean
}

export class BackgroundAgentService {
  private status: BackgroundAgentStatus = 'idle'
  private pendingDiff: PendingDiff | null = null
  private diffDecisionQueue: DiffDecision[] = []
  private runTimestamps: number[] = []
  private readonly maxRunsPerHour = 20
  private readonly statusListeners: Set<(status: BackgroundAgentStatus) => void> = new Set()
  private readonly diffListeners: Set<(diff: PendingDiff) => void> = new Set()
  private getMainWindow: () => BrowserWindow | null
  private microAgent: MicroAgent
  private checkpointService: CheckpointService | null = null
  private costTracker: CostTrackerService | null = null
  private terminalService: TerminalService | null = null
  private lspService: LSPService | null = null
  private terminalOutputBuffer: Map<string, string> = new Map()
  private terminalDataHandlers: Map<string, (...args: unknown[]) => void> = new Map()

  constructor(
    getMainWindow: () => BrowserWindow | null,
    microAgent: MicroAgent,
  ) {
    this.getMainWindow = getMainWindow
    this.microAgent = microAgent
  }

  setCheckpointService(service: CheckpointService): void {
    this.checkpointService = service
  }

  setCostTracker(service: CostTrackerService): void {
    this.costTracker = service
  }

  getMicroAgent(): MicroAgent {
    return this.microAgent
  }

  getStatus(): BackgroundAgentStatus {
    return this.status
  }

  subscribeStatus(listener: (status: BackgroundAgentStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  subscribeDiff(listener: (diff: PendingDiff) => void): () => void {
    this.diffListeners.add(listener)
    return () => this.diffListeners.delete(listener)
  }

  private setStatus(status: BackgroundAgentStatus): void {
    this.status = status
    for (const listener of this.statusListeners) {
      listener(status)
    }
    this.pushStatusToRenderer(status)
  }

  private pushStatusToRenderer(status: BackgroundAgentStatus): void {
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('bg-agent:status', status)
    }
  }

  private pushDiffToRenderer(diff: PendingDiff): void {
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('bg-agent:diff', diff)
    }
    for (const listener of this.diffListeners) {
      listener(diff)
    }
  }

  private hasRunCap(): boolean {
    const oneHourAgo = Date.now() - 3600000
    this.runTimestamps = this.runTimestamps.filter(t => t > oneHourAgo)
    return this.runTimestamps.length >= this.maxRunsPerHour
  }

  private recordRun(): void {
    this.runTimestamps.push(Date.now())
  }

  private isBudgetExceeded(): boolean {
    if (!this.costTracker) return false
    const budget = this.costTracker.getBudget()
    if (!budget || budget.maxTotalCostUSD === undefined) return false
    const summary = this.costTracker.summary()
    return summary.totalCostUSD >= budget.maxTotalCostUSD
  }

  extractFilePathsFromOutput(output: string): string[] {
    const paths: string[] = []
    const normalized = output.replace(/\\/g, '/')
    const patterns: RegExp[] = [
      /([\w./\-]+\.tsx?)[\s(,:;]|$/gm,
      /([\w./\-]+\.jsx?)[\s(,:;]|$/gm,
    ]
    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(normalized)) !== null) {
        const raw = match[1]
        if (!raw || raw.includes('node_modules')) continue
        const path = raw.startsWith('./') ? raw.slice(2) : raw
        if (!paths.includes(path)) paths.push(path)
      }
    }
    return paths
  }

  async triggerFromTerminal(terminalId: string, output: string): Promise<void> {
    const matchedPattern = this.detectErrorPattern(output)
    if (!matchedPattern) return

    const filePaths = this.extractFilePathsFromOutput(output)
    if (filePaths.length === 0) return

    const filePath = filePaths[0]
    const diagnostics = this.buildDiagnostics(output, matchedPattern)
    await this.runFix(filePath, diagnostics, 'terminal')
  }

  async triggerFromFileWatcher(filePath: string, diagnostics: string): Promise<void> {
    await this.runFix(filePath, diagnostics, 'fileWatcher')
  }

  async triggerFromLSPDiagnostic(filePath: string, diagnostics: string): Promise<void> {
    await this.runFix(filePath, diagnostics, 'lspDiagnostic')
  }

  private async runFix(
    filePath: string,
    diagnostics: string,
    triggerSource: PendingDiff['triggerSource'],
  ): Promise<void> {
    if (this.hasRunCap()) return
    if (this.isBudgetExceeded()) return
    if (this.status === 'running') return

    this.setStatus('running')
    this.recordRun()

    try {
      const result = await this.microAgent.run(filePath, diagnostics)
      if (!result) {
        this.setStatus('idle')
        return
      }

      let checkpointId = ''
      if (this.checkpointService) {
        const relativePath = filePath.replace(/\\/g, '/').replace(/^.*?(?=src\/|lib\/|app\/|packages\/)/, '').replace(/^\//, '') || filePath
        checkpointId = await this.checkpointService.createCheckpoint(
          'bg-agent',
          [relativePath],
          `BackgroundAgent: ${result.description}`,
        )
      }

      const diff: PendingDiff = {
        id: randomUUID(),
        filePath: result.filePath,
        description: result.description,
        originalContent: result.originalContent,
        fixedContent: result.fixedContent,
        checkpointId,
        timestamp: new Date().toISOString(),
        triggerSource,
      }

      this.pendingDiff = diff
      this.pushDiffToRenderer(diff)
      this.setStatus('idle')
    } catch {
      this.setStatus('idle')
    }
  }

  private detectErrorPattern(output: string): { pattern: string; type: string } | null {
    for (const entry of TERMINAL_ERROR_PATTERNS) {
      if (entry.regex.test(output)) {
        return { pattern: entry.description, type: entry.type }
      }
    }
    return null
  }

  private buildDiagnostics(output: string, match: { pattern: string; type: string }): string {
    const lines = output.split('\n').filter(l => l.trim().length > 0)
    const relevantLines = lines.slice(-10).join('\n')
    return `[${match.type}] ${match.pattern}\n\n终端输出:\n${relevantLines}`
  }

  async acceptDiff(diffId: string): Promise<boolean> {
    if (!this.pendingDiff || this.pendingDiff.id !== diffId) return false
    this.diffDecisionQueue.push({ diffId, accepted: true })
    this.pendingDiff = null
    this.setStatus('idle')
    return true
  }

  async rejectDiff(diffId: string): Promise<boolean> {
    if (!this.pendingDiff || this.pendingDiff.id !== diffId) return false
    const checkpointId = this.pendingDiff.checkpointId
    if (checkpointId && this.checkpointService) {
      await this.checkpointService.restoreCheckpoint(checkpointId)
    }
    this.diffDecisionQueue.push({ diffId, accepted: false })
    this.pendingDiff = null
    this.setStatus('idle')
    return true
  }

  getPendingDiff(): PendingDiff | null {
    return this.pendingDiff
  }

  setStatusForTest(status: BackgroundAgentStatus): void {
    this.setStatus(status)
  }

  connectTerminalService(service: TerminalService): void {
    if (this.terminalService) return
    this.terminalService = service
    const existingTabs = service.list()
    for (const tabId of existingTabs) {
      this.subscribeTerminalOutput(service, tabId)
    }
  }

  private subscribeTerminalOutput(service: TerminalService, terminalId: string): void {
    const handler = (_tabId: unknown, data: unknown) => {
      if (typeof data !== 'string') return
      const buffer = (this.terminalOutputBuffer.get(terminalId) ?? '') + data
      this.terminalOutputBuffer.set(terminalId, buffer.slice(-4096))
      void this.triggerFromTerminal(terminalId, buffer)
    }
    this.terminalDataHandlers.set(terminalId, handler)
  }

  stop(): void {
    this.setStatus('idle')
    this.terminalOutputBuffer.clear()
    this.terminalDataHandlers.clear()
    this.terminalService = null
    this.lspService = null
  }
}


