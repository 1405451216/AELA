import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MicroAgent, MicroAgentResult } from '../../src/main/services/MicroAgent'
import type { CheckpointService } from '../../src/main/services/CheckpointService'
import type { CostTrackerService } from '../../src/main/services/CostTrackerService'
import type { TerminalService } from '../../src/main/services/TerminalService'
import type { BudgetConfig } from '@shared/types'
import { BackgroundAgentService } from '../../src/main/services/BackgroundAgentService'
import type { PendingDiff } from '../../src/main/services/BackgroundAgentService'

vi.mock('electron', () => ({
  BrowserWindow: {},
  webContents: {},
}))

function createMockWindow() {
  const win = {
    isDestroyed: vi.fn().mockReturnValue(false),
    webContents: { send: vi.fn() },
  }
  return vi.fn().mockReturnValue(win) as unknown as () => Electron.BrowserWindow | null
}

function createMicroAgent(result: MicroAgentResult | null, _shouldThrow = false): MicroAgent {
  return {
    run: vi.fn().mockResolvedValue(result),
  } as unknown as MicroAgent
}

function createMicroAgentWithError(): MicroAgent {
  return {
    run: vi.fn().mockRejectedValue(new Error('timeout')),
  } as unknown as MicroAgent
}

function createCheckpointService(): CheckpointService {
  return {
    createCheckpoint: vi.fn().mockResolvedValue('checkpoint-123'),
    restoreCheckpoint: vi.fn().mockResolvedValue(1),
    getCheckpoint: vi.fn(),
    getSessionCheckpoints: vi.fn().mockReturnValue([]),
    deleteCheckpoint: vi.fn().mockReturnValue(true),
    clearSessionCheckpoints: vi.fn(),
    getStats: vi.fn().mockReturnValue({ totalCheckpoints: 0, totalSessions: 0, totalFiles: 0 }),
    setRootDir: vi.fn(),
    stop: vi.fn(),
  } as unknown as CheckpointService
}

function createCostTracker(budget?: BudgetConfig): CostTrackerService {
  return {
    getBudget: vi.fn().mockReturnValue(budget ?? null),
    summary: vi.fn().mockReturnValue({
      totalCostUSD: 0,
      totalPromptTokens: 0,
      totalCompTokens: 0,
      totalTokens: 0,
      callCount: 0,
      byModel: {},
    }),
    record: vi.fn().mockReturnValue(false),
    setBudget: vi.fn(),
    getPricing: vi.fn(),
    setPricing: vi.fn(),
    listPricing: vi.fn().mockReturnValue([]),
    estimateCost: vi.fn().mockReturnValue(0),
    checkBudget: vi.fn().mockReturnValue(false),
    getRecords: vi.fn().mockReturnValue([]),
    reset: vi.fn(),
    stop: vi.fn(),
  } as unknown as CostTrackerService
}

function createCostTrackerOverBudget(): CostTrackerService {
  return {
    getBudget: vi.fn().mockReturnValue({ maxTotalCostUSD: 10 }),
    summary: vi.fn().mockReturnValue({
      totalCostUSD: 10,
      totalPromptTokens: 1000,
      totalCompTokens: 500,
      totalTokens: 1500,
      callCount: 5,
      byModel: {},
    }),
  } as unknown as CostTrackerService
}

function createTerminalService(): TerminalService {
  return {
    list: vi.fn().mockReturnValue([]),
    create: vi.fn(),
    destroy: vi.fn(),
    input: vi.fn(),
    resize: vi.fn(),
    listTabs: vi.fn(),
    setActiveTab: vi.fn(),
    getActiveTab: vi.fn(),
    setTabTitle: vi.fn(),
    linkToAgent: vi.fn(),
    getCommandHistory: vi.fn().mockReturnValue([]),
    clearCommandHistory: vi.fn(),
    runCommand: vi.fn(),
    destroyAll: vi.fn(),
    stop: vi.fn(),
  } as unknown as TerminalService
}

