/**
 * Agent IPC handler 单测（.agent.handlers.test.ts）
 *
 * 覆盖核心 handler：agent:stream / agent:stop / agent:pause / agent:resume / agent:status
 * 重点：handler 存在 + 调用正确的 service 方法 + 参数正确 + zod 校验失败路径
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron 模块（拦截 ipcMain.handle，供直接调用 handler） =====
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

// Mock shellConfirm 以避免真弹窗
vi.mock('../../../src/main/utils/shellConfirm', () => ({
  showShellConfirmDialog: vi.fn().mockResolvedValue({ approved: true }),
}))

import { registerAgentHandlers } from '../../../src/main/ipc/handlers/agent'
import { IPC_CHANNELS } from '../../../src/shared/types'

// ===== 工具函数 =====

/**
 * 构建 mock AgentService — 只列出 handler 实际使用的方法，
 * 每个方法默认为 vi.fn()，调用方通过 overrides 指定定制行为。
 */
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

/**
 * 构建 mock BrowserWindow — 用于验证 stream 事件转发。
 * 因 mock 实现中使用引用注册，测试通过 withMockWindow 注入。
 */
function makeMockWindow() {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    on: vi.fn(),
    off: vi.fn(),
    webContents: { send: vi.fn() },
  } as never
}

/**
 * 在给定 win 作为当前窗口的上下文中执行 fn，
 * 处理 stream 中断逻辑需要指定 win。
 */
function withMockWindow<T>(win: ReturnType<typeof makeMockWindow>, fn: () => Promise<T>): Promise<T> {
  mockWindowRegistry.win = win
  return fn()
}

// ===== 测试用例 =====
describe('Agent IPC Handlers (.handlers)', () => {
  beforeEach(() => {
    handlers.clear()
  })

  // ===== agent:stream =====
  describe('agent:stream', () => {
    it('应存在 handler', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STREAM)
      expect(handler).toBeDefined()
    })

    it('zod 校验失败返回 { success: false } 且不调用 runStream', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STREAM)!

      // 缺 sessionId 和 modelConfigId
      const result = await handler({}, { input: 'hello' })
      expect(result).toMatchObject({ success: false })
      expect(mockAgent.runStream).not.toHaveBeenCalled()
    })

    it('空 input 时校验失败', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STREAM)!

      const result = await handler({}, { sessionId: 's1', input: '', modelConfigId: 'm1' })
      expect(result).toMatchObject({ success: false })
      expect(mockAgent.runStream).not.toHaveBeenCalled()
    })

    it('校验通过后调用 agentService.runStream 并转发流事件到 webContents', async () => {
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

      expect(mockAgent.runStream).toHaveBeenCalledWith({
        sessionId: 's1',
        input: 'hi',
        modelConfigId: 'm1',
        systemPrompt: undefined,
        mode: undefined,
      })
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        'agent:stream-event:s1',
        { type: 'token', content: 'hello' },
      )
      expect(mockWin.webContents.send).toHaveBeenCalledWith(
        'agent:stream-event:s1',
        { type: 'done', metrics: { totalTurns: 1 } },
      )
      expect(result).toEqual({ success: true })
    })

    it('流完成后移除窗口关闭监听', async () => {
      const mockWin = makeMockWindow()
      const mockStream = (async function* () {
        yield { type: 'done' }
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

  // ===== agent:stop =====
  describe('agent:stop', () => {
    it('应存在 handler', async () => {
      registerAgentHandlers({ agentService: makeMockAgentService(), getMainWindow: () => null })
      expect(handlers.get(IPC_CHANNELS.AGENT_STOP)).toBeDefined()
    })

    it('调用 agentService.stopAgent 并传入 sessionId', async () => {
      const stopAgent = vi.fn()
      const mockAgent = makeMockAgentService({ stopAgent })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STOP)!

      const result = await handler({}, 'session-1')
      expect(stopAgent).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true, data: true })
    })

    it('空 sessionId 时校验失败', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STOP)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
    })
  })

  // ===== agent:pause =====
  describe('agent:pause', () => {
    it('应存在 handler', async () => {
      registerAgentHandlers({ agentService: makeMockAgentService(), getMainWindow: () => null })
      expect(handlers.get(IPC_CHANNELS.AGENT_PAUSE)).toBeDefined()
    })

    it('调用 agentService.pause 并传入 sessionId', async () => {
      const pause = vi.fn()
      const mockAgent = makeMockAgentService({ pause })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_PAUSE)!

      const result = await handler({}, 'session-1')
      expect(pause).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true })
    })

    it('空 sessionId 时校验失败', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_PAUSE)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
    })
  })

  // ===== agent:resume =====
  describe('agent:resume', () => {
    it('应存在 handler', async () => {
      registerAgentHandlers({ agentService: makeMockAgentService(), getMainWindow: () => null })
      expect(handlers.get(IPC_CHANNELS.AGENT_RESUME)).toBeDefined()
    })

    it('调用 agentService.resume 并传入 sessionId', async () => {
      const resume = vi.fn()
      const mockAgent = makeMockAgentService({ resume })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_RESUME)!

      const result = await handler({}, 'session-1')
      expect(resume).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true })
    })

    it('空 sessionId 时校验失败', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_RESUME)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
    })
  })

  // ===== agent:status =====
  describe('agent:status', () => {
    it('应存在 handler', async () => {
      registerAgentHandlers({ agentService: makeMockAgentService(), getMainWindow: () => null })
      expect(handlers.get(IPC_CHANNELS.AGENT_STATUS)).toBeDefined()
    })

    it('返回 agentService.getStatus 的结果', async () => {
      const getStatus = vi.fn().mockReturnValue('running')
      const mockAgent = makeMockAgentService({ getStatus })
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STATUS)!

      const result = await handler({}, 'session-1')
      expect(getStatus).toHaveBeenCalledWith('session-1')
      expect(result).toEqual({ success: true, data: 'running' })
    })

    it('空 sessionId 时校验失败', async () => {
      const mockAgent = makeMockAgentService()
      registerAgentHandlers({ agentService: mockAgent, getMainWindow: () => null })
      const handler = handlers.get(IPC_CHANNELS.AGENT_STATUS)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
    })
  })
})
