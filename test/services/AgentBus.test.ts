import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentBus } from '../../src/main/services/AgentBus'
import type { WorkerRole } from '@shared/types'

describe('AgentBus', () => {
  let bus: AgentBus

  beforeEach(() => {
    bus = new AgentBus()
  })

  describe('agent registration', () => {
    it('注册 Agent', () => {
      bus.registerAgent('agent-1')
      expect(bus.getRegisteredAgents()).toContain('agent-1')
    })

    it('注册带角色的 Agent', () => {
      bus.registerAgent('coder-1', 'coder')
      expect(bus.getAgentsByRole('coder')).toContain('coder-1')
    })

    it('注销 Agent', () => {
      bus.registerAgent('agent-1')
      bus.unregisterAgent('agent-1')
      expect(bus.getRegisteredAgents()).not.toContain('agent-1')
    })
  })

  describe('sendMessage', () => {
    it('发送消息', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')

      const msg = bus.sendMessage('agent-a', 'agent-b', { text: 'hello' })
      expect(msg.from).toBe('agent-a')
      expect(msg.to).toBe('agent-b')
      expect(msg.payload).toEqual({ text: 'hello' })
      expect(msg.type).toBe('request')
      expect(msg.timestamp).toBeTruthy()
    })

    it('发送方未注册抛出错误', () => {
      bus.registerAgent('agent-b')
      expect(() => bus.sendMessage('unknown', 'agent-b', {})).toThrow('发送方 Agent 未注册')
    })

    it('接收方未注册抛出错误', () => {
      bus.registerAgent('agent-a')
      expect(() => bus.sendMessage('agent-a', 'unknown', {})).toThrow('接收方 Agent 未注册')
    })

    it('指定消息类型', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      const msg = bus.sendMessage('agent-a', 'agent-b', {}, 'escalate')
      expect(msg.type).toBe('escalate')
    })
  })

  describe('broadcast', () => {
    it('广播给所有其他 Agent', () => {
      bus.registerAgent('sender')
      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')
      bus.registerAgent('agent-3')

      const messages = bus.broadcast('sender', { text: 'hello all' })
      expect(messages).toHaveLength(3)
      expect(messages.every(m => m.from === 'sender')).toBe(true)
    })

    it('按角色过滤广播', () => {
      bus.registerAgent('sender', 'coder')
      bus.registerAgent('coder-1', 'coder')
      bus.registerAgent('reviewer-1', 'reviewer')
      bus.registerAgent('coder-2', 'coder')

      const messages = bus.broadcast('sender', {}, 'coder')
      expect(messages).toHaveLength(2)
      expect(messages.every(m => m.to.startsWith('coder-'))).toBe(true)
    })

    it('无目标时返回空数组', () => {
      bus.registerAgent('sender')
      const messages = bus.broadcast('sender', {})
      expect(messages).toEqual([])
    })

    it('未注册发送方抛出错误', () => {
      expect(() => bus.broadcast('unknown', {})).toThrow('发送方 Agent 未注册')
    })
  })

  describe('message queue', () => {
    it('接收消息', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', { data: 123 })

      const messages = bus.getMessages('agent-b')
      expect(messages).toHaveLength(1)
      expect(messages[0].payload).toEqual({ data: 123 })
    })

    it('按顺序消费消息', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', { seq: 1 })
      bus.sendMessage('agent-a', 'agent-b', { seq: 2 })
      bus.sendMessage('agent-a', 'agent-b', { seq: 3 })

      expect(bus.receiveMessage('agent-b')!.payload).toEqual({ seq: 1 })
      expect(bus.receiveMessage('agent-b')!.payload).toEqual({ seq: 2 })
      expect(bus.receiveMessage('agent-b')!.payload).toEqual({ seq: 3 })
      expect(bus.receiveMessage('agent-b')).toBeNull()
    })

    it('查看消息但不消费', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', { data: 1 })

      const peeked = bus.peekMessages('agent-b')
      expect(peeked).toHaveLength(1)
      expect(bus.getPendingCount('agent-b')).toBe(1)
    })

    it('获取待处理消息数量', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', {})
      bus.sendMessage('agent-a', 'agent-b', {})

      expect(bus.getPendingCount('agent-b')).toBe(2)
    })

    it('获取所有 Agent 的待处理数量', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.registerAgent('agent-c')
      bus.sendMessage('agent-a', 'agent-b', {})
      bus.sendMessage('agent-a', 'agent-c', {})
      bus.sendMessage('agent-b', 'agent-c', {})

      const counts = bus.getAllPendingCounts()
      expect(counts['agent-b']).toBe(1)
      expect(counts['agent-c']).toBe(2)
    })
  })

  describe('listeners', () => {
    it('消息到达时触发监听器', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')

      const received: unknown[] = []
      bus.onMessage('agent-b', (msg) => { received.push(msg) })

      bus.sendMessage('agent-a', 'agent-b', { text: 'test' })
      expect(received).toHaveLength(1)
    })

    it('取消监听', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')

      const received: unknown[] = []
      const unsub = bus.onMessage('agent-b', (msg) => { received.push(msg) })

      bus.sendMessage('agent-a', 'agent-b', {})
      unsub()
      bus.sendMessage('agent-a', 'agent-b', {})

      expect(received).toHaveLength(1)
    })

    it('监听器异常不影响消息投递', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')

      bus.onMessage('agent-b', () => { throw new Error('listener error') })

      expect(() => bus.sendMessage('agent-a', 'agent-b', {})).not.toThrow()
      expect(bus.getPendingCount('agent-b')).toBe(1)
    })
  })

  describe('message history', () => {
    it('获取消息历史', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', {})

      const history = bus.getMessageHistory()
      expect(history).toHaveLength(1)
    })

    it('按条件过滤历史', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.registerAgent('agent-c')
      bus.sendMessage('agent-a', 'agent-b', {}, 'request')
      bus.sendMessage('agent-b', 'agent-c', {}, 'response')

      const fromA = bus.getMessageHistory({ from: 'agent-a' })
      expect(fromA).toHaveLength(1)

      const requests = bus.getMessageHistory({ type: 'request' })
      expect(requests).toHaveLength(1)
    })
  })

  describe('clear operations', () => {
    it('清除指定 Agent 的消息', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', {})

      const cleared = bus.clearAgentMessages('agent-b')
      expect(cleared).toBe(1)
      expect(bus.getPendingCount('agent-b')).toBe(0)
    })

    it('清除所有消息', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.registerAgent('agent-c')
      bus.sendMessage('agent-a', 'agent-b', {})
      bus.sendMessage('agent-a', 'agent-c', {})

      bus.clearAll()
      expect(bus.getPendingCount('agent-b')).toBe(0)
      expect(bus.getPendingCount('agent-c')).toBe(0)
    })

    it('清除历史', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', {})

      bus.clearHistory()
      expect(bus.getMessageHistory()).toHaveLength(0)
    })
  })

  describe('stop', () => {
    it('清理所有状态', () => {
      bus.registerAgent('agent-a')
      bus.registerAgent('agent-b')
      bus.sendMessage('agent-a', 'agent-b', {})

      bus.stop()
      expect(bus.getRegisteredAgents()).toHaveLength(0)
      expect(bus.getPendingCount('agent-b')).toBe(0)
      expect(bus.getMessageHistory()).toHaveLength(0)
    })
  })
})
