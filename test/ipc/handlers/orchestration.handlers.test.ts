/**
 * Orchestration IPC handler 单测（.orchestration.handlers.test.ts）
 *
 * 覆盖核心 handler：orchestration:run / orchestration:stop / dag:run / collaboration:run
 * 重点：handler 存在 + zod 校验失败 + 流式事件转发 + service 调用参数正确
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron 模块 =====
const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
const mockWindowRegistry: { win: ReturnType<typeof makeMockWindow> | null } = { win: null }

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn)
    },
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => mockWindowRegistry.win),
  },
}))

import { registerOrchestrationHandlers } from '../../../src/main/ipc/handlers/orchestration'
import { IPC_CHANNELS } from '../../../src/shared/types'

// ===== 工具：构建 mock window =====
function makeMockWindow() {
  return {
    webContents: { send: vi.fn() },
  } as never
}

function withMockWindow<T>(win: ReturnType<typeof makeMockWindow>, fn: () => Promise<T>): Promise<T> {
  mockWindowRegistry.win = win
  return fn()
}

// ===== Mock 服务 =====

function makeMockOrchestrationService(overrides: Partial<{
  run: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  listTemplates: ReturnType<typeof vi.fn>
  getTemplate: ReturnType<typeof vi.fn>
  listRuns: ReturnType<typeof vi.fn>
  getRun: ReturnType<typeof vi.fn>
  getPerformanceReport: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    run: overrides.run ?? vi.fn(),
    stop: overrides.stop ?? vi.fn(),
    listTemplates: overrides.listTemplates ?? vi.fn().mockReturnValue([]),
    getTemplate: overrides.getTemplate ?? vi.fn().mockReturnValue(undefined),
    listRuns: overrides.listRuns ?? vi.fn().mockReturnValue([]),
    getRun: overrides.getRun ?? vi.fn().mockReturnValue(undefined),
    getPerformanceReport: overrides.getPerformanceReport ?? vi.fn().mockReturnValue({}),
  } as never
}

function makeMockDAGService(overrides: Partial<{
  run: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    run: overrides.run ?? vi.fn(),
    stop: overrides.stop ?? vi.fn(),
  } as never
}

function makeMockCollaborationService(overrides: Partial<{
  run: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    run: overrides.run ?? vi.fn(),
    stop: overrides.stop ?? vi.fn(),
  } as never
}

function makeMockSupervisorService(overrides: Partial<{
  addWorker: ReturnType<typeof vi.fn>
  removeWorker: ReturnType<typeof vi.fn>
  submitTask: ReturnType<typeof vi.fn>
  getStats: ReturnType<typeof vi.fn>
  listWorkers: ReturnType<typeof vi.fn>
  setStrategy: ReturnType<typeof vi.fn>
  getStrategy: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    addWorker: overrides.addWorker ?? vi.fn().mockReturnValue({ id: 'w1' }),
    removeWorker: overrides.removeWorker ?? vi.fn().mockReturnValue(true),
    submitTask: overrides.submitTask ?? vi.fn().mockReturnValue({ taskId: 't1' }),
    getStats: overrides.getStats ?? vi.fn().mockReturnValue({}),
    listWorkers: overrides.listWorkers ?? vi.fn().mockReturnValue([]),
    setStrategy: overrides.setStrategy ?? vi.fn(),
    getStrategy: overrides.getStrategy ?? vi.fn().mockReturnValue('round_robin'),
  } as never
}

function makeMockDynamicDAGService(overrides: Partial<{
  run: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    run: overrides.run ?? vi.fn(),
    stop: overrides.stop ?? vi.fn(),
  } as never
}

// ===== 测试用例 =====
describe('Orchestration IPC Handlers (.handlers)', () => {
  let osvc: ReturnType<typeof makeMockOrchestrationService>
  let dsvc: ReturnType<typeof makeMockDAGService>
  let csvc: ReturnType<typeof makeMockCollaborationService>
  let ssvc: ReturnType<typeof makeMockSupervisorService>
  let ddsvc: ReturnType<typeof makeMockDynamicDAGService>

  /** 注册 handler 的便捷封装 */
  function register() {
    registerOrchestrationHandlers({
      orchestrationService: osvc,
      dagSchedulerService: dsvc,
      collaborationService: csvc,
      supervisorService: ssvc,
      dynamicDAGService: ddsvc,
    })
  }

  beforeEach(() => {
    handlers.clear()
    osvc = makeMockOrchestrationService()
    dsvc = makeMockDAGService()
    csvc = makeMockCollaborationService()
    ssvc = makeMockSupervisorService()
    ddsvc = makeMockDynamicDAGService()
    register()
  })

  // ===== orchestration:run =====
  describe('orchestration:run', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)).toBeDefined()
    })

    it('zod 校验失败（空 goal）返回 { success: false }', async () => {
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)!

      const result = await handler({}, { goal: '' })
      expect(result).toMatchObject({ success: false })
      expect(osvc.run).not.toHaveBeenCalled()
    })

    it('zod 校验失败（缺 goal）返回 error', async () => {
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)!

      const result = await handler({}, { mode: 'basic' })
      expect(result).toMatchObject({ success: false })
    })

    it('校验通过后调用 orchestrationService.run 并转发流事件到 webContents', async () => {
      const run = vi.fn().mockReturnValue((async function* () {
        yield { type: 'agent_start', agentName: 'A' }
        yield { type: 'agent_done', agentName: 'A' }
      })())
      Object.assign(osvc, { run })
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)!
      const mockWin = makeMockWindow()

      const result = await withMockWindow(mockWin, () =>
        handler({}, { runId: 'r1', goal: 'test' }) as Promise<unknown>,
      )

      expect(run).toHaveBeenCalled()
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestration:event:/),
        { type: 'agent_start', agentName: 'A' },
      )
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestration:event:/),
        { type: 'agent_done', agentName: 'A' },
      )
      expect(result).toEqual({ success: true })
    })

    it('orchestrationService.run 异常时返回 error', async () => {
      const run = vi.fn().mockReturnValue((async function* () {
        throw new Error('orchestration failed')
      })())
      Object.assign(osvc, { run })
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)!

      const result = await handler({}, { runId: 'r1', goal: 'test' })
      expect(result).toEqual({ success: false, error: 'orchestration failed' })
    })
  })

  // ===== orchestration:stop =====
  describe('orchestration:stop', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.ORCHESTRATION_STOP)).toBeDefined()
    })

    it('调用 orchestrationService.stop 并传入 runId', async () => {
      const stop = vi.fn()
      Object.assign(osvc, { stop })
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_STOP)!

      const result = await handler({}, 'r1')
      expect(stop).toHaveBeenCalledWith('r1')
      expect(result).toEqual({ success: true })
    })

    it('空 runId 校验失败', async () => {
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_STOP)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
    })
  })

  // ===== dag:run =====
  describe('dag:run', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.DAG_RUN)).toBeDefined()
    })

    it('调用 dagSchedulerService.run 并传入 config', async () => {
      const run = vi.fn().mockReturnValue((async function* () {})())
      Object.assign(dsvc, { run })
      const handler = handlers.get(IPC_CHANNELS.DAG_RUN)!

      const config = { id: 'd1', nodes: [], edges: [] }
      const result = await handler({}, config)
      expect(run).toHaveBeenCalledWith(config)
      expect(result).toEqual({ success: true })
    })

    it('service 异常时返回 error', async () => {
      const run = vi.fn().mockReturnValue((async function* () {
        throw new Error('dag failed')
      })())
      Object.assign(dsvc, { run })
      const handler = handlers.get(IPC_CHANNELS.DAG_RUN)!

      const result = await handler({}, { id: 'd1', nodes: [], edges: [] })
      expect(result).toEqual({ success: false, error: 'dag failed' })
    })
  })

  // ===== collaboration:run =====
  describe('collaboration:run', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.COLLABORATION_RUN)).toBeDefined()
    })

    it('调用 collaborationService.run 并传入 config', async () => {
      const run = vi.fn().mockReturnValue((async function* () {
        yield { type: 'message', content: 'hi' }
      })())
      Object.assign(csvc, { run })
      const handler = handlers.get(IPC_CHANNELS.COLLABORATION_RUN)!
      const mockWin = makeMockWindow()

      const config = { id: 'c1', participants: [] }
      const result = await withMockWindow(mockWin, () =>
        handler({}, config) as Promise<unknown>,
      )

      expect(run).toHaveBeenCalledWith(config)
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        expect.stringMatching(/^collaboration:event:/),
        { type: 'message', content: 'hi' },
      )
      expect(result).toEqual({ success: true })
    })

    it('service 异常时返回 error', async () => {
      const run = vi.fn().mockReturnValue((async function* () {
        throw new Error('collab failed')
      })())
      Object.assign(csvc, { run })
      const handler = handlers.get(IPC_CHANNELS.COLLABORATION_RUN)!

      const result = await handler({}, { id: 'c1' })
      expect(result).toEqual({ success: false, error: 'collab failed' })
    })
  })
})
