/**
 * Agent IPC handler 单测
 *
 * 覆盖：AGENT_STREAM / AGENT_STOP / AGENT_PAUSE / AGENT_RESUME / AGENT_STATUS
 * 重点：zod 校验失败路径 + 流式事件 webContents 转发 + 窗口关闭中断保护
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron 模块（拦截 ipcMain.handle） =====
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

vi.mock('../../../src/main/utils/shellConfirm', () => ({
  showShellConfirmDialog: vi.fn().mockResolvedValue({ approved: true }),
}))

import { registerAgentHandlers } from '../../../src/main/ipc/handlers/agent'
import { IPC_CHANNELS } from '../../../src/shared/types'

// ===== 工具：构建 mock AgentService =====
function makeMockAgentService(overrides: Partial<{
  runStream: ReturnType<typeof vi.fn>
  stopAgent: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  getStatus: ReturnType<typeof vi.fn>
  getToolManager: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    runStream: overrides.runStream ?? vi.fn(),
    stopAgent: overrides.stopAgent ?? vi.fn(),
    pause: overrides.pause ?? vi.fn(),
    resume: overrides.resume ?? vi.fn(),
    getStatus: overrides.getStatus ?? vi.fn().mockReturnValue('idle'),
    getToolManager: overrides.getToolManager ?? vi.fn().mockReturnValue(null),
  } as never
}

function makeMockWindow() {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    webContents: { send: vi.fn() },
  } as never
}

function withMockWindow<T>(win: ReturnType<typeof makeMockWindow>, fn: () => Promise<T>): Promise<T> {
  mockWindowRegistry.win = win
  return fn()
}

describe('agent IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
  })

  // ===== AGENT_STREAM =====
  describe('AGENT_STREAM', () => {
    it('rejects input missing required fields', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STREAM)!

      // 缺 sessionId
      const result = await handler({}, { input: 'hello' })
      expect(result).toMatchObject({ success: false })
      expect(mockAgent.runStream).not.toHaveBeenCalled()
    })

    it('rejects empty input', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STREAM)!

      const result = await handler({}, { sessionId: 's1', input: '', modelConfigId: 'm1' })
      expect(result).toMatchObject({ success: false })
      expect(mockAgent.runStream).not.toHaveBeenCalled()
    })

    it('forwards stream events to webContents.send', async () => {
      const mockWin = makeMockWindow()
      const mockStream = (async function* () {
        yield { type: 'token', content: 'hello' }
        yield { type: 'done', metrics: { totalTurns: 1 } }
      })()
      const mockAgent = makeMockAgentService({
        runStream: vi.fn().mockReturnValue(mockStream),
      })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => mockWin })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STREAM)!

      const result = await withMockWindow(mockWin, () =>
        handler({}, { sessionId: 's1', input: 'hi', modelConfigId: 'm1' }) as Promise<unknown>,
      )

      expect(result).toEqual({ success: true })
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        'agent:stream-event:s1',
        { type: 'token', content: 'hello' },
      )
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        'agent:stream-event:s1',
        { type: 'done', metrics: { totalTurns: 1 } },
      )
    })

    it('attaches window close listener and removes on completion', async () => {
      const mockWin = makeMockWindow()
      const mockStream = (async function* () {
        yield { type: 'done', metrics: { totalTurns: 0 } }
      })()
      const mockAgent = makeMockAgentService({
        runStream: vi.fn().mockReturnValue(mockStream),
      })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => mockWin })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STREAM)!

      await withMockWindow(mockWin, () =>
        handler({}, { sessionId: 's1', input: 'hi', modelConfigId: 'm1' }) as Promise<unknown>,
      )

      expect(mockWin.on).toHaveBeenCalledWith('closed', expect.any(Function))
      expect(mockWin.off).toHaveBeenCalledWith('closed', expect.any(Function))
    })
  })

  // ===== AGENT_STOP =====
  describe('AGENT_STOP', () => {
    it('calls agentService.stopAgent on valid input', async () => {
      const stopAgent = vi.fn()
      const mockAgent = makeMockAgentService({ stopAgent })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STOP)!

      const result = await handler({}, 'session-1')
      expect(stopAgent).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true, data: true })
    })

    it('rejects empty sessionId', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STOP)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
    })
  })

  // ===== AGENT_PAUSE / AGENT_RESUME =====
  describe('AGENT_PAUSE / AGENT_RESUME', () => {
    it('AGENT_PAUSE calls agentService.pause', async () => {
      const pause = vi.fn()
      const mockAgent = makeMockAgentService({ pause })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_PAUSE)!

      const result = await handler({}, 'session-1')
      expect(pause).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true })
    })

    it('AGENT_RESUME calls agentService.resume', async () => {
      const resume = vi.fn()
      const mockAgent = makeMockAgentService({ resume })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_RESUME)!

      const result = await handler({}, 'session-1')
      expect(resume).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true })
    })
  })

  // ===== AGENT_STATUS =====
  describe('AGENT_STATUS', () => {
    it('returns status string from agentService.getStatus', async () => {
      const getStatus = vi.fn().mockReturnValue('running')
      const mockAgent = makeMockAgentService({ getStatus })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STATUS)!

      const result = await handler({}, 'session-1')
      expect(getStatus).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true, data: 'running' })
    })

    it('returns idle when agent is not active', async () => {
      const getStatus = vi.fn().mockReturnValue('idle')
      const mockAgent = makeMockAgentService({ getStatus })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STATUS)!

      const result = await handler({}, 'unknown-session')
      expect(result).toEqual({ success: true, data: 'idle' })
    })
  })

  // ===== FILE_CHANGE_GET =====
  describe('FILE_CHANGE_GET', () => {
    it('returns null when ToolManager unavailable', async () => {
      const mockAgent = makeMockAgentService({ getToolManager: vi.fn().mockReturnValue(null) })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.FILE_CHANGE_GET)!

      const result = await handler({}, 'change-id')
      expect(result).toEqual({ success: true, data: null })
    })

    it('returns change + diff when present', async () => {
      const mockChange = { id: 'c1', filePath: 'a.ts' }
      const mockDiff = [{ type: 'added', content: '+x' }]
      const mockTM = {
        getFileChange: vi.fn().mockReturnValue(mockChange),
        getFileDiff: vi.fn().mockReturnValue(mockDiff),
      }
      const mockAgent = makeMockAgentService({ getToolManager: vi.fn().mockReturnValue(mockTM) })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.FILE_CHANGE_GET)!

      const result = await handler({}, 'c1')
      expect(result).toEqual({ success: true, data: { change: mockChange, diff: mockDiff } })
    })
  })
})