describe('BackgroundAgentService', () => {
  let service: BackgroundAgentService
  let getWindow: () => Electron.BrowserWindow | null

  beforeEach(() => {
    vi.clearAllMocks()
    getWindow = createMockWindow()
  })

  afterEach(() => {
    if (service) service.stop()
  })

  it('初始状态为 idle', () => {
    const agent = createMicroAgent(null)
    service = new BackgroundAgentService(getWindow, agent)
    expect(service.getStatus()).toBe('idle')
  })

  it('应订阅状态变化', () => {
    const agent = createMicroAgent(null)
    service = new BackgroundAgentService(getWindow, agent)
    const listener = vi.fn()
    service.subscribeStatus(listener)
    service.setStatusForTest('running')
    expect(listener).toHaveBeenCalledWith('running')
  })

  it('应在 MicroAgent 修复成功后推送 diff', async () => {
    const fixResult: MicroAgentResult = {
      filePath: 'src/app.ts',
      originalContent: 'const x = 1',
      fixedContent: 'const x: number = 1',
      description: '添加类型注解',
    }
    const agent = createMicroAgent(fixResult)
    service = new BackgroundAgentService(getWindow, agent)

    const checkpoint = createCheckpointService()
    service.setCheckpointService(checkpoint)

    const costTracker = createCostTracker()
    service.setCostTracker(costTracker)

    const diffListener = vi.fn()
    service.subscribeDiff(diffListener)

    await service.triggerFromTerminal('term-1', 'app.ts(1,7): error TS2322: Type number is not assignable')

    expect(diffListener).toHaveBeenCalledTimes(1)
    const diff: PendingDiff = diffListener.mock.calls[0][0]
    expect(diff.description).toBe('添加类型注解')
    expect(diff.triggerSource).toBe('terminal')
    expect(diff.originalContent).toBe('const x = 1')
    expect(diff.fixedContent).toBe('const x: number = 1')
    expect(checkpoint.createCheckpoint).toHaveBeenCalled()
  })

  it('应在 MicroAgent 返回 null 时不推送 diff', async () => {
    const agent = createMicroAgent(null)
    service = new BackgroundAgentService(getWindow, agent)

    const checkpoint = createCheckpointService()
    service.setCheckpointService(checkpoint)

    const diffListener = vi.fn()
    service.subscribeDiff(diffListener)

    await service.triggerFromTerminal('term-1', 'app.ts(1,7): error TS2322')

    expect(diffListener).not.toHaveBeenCalled()
    expect(checkpoint.createCheckpoint).not.toHaveBeenCalled()
  })

  it('应接受 pending diff', async () => {
    const fixResult: MicroAgentResult = {
      filePath: 'test.ts',
      originalContent: 'let y',
      fixedContent: 'let y: string',
      description: '添加类型',
    }
    const agent = createMicroAgent(fixResult)
    service = new BackgroundAgentService(getWindow, agent)
    service.setCheckpointService(createCheckpointService())
    service.setCostTracker(createCostTracker())

    await service.triggerFromTerminal('term-1', 'test.ts(1,5): error TS7006')

    const diff = service.getPendingDiff()
    expect(diff).not.toBeNull()

    const result = await service.acceptDiff(diff!.id)
    expect(result).toBe(true)
    expect(service.getPendingDiff()).toBeNull()
  })

  it('应拒绝 pending diff 并回滚 checkpoint', async () => {
    const fixResult: MicroAgentResult = {
      filePath: 'test.ts',
      originalContent: 'let z',
      fixedContent: 'let z: number',
      description: '添加类型',
    }
    const agent = createMicroAgent(fixResult)
    service = new BackgroundAgentService(getWindow, agent)
    const checkpoint = createCheckpointService()
    service.setCheckpointService(checkpoint)
    service.setCostTracker(createCostTracker())

    await service.triggerFromTerminal('term-1', 'test.ts(1,5): error TS7006')

    const diff = service.getPendingDiff()
    expect(diff).not.toBeNull()

    const result = await service.rejectDiff(diff!.id)
    expect(result).toBe(true)
    expect(checkpoint.restoreCheckpoint).toHaveBeenCalledWith(diff!.checkpointId)
    expect(service.getPendingDiff()).toBeNull()
  })

  it('应阻止超过每小时 20 次的运行', async () => {
    const fixResult: MicroAgentResult = {
      filePath: 'test.ts',
      originalContent: 'const a = 1',
      fixedContent: 'const a: number = 1',
      description: '修复类型',
    }
    const agent = createMicroAgent(fixResult)
    service = new BackgroundAgentService(getWindow, agent)
    service.setCheckpointService(createCheckpointService())
    service.setCostTracker(createCostTracker())

    const diffListener = vi.fn()
    service.subscribeDiff(diffListener)

    for (let i = 0; i < 21; i++) {
      await service.triggerFromTerminal(`term-${i}`, `test.ts(${i},1): error TS2322`)
    }

    expect(diffListener).toHaveBeenCalledTimes(20)
  })

  it('应在预算耗尽时阻止运行', async () => {
    const fixResult: MicroAgentResult = {
      filePath: 'test.ts',
      originalContent: 'const b = 1',
      fixedContent: 'const b: number = 1',
      description: '修复类型',
    }
    const agent = createMicroAgent(fixResult)
    service = new BackgroundAgentService(getWindow, agent)
    service.setCheckpointService(createCheckpointService())
    service.setCostTracker(createCostTrackerOverBudget())

    const diffListener = vi.fn()
    service.subscribeDiff(diffListener)

    await service.triggerFromTerminal('term-1', 'test.ts(1,1): error TS2322')

    expect(diffListener).not.toHaveBeenCalled()
  })

  it('应从 fileWatcher 触发', async () => {
    const fixResult: MicroAgentResult = {
      filePath: 'src/main.ts',
      originalContent: 'function foo() {}',
      fixedContent: 'function foo(): void {}',
      description: '添加返回类型',
    }
    const agent = createMicroAgent(fixResult)
    service = new BackgroundAgentService(getWindow, agent)
    service.setCheckpointService(createCheckpointService())
    service.setCostTracker(createCostTracker())

    const diffListener = vi.fn()
    service.subscribeDiff(diffListener)

    await service.triggerFromFileWatcher('src/main.ts', 'TS7006: Parameter implicitly has an any type')

    expect(diffListener).toHaveBeenCalledTimes(1)
    const diff: PendingDiff = diffListener.mock.calls[0][0]
    expect(diff.triggerSource).toBe('fileWatcher')
  })

  it('正确的 diffId 应被 accept 接受', async () => {
    const agent = createMicroAgent(null)
    service = new BackgroundAgentService(getWindow, agent)

    const result = await service.acceptDiff('nonexistent-id')
    expect(result).toBe(false)
  })

  it('应在 MicroAgent 抛出异常时优雅处理', async () => {
    const agent = createMicroAgentWithError()
    service = new BackgroundAgentService(getWindow, agent)
    service.setCheckpointService(createCheckpointService())
    service.setCostTracker(createCostTracker())

    await service.triggerFromTerminal('term-1', 'test.ts(1,1): error TS2322')

    expect(service.getStatus()).toBe('idle')
  })

  it('应连接 TerminalService', () => {
    const agent = createMicroAgent(null)
    service = new BackgroundAgentService(getWindow, agent)

    const terminalService = createTerminalService()
    service.connectTerminalService(terminalService)

    expect(service.getStatus()).toBe('idle')
  })

  it('接受错误的 diffId 应返回 false', async () => {
    const agent = createMicroAgent(null)
    service = new BackgroundAgentService(getWindow, agent)

    const result = await service.rejectDiff('wrong-id')
    expect(result).toBe(false)
  })

  it('应从错误输出中提取文件路径', async () => {
    const agent = createMicroAgent(null)
    service = new BackgroundAgentService(getWindow, agent)

    const paths = service.extractFilePathsFromOutput('src/app.ts(3,10): error TS2304: Cannot find name foo')
    expect(paths.length).toBeGreaterThan(0)
    expect(paths[0]).toContain('app.ts')
  })
})
