/**
 * SessionStore 单元测试
 *
 * 覆盖: 创建会话 / 列出会话 / 获取会话 / 更新会话 / 删除会话
 *       添加消息 / 首条消息自动标题 / 获取消息 / 搜索消息 / 并发消息 / stop()
 * 使用临时目录 SQLite 数据库，mock electron app
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, rmSync, existsSync } from 'fs'

// 每次测试套件运行使用唯一目录，避免跨运行数据残留
const TEST_DATA_DIR = join(tmpdir(), `aela-test-sessionstore-${process.pid}`)

// Mock electron 模块 — 在 import SessionStore 之前
vi.mock('electron', () => ({
  app: { getPath: () => TEST_DATA_DIR },
}))

import { SessionStore } from '../../src/main/services/SessionStore'
import type { ChatMessage } from '@shared/types'

describe('SessionStore', () => {
  let store: SessionStore | null = null

  beforeEach(() => {
    // 确保临时目录存在且干净
    if (existsSync(TEST_DATA_DIR)) {
      rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    }
    mkdirSync(TEST_DATA_DIR, { recursive: true })
    // 每个测试创建全新的实例
    store = new SessionStore()
  })

  afterEach(() => {
    store?.stop()
    store = null
  })

  // ===== 辅助函数 =====

  function makeMessage(sessionId: string, role: ChatMessage['role'], content: string): ChatMessage {
    return {
      id: randomUUID(),
      sessionId,
      role,
      content,
      createdAt: new Date().toISOString(),
    }
  }

  // ===== 创建会话 =====

  describe('createSession', () => {
    it('返回完整 Session 对象', () => {
      const session = store!.createSession({})

      expect(session).toBeDefined()
      expect(session.id).toBeTruthy()
      expect(session.title).toBe('新对话')
      expect(session.workspaceId).toBeNull()
      expect(session.modelConfigId).toBeNull()
      expect(session.systemPrompt).toBe('')
      expect(session.activeSkillIds).toEqual([])
      expect(session.messageCount).toBe(0)
      expect(session.createdAt).toBeTruthy()
      expect(session.updatedAt).toBeTruthy()
    })

    it('支持自定义参数', () => {
      const session = store!.createSession({
        title: '测试对话',
        workspaceId: 'ws-1',
        modelConfigId: 'model-1',
        systemPrompt: 'You are a helper',
        activeSkillIds: ['skill-1', 'skill-2'],
      })

      expect(session.title).toBe('测试对话')
      expect(session.workspaceId).toBe('ws-1')
      expect(session.modelConfigId).toBe('model-1')
      expect(session.systemPrompt).toBe('You are a helper')
      expect(session.activeSkillIds).toEqual(['skill-1', 'skill-2'])
    })
  })

  // ===== 列出会话 =====

  describe('listSessions', () => {
    it('按更新时间倒序排列', async () => {
      const s1 = store!.createSession({ title: 'first' })
      await new Promise(r => setTimeout(r, 10))
      const s2 = store!.createSession({ title: 'second' })
      await new Promise(r => setTimeout(r, 10))
      const s3 = store!.createSession({ title: 'third' })

      const list = store!.listSessions()
      expect(list[0].id).toBe(s3.id)
      expect(list[1].id).toBe(s2.id)
      expect(list[2].id).toBe(s1.id)
    })

    it('按 workspaceId 筛选', () => {
      store!.createSession({ workspaceId: 'ws-a' })
      store!.createSession({ workspaceId: 'ws-b' })
      store!.createSession({ workspaceId: 'ws-a' })

      const listA = store!.listSessions('ws-a')
      expect(listA).toHaveLength(2)
      expect(listA.every(s => s.workspaceId === 'ws-a')).toBe(true)

      const listB = store!.listSessions('ws-b')
      expect(listB).toHaveLength(1)
    })

    it('无数据时返回空数组', () => {
      expect(store!.listSessions()).toEqual([])
    })
  })

  // ===== 获取单个会话 =====

  describe('getSession', () => {
    it('返回正确的 Session 对象', () => {
      const created = store!.createSession({ title: 'find me' })
      const found = store!.getSession(created.id)

      expect(found).toBeDefined()
      expect(found!.id).toBe(created.id)
      expect(found!.title).toBe('find me')
    })

    it('不存在的 id 返回 null', () => {
      expect(store!.getSession('nonexistent')).toBeNull()
    })
  })

  // ===== 更新会话 =====

  describe('updateSession', () => {
    it('字段正确更新', () => {
      const session = store!.createSession({ title: 'old' })
      store!.updateSession(session.id, {
        title: 'new title',
        modelConfigId: 'new-model',
        systemPrompt: 'new prompt',
      })

      const updated = store!.getSession(session.id)!
      expect(updated.title).toBe('new title')
      expect(updated.modelConfigId).toBe('new-model')
      expect(updated.systemPrompt).toBe('new prompt')
    })

    it('updatedAt 自动刷新', async () => {
      const session = store!.createSession({})
      const oldUpdatedAt = session.updatedAt

      await new Promise(r => setTimeout(r, 10))
      store!.updateSession(session.id, { title: 'changed' })

      const updated = store!.getSession(session.id)!
      expect(updated.updatedAt).not.toBe(oldUpdatedAt)
    })

    it('不存在的 id 不抛错（静默忽略）', () => {
      expect(() => store!.updateSession('nonexistent', { title: 'x' })).not.toThrow()
    })
  })

  // ===== 删除会话 =====

  describe('deleteSession', () => {
    it('会话和关联消息都被删除', () => {
      const session = store!.createSession({})
      store!.addMessage(makeMessage(session.id, 'user', 'hello'))
      store!.addMessage(makeMessage(session.id, 'assistant', 'hi'))

      store!.deleteSession(session.id)

      expect(store!.getSession(session.id)).toBeNull()
      expect(store!.getMessages(session.id)).toEqual([])
    })
  })

  // ===== 添加消息 =====

  describe('addMessage', () => {
    it('消息正确存储，会话 messageCount +1', () => {
      const session = store!.createSession({})
      expect(session.messageCount).toBe(0)

      store!.addMessage(makeMessage(session.id, 'user', 'msg1'))
      const s1 = store!.getSession(session.id)!
      expect(s1.messageCount).toBe(1)

      store!.addMessage(makeMessage(session.id, 'assistant', 'msg2'))
      const s2 = store!.getSession(session.id)!
      expect(s2.messageCount).toBe(2)
    })

    it('首条用户消息自动设置标题', () => {
      const session = store!.createSession({})
      expect(session.title).toBe('新对话')

      store!.addMessage(makeMessage(session.id, 'user', '这是一段很长的用户输入内容，超过五十个字符的情况也会被截断处理'))
      const updated = store!.getSession(session.id)!
      expect(updated.title).toBe('这是一段很长的用户输入内容，超过五十个字符的情况也会被截断处理'.slice(0, 50))
    })

    it('assistant 消息不触发自动标题', () => {
      const session = store!.createSession({})
      store!.addMessage(makeMessage(session.id, 'assistant', 'hi there'))
      const updated = store!.getSession(session.id)!
      expect(updated.title).toBe('新对话')
    })

    it('已有自定义标题时不覆盖', () => {
      const session = store!.createSession({ title: '我的对话' })
      store!.addMessage(makeMessage(session.id, 'user', 'hello'))
      const updated = store!.getSession(session.id)!
      expect(updated.title).toBe('我的对话')
    })
  })

  // ===== 获取消息 =====

  describe('getMessages', () => {
    it('返回指定会话的所有消息', () => {
      const session = store!.createSession({})
      store!.addMessage(makeMessage(session.id, 'user', 'first'))
      store!.addMessage(makeMessage(session.id, 'assistant', 'second'))

      const msgs = store!.getMessages(session.id)
      expect(msgs).toHaveLength(2)
      expect(msgs[0].content).toBe('first')
      expect(msgs[1].content).toBe('second')
    })

    it('按 createdAt 升序排列', () => {
      const session = store!.createSession({})
      const m1 = makeMessage(session.id, 'user', 'a')
      m1.createdAt = new Date(Date.now() - 1000).toISOString()
      const m2 = makeMessage(session.id, 'user', 'b')
      m2.createdAt = new Date().toISOString()

      store!.addMessage(m2)
      store!.addMessage(m1)

      const msgs = store!.getMessages(session.id)
      expect(msgs[0].content).toBe('a')
      expect(msgs[1].content).toBe('b')
    })

    it('不存在的会话返回空数组', () => {
      expect(store!.getMessages('nonexistent')).toEqual([])
    })

    it('带 toolCalls / toolResult / metrics 的消息完整存储', () => {
      const session = store!.createSession({})
      const msg: ChatMessage = {
        id: randomUUID(),
        sessionId: session.id,
        role: 'assistant',
        content: 'result',
        toolCalls: [{ id: 'tc-1', name: 'read_file', arguments: '{"path":"/tmp"}' }],
        toolResult: { toolCallId: 'tc-1', content: 'file content', isError: false },
        metrics: { totalTurns: 1, totalTools: 1, duration: 100, llmLatency: 50, toolLatency: 50 },
        createdAt: new Date().toISOString(),
      }
      store!.addMessage(msg)

      const msgs = store!.getMessages(session.id)
      expect(msgs).toHaveLength(1)
      expect(msgs[0].toolCalls).toEqual(msg.toolCalls)
      expect(msgs[0].toolResult).toEqual(msg.toolResult)
      expect(msgs[0].metrics).toEqual(msg.metrics)
    })
  })

  // ===== 搜索消息 =====

  describe('searchMessages', () => {
    it('按内容匹配搜索消息', () => {
      const s1 = store!.createSession({ title: 'session 1' })
      const s2 = store!.createSession({ title: 'session 2' })

      store!.addMessage(makeMessage(s1.id, 'user', '如何使用 TypeScript'))
      store!.addMessage(makeMessage(s1.id, 'assistant', 'TypeScript 是 JS 超集'))
      store!.addMessage(makeMessage(s2.id, 'user', 'Python 入门'))

      const results = store!.searchMessages('typescript')
      expect(results.length).toBeGreaterThanOrEqual(2)
      for (const r of results) {
        expect(r.session).toBeDefined()
        expect(r.message).toBeDefined()
        expect(r.message.content.toLowerCase()).toContain('typescript')
      }
    })

    it('不匹配时返回空数组', () => {
      store!.createSession({})
      const results = store!.searchMessages('不存在的关键词xyz')
      expect(results).toEqual([])
    })

    it('搜索不区分大小写', () => {
      const session = store!.createSession({})
      store!.addMessage(makeMessage(session.id, 'user', 'Hello World'))

      const results = store!.searchMessages('hello')
      expect(results.length).toBeGreaterThanOrEqual(1)

      const results2 = store!.searchMessages('HELLO')
      expect(results2.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ===== 并发添加消息 =====

  describe('并发添加消息', () => {
    it('连续快速添加 10 条无数据丢失', () => {
      const session = store!.createSession({})

      for (let i = 0; i < 10; i++) {
        store!.addMessage(makeMessage(session.id, 'user', `message ${i}`))
      }

      const msgs = store!.getMessages(session.id)
      expect(msgs).toHaveLength(10)

      const updated = store!.getSession(session.id)!
      expect(updated.messageCount).toBe(10)
    })
  })

  // ===== stop =====

  describe('stop', () => {
    it('不抛错', () => {
      const s = new SessionStore()
      expect(() => s.stop()).not.toThrow()
    })

    it('重复 stop 不抛错', () => {
      const s = new SessionStore()
      s.stop()
      expect(() => s.stop()).not.toThrow()
    })
  })
})
