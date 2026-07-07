/**
 * Orchestration IPC handler 单测
 *
 * 覆盖：ORCHESTRATION_RUN / ORCHESTRATION_STOP / DAG_RUN / SUPERVISOR_ADD_WORKER /
 *       SUPERVISOR_SUBMIT_TASK / ORCHESTRATION_TEMPLATES_LIST
 * 重点：zod 校验失败 / 流式事件转发到 webContents / 错误传播
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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

function makeMockWindow() {
  return {
    webContents: { send: vi.fn() },
  } as never
}

function withMockWindow<T>(win: ReturnType<typeof makeMockWindow>, fn: () => Promise<T>): Promise<T> {
  mockWindowRegistry.win = win
  return fn()
}

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

describe('orchestration IPC handlers', () => {
  let osvc: ReturnType<typeof makeMockOrchestrationService>
  let dsvc: ReturnType<typeof makeMockDAGService>
  let csvc: ReturnType<typeof makeMockCollaborationService>
  let ssvc: ReturnType<typeof makeMockSupervisorService>
  let ddsvc: ReturnType<typeof makeMockDynamicDAGService>

  beforeEach(() => {
    handlers.clear()
    osvc = makeMockOrchestrationService()
    dsvc = makeMockDAGService()
    csvc = makeMockCollaborationService()
    ssvc = makeMockSupervisorService()
    ddsvc = makeMockDynamicDAGService()
    registerOrchestrationHandlers({
      orchestrationService: osvc,
      dagSchedulerService: dsvc,
      collaborationService: csvc,
      supervisorService: ssvc,
      dynamicDAGService: ddsvc,
    })
  })

  // ===== ORCHESTRATION_RUN =====
  describe('ORCHESTRATION_RUN', () => {
    it('rejects empty goal (zod validation)', async () => {
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)!

      const result = await handler({}, { goal: '' })
      expect(result).toMatchObject({ success: false })
      expect(osvc.run).not.toHaveBeenCalled()
    })

    it('rejects missing goal (zod validation)', async () => {
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)!

      const result = await handler({}, { mode: 'basic' })
      expect(result).toMatchObject({ success: false })
    })

    it('forwards stream events to webContents', async () => {
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
      // channel uses config.id; in our schema the field is `runId`, so handler falls back
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

    it('returns error when orchestrationService throws', async () => {
      const run = vi.fn().mockReturnValue((async function* () {
        throw new Error('orchestration failed')
      })())
      Object.assign(osvc, { run })
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_RUN)!

      const result = await handler({}, { runId: 'r1', goal: 'test' })
      expect(result).toEqual({ success: false, error: 'orchestration failed' })
    })
  })

  // ===== ORCHESTRATION_STOP =====
  describe('ORCHESTRATION_STOP', () => {
    it('calls orchestrationService.stop with runId', async () => {
      const stop = vi.fn()
      Object.assign(osvc, { stop })
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_STOP)!

      const result = await handler({}, 'r1')
      expect(stop).toHaveBeenCalledWith('r1')
      expect(result).toEqual({ success: true })
    })

    it('rejects empty runId', async () => {
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_STOP)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
    })
  })

  // ===== DAG_RUN =====
  describe('DAG_RUN', () => {
    it('forwards config to dagSchedulerService', async () => {
      const run = vi.fn().mockReturnValue((async function* () {})())
      Object.assign(dsvc, { run })
      const handler = handlers.get(IPC_CHANNELS.DAG_RUN)!

      const result = await handler({}, { id: 'd1', nodes: [], edges: [] })
      expect(run).toHaveBeenCalledWith({ id: 'd1', nodes: [], edges: [] })
      expect(result).toEqual({ success: true })
    })
  })

  // ===== SUPERVISOR =====
  describe('SUPERVISOR_ADD_WORKER', () => {
    it('forwards worker config to addWorker', async () => {
      const addWorker = vi.fn().mockReturnValue({ id: 'w-new', name: 'worker-1' })
      Object.assign(ssvc, { addWorker })
      const handler = handlers.get(IPC_CHANNELS.SUPERVISOR_ADD_WORKER)!

      const result = await handler({}, { name: 'worker-1', modelConfigId: 'm1' })
      expect(addWorker).toHaveBeenCalledWith({ name: 'worker-1', modelConfigId: 'm1' })
      expect(result).toEqual({ success: true, data: { id: 'w-new', name: 'worker-1' } })
    })
  })

  describe('SUPERVISOR_SUBMIT_TASK', () => {
    it('defaults priority to 0 when not provided', async () => {
      const submitTask = vi.fn().mockReturnValue({ taskId: 't1' })
      Object.assign(ssvc, { submitTask })
      const handler = handlers.get(IPC_CHANNELS.SUPERVISOR_SUBMIT_TASK)!

      const result = await handler({}, {
        name: 'process-data',
        type: 'compute',
        payload: { foo: 'bar' },
      })

      expect(submitTask).toHaveBeenCalledWith({
        name: 'process-data',
        type: 'compute',
        payload: { foo: 'bar' },
        priority: 0,
      })
      expect(result).toEqual({ success: true, data: { taskId: 't1' } })
    })

    it('preserves explicit priority when provided', async () => {
      const submitTask = vi.fn().mockReturnValue({ taskId: 't2' })
      Object.assign(ssvc, { submitTask })
      const handler = handlers.get(IPC_CHANNELS.SUPERVISOR_SUBMIT_TASK)!

      await handler({}, {
        name: 'urgent',
        type: 'compute',
        payload: {},
        priority: 5,
      })

      expect(submitTask).toHaveBeenCalledWith(expect.objectContaining({ priority: 5 }))
    })
  })

  describe('SUPERVISOR_SET_STRATEGY', () => {
    it('calls setStrategy and returns current strategy', async () => {
      const setStrategy = vi.fn()
      const getStrategy = vi.fn().mockReturnValue('priority')
      Object.assign(ssvc, { setStrategy, getStrategy })
      const handler = handlers.get(IPC_CHANNELS.SUPERVISOR_SET_STRATEGY)!

      const result = await handler({}, 'priority')
      expect(setStrategy).toHaveBeenCalledWith('priority')
      expect(result).toEqual({ success: true, data: 'priority' })
    })
  })

  // ===== ORCHESTRATION_TEMPLATES_LIST =====
  describe('ORCHESTRATION_TEMPLATES_LIST', () => {
    it('returns array of templates', async () => {
      const listTemplates = vi.fn().mockReturnValue([
        { id: 'tpl-1', name: 'Code Review Pipeline' },
      ])
      Object.assign(osvc, { listTemplates })
      const handler = handlers.get(IPC_CHANNELS.ORCHESTRATION_TEMPLATES_LIST)!

      const result = await handler({})
      expect(result).toEqual({
        success: true,
        data: [{ id: 'tpl-1', name: 'Code Review Pipeline' }],
      })
    })
  })
})
