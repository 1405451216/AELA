/**
 * Session IPC handler 单测（.session.handlers.test.ts）
 *
 * 覆盖核心 handler：session:list / session:create / session:delete / session:get-messages
 * 重点：handler 存在 + 调用正确的 service（SessionStore）方法 + 参数正确 + zod 校验
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron 模块 =====
const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn)
    },
  },
}))

import { registerSessionHandlers } from '../../../src/main/ipc/handlers/session'
import { IPC_CHANNELS } from '../../../src/shared/types'

// ===== Mock 服务 =====

function makeMockSessionStore(overrides: Partial<{
  listSessions: ReturnType<typeof vi.fn>
  createSession: ReturnType<typeof vi.fn>
  deleteSession: ReturnType<typeof vi.fn>
  getMessages: ReturnType<typeof vi.fn>
  updateSession: ReturnType<typeof vi.fn>
  getSession: ReturnType<typeof vi.fn>
  updateActiveSkillIds: ReturnType<typeof vi.fn>
  searchSessions: ReturnType<typeof vi.fn>
  exportSession: ReturnType<typeof vi.fn>
  getSessionContextInfo: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    listSessions: overrides.listSessions ?? vi.fn().mockReturnValue([]),
    createSession: overrides.createSession ?? vi.fn().mockReturnValue({ id: 's1' }),
    deleteSession: overrides.deleteSession ?? vi.fn(),
    getMessages: overrides.getMessages ?? vi.fn().mockReturnValue([]),
    updateSession: overrides.updateSession ?? vi.fn(),
    getSession: overrides.getSession ?? vi.fn().mockReturnValue({ id: 's1' }),
    updateActiveSkillIds: overrides.updateActiveSkillIds ?? vi.fn(),
    searchSessions: overrides.searchSessions ?? vi.fn().mockReturnValue([]),
    exportSession: overrides.exportSession ?? vi.fn().mockReturnValue({}),
    getSessionContextInfo: overrides.getSessionContextInfo ?? vi.fn().mockReturnValue({}),
  } as never
}

function makeMockContextWindowService(overrides: Partial<{
  getConfig: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    getConfig: overrides.getConfig ?? vi.fn().mockReturnValue({}),
  } as never
}

// ===== 测试用例 =====
describe('Session IPC Handlers (.handlers)', () => {
  let mockSessionStore: ReturnType<typeof makeMockSessionStore>
  let mockCtxWindow: ReturnType<typeof makeMockContextWindowService>

  beforeEach(() => {
    handlers.clear()
    mockSessionStore = makeMockSessionStore()
    mockCtxWindow = makeMockContextWindowService()
    registerSessionHandlers({
      sessionStore: mockSessionStore,
      contextWindowService: mockCtxWindow,
    })
  })

  // ===== session:list =====
  describe('session:list', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.SESSION_LIST)).toBeDefined()
    })

    it('调用 sessionStore.listSessions 并返回结果', async () => {
      const listSessions = vi.fn().mockReturnValue([{ id: 's1', title: 'first' }])
      Object.assign(mockSessionStore, { listSessions })
      const handler = handlers.get(IPC_CHANNELS.SESSION_LIST)!

      const result = await handler({})
      expect(listSessions).toHaveBeenCalledWith(undefined)
      expect(result).toEqual({ success: true, data: [{ id: 's1', title: 'first' }] })
    })

    it('透传 workspaceId 参数', async () => {
      const listSessions = vi.fn().mockReturnValue([])
      Object.assign(mockSessionStore, { listSessions })
      const handler = handlers.get(IPC_CHANNELS.SESSION_LIST)!

      await handler({}, 'ws-1')
      expect(listSessions).toHaveBeenCalledWith('ws-1')
    })
  })

  // ===== session:create =====
  describe('session:create', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.SESSION_CREATE)).toBeDefined()
    })

    it('调用 sessionStore.createSession', async () => {
      const createSession = vi.fn().mockReturnValue({ id: 'new-sess' })
      Object.assign(mockSessionStore, { createSession })
      const handler = handlers.get(IPC_CHANNELS.SESSION_CREATE)!

      const params = { title: 'my session', workspaceId: 'ws-1' }
      const result = await handler({}, params)
      expect(createSession).toHaveBeenCalledWith(params)
      expect(result).toEqual({ success: true, data: { id: 'new-sess' } })
    })

    it('空参数对象（{}）也能调用 createSession（schema 全 optional）', async () => {
      const createSession = vi.fn().mockReturnValue({ id: 'empty-sess' })
      Object.assign(mockSessionStore, { createSession })
      const handler = handlers.get(IPC_CHANNELS.SESSION_CREATE)!

      const result = await handler({}, {})
      expect(createSession).toHaveBeenCalledWith({})
      expect(result).toMatchObject({ success: true })
    })
  })

  // ===== session:delete =====
  describe('session:delete', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.SESSION_DELETE)).toBeDefined()
    })

    it('调用 sessionStore.deleteSession 并返回 true', async () => {
      const deleteSession = vi.fn()
      Object.assign(mockSessionStore, { deleteSession })
      const handler = handlers.get(IPC_CHANNELS.SESSION_DELETE)!

      const result = await handler({}, 'sess-to-delete')
      expect(deleteSession).toHaveBeenCalledWith('sess-to-delete')
      expect(result).toEqual({ success: true, data: true })
    })

    it('空 id 时 zod 校验失败', async () => {
      const deleteSession = vi.fn()
      Object.assign(mockSessionStore, { deleteSession })
      const handler = handlers.get(IPC_CHANNELS.SESSION_DELETE)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
      expect(deleteSession).not.toHaveBeenCalled()
    })
  })

  // ===== session:get-messages =====
  describe('session:get-messages', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.SESSION_GET_MESSAGES)).toBeDefined()
    })

    it('调用 sessionStore.getMessages 并返回结果', async () => {
      const getMessages = vi.fn().mockReturnValue([
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ])
      Object.assign(mockSessionStore, { getMessages })
      const handler = handlers.get(IPC_CHANNELS.SESSION_GET_MESSAGES)!

      const result = await handler({}, 'sess-1')
      expect(getMessages).toHaveBeenCalledWith('sess-1')
      expect(result).toEqual({
        success: true,
        data: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
      })
    })

    it('空 sessionId 时 zod 校验失败', async () => {
      const getMessages = vi.fn().mockReturnValue([])
      Object.assign(mockSessionStore, { getMessages })
      const handler = handlers.get(IPC_CHANNELS.SESSION_GET_MESSAGES)!

      const result = await handler({}, '')
      expect(result).toMatchObject({ success: false })
      expect(getMessages).not.toHaveBeenCalled()
    })
  })
})
