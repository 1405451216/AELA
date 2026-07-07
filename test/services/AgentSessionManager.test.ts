/**
 * AgentSessionManager 单元测试
 *
 * 覆盖: 注册/注销/查询/停止/暂停/恢复/状态/统计
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentSessionManager } from '../../src/main/services/AgentSessionManager'

// Mock ReActAgent 和 Lifecycle
function createMockLifecycle(overrides: Partial<{ status: string; stop: () => void; pause: () => void; resume: () => void }> = {}) {
  return {
    status: 'running',
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    ...overrides,
  }
}

describe('AgentSessionManager', () => {
  let manager: AgentSessionManager

  beforeEach(() => {
    manager = new AgentSessionManager()
  })

  // ===== 注册与注销 =====

  describe('注册与注销', () => {
    it('应注册 Agent', () => {
      const lifecycle = createMockLifecycle()
      manager.register('session-1', null, lifecycle as any)

      expect(manager.has('session-1')).toBe(true)
      expect(manager.get('session-1')).not.toBeNull()
    })

    it('应注销 Agent', () => {
      manager.register('session-1')
      expect(manager.has('session-1')).toBe(true)

      manager.unregister('session-1')
      expect(manager.has('session-1')).toBe(false)
    })

    it('注销不存在的会话不应抛出异常', () => {
      expect(() => manager.unregister('nonexistent')).not.toThrow()
    })

    it('重复注册应覆盖', () => {
      manager.register('session-1')
      const lifecycle = createMockLifecycle()
      manager.register('session-1', null, lifecycle as any)

      const entry = manager.get('session-1')
      expect(entry?.lifecycle).toBe(lifecycle)
    })
  })

  // ===== 查询 =====

  describe('查询', () => {
    it('has 不存在的会话应返回 false', () => {
      expect(manager.has('nonexistent')).toBe(false)
    })

    it('get 不存在的会话应返回 null', () => {
      expect(manager.get('nonexistent')).toBeNull()
    })

    it('get 应返回正确的条目', () => {
      const lifecycle = createMockLifecycle({ status: 'paused' })
      manager.register('session-1', null, lifecycle as any)

      const entry = manager.get('session-1')
      expect(entry).not.toBeNull()
      expect(entry!.lifecycle).toBe(lifecycle)
    })
  })

  // ===== 停止 =====

  describe('停止', () => {
    it('应停止指定会话', () => {
      const lifecycle = createMockLifecycle()
      manager.register('session-1', null, lifecycle as any)

      const result = manager.stop('session-1')
      expect(result).toBe(true)
      expect(lifecycle.stop).toHaveBeenCalled()
    })

    it('停止不存在的会话应返回 false', () => {
      expect(manager.stop('nonexistent')).toBe(false)
    })

    it('停止无 lifecycle 的会话应返回 false', () => {
      manager.register('session-1')
      expect(manager.stop('session-1')).toBe(false)
    })

    it('应停止所有会话', () => {
      const lc1 = createMockLifecycle()
      const lc2 = createMockLifecycle()
      manager.register('s1', null, lc1 as any)
      manager.register('s2', null, lc2 as any)

      manager.stopAll()

      expect(lc1.stop).toHaveBeenCalled()
      expect(lc2.stop).toHaveBeenCalled()
    })
  })

  // ===== 暂停 =====

  describe('暂停', () => {
    it('应暂停指定会话', () => {
      const lifecycle = createMockLifecycle()
      manager.register('session-1', null, lifecycle as any)

      const result = manager.pause('session-1')
      expect(result).toBe(true)
      expect(lifecycle.pause).toHaveBeenCalled()
    })

    it('暂停不存在的会话应返回 false', () => {
      expect(manager.pause('nonexistent')).toBe(false)
    })
  })

  // ===== 恢复 =====

  describe('恢复', () => {
    it('应恢复指定会话', () => {
      const lifecycle = createMockLifecycle()
      manager.register('session-1', null, lifecycle as any)

      const result = manager.resume('session-1')
      expect(result).toBe(true)
      expect(lifecycle.resume).toHaveBeenCalled()
    })

    it('恢复不存在的会话应返回 false', () => {
      expect(manager.resume('nonexistent')).toBe(false)
    })
  })

  // ===== 状态 =====

  describe('状态', () => {
    it('应返回 lifecycle 状态', () => {
      const lifecycle = createMockLifecycle({ status: 'running' })
      manager.register('session-1', null, lifecycle as any)

      expect(manager.getStatus('session-1')).toBe('running')
    })

    it('不存在的会话应返回 idle', () => {
      expect(manager.getStatus('nonexistent')).toBe('idle')
    })

    it('无 lifecycle 的会话应返回 idle', () => {
      manager.register('session-1')
      expect(manager.getStatus('session-1')).toBe('idle')
    })
  })

  // ===== 统计 =====

  describe('统计', () => {
    it('应返回正确的活跃数量', () => {
      expect(manager.getActiveCount()).toBe(0)

      manager.register('s1')
      manager.register('s2')
      expect(manager.getActiveCount()).toBe(2)

      manager.unregister('s1')
      expect(manager.getActiveCount()).toBe(1)
    })

    it('应返回所有活跃会话 ID', () => {
      manager.register('s1')
      manager.register('s2')
      manager.register('s3')

      const ids = manager.getActiveSessionIds()
      expect(ids.length).toBe(3)
      expect(ids).toContain('s1')
      expect(ids).toContain('s2')
      expect(ids).toContain('s3')
    })

    it('clear 应清空所有会话', () => {
      manager.register('s1')
      manager.register('s2')
      expect(manager.getActiveCount()).toBe(2)

      manager.clear()
      expect(manager.getActiveCount()).toBe(0)
    })
  })
})
