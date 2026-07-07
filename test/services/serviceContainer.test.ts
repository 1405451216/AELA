/**
 * ServiceContainer 单元测试
 *
 * 覆盖: register/get / 未注册抛错 / registerFactory 同步/异步 / stopAll 逆序
 *       MainWindowHolder 存取 / has() 判断
 */

import { describe, it, expect, vi } from 'vitest'
import { ServiceContainer, MainWindowHolder } from '../../src/main/services/ServiceContainer'
import type { IService } from '../../src/main/services/ServiceContainer'

describe('ServiceContainer', () => {
  let container: ServiceContainer

  beforeEach(() => {
    container = new ServiceContainer()
  })

  // ===== register + get =====

  describe('register + get', () => {
    it('正确存取服务实例', () => {
      const service: IService = { stop: vi.fn() }
      container.register('my-service', service)

      const result = container.get<IService>('my-service')
      expect(result).toBe(service)
    })
  })

  describe('get 未注册的 token', () => {
    it('抛出错误', () => {
      expect(() => container.get('nonexistent')).toThrow('Service "nonexistent" not registered')
    })
  })

  // ===== registerFactory =====

  describe('registerFactory 同步工厂', () => {
    it('get() 正确创建并缓存实例', () => {
      const service: IService = { stop: vi.fn() }
      container.registerFactory('factory-svc', () => service)

      const result = container.get<IService>('factory-svc')
      expect(result).toBe(service)

      // 第二次 get 应返回同一实例（缓存）
      const result2 = container.get<IService>('factory-svc')
      expect(result2).toBe(service)
    })
  })

  describe('registerFactory 异步工厂', () => {
    it('resolve() 正确创建实例', async () => {
      const service: IService = { stop: vi.fn() }
      container.registerFactory('async-svc', async () => service)

      const result = await container.resolve<IService>('async-svc')
      expect(result).toBe(service)
    })

    it('get() 抛错提示使用 resolve()', () => {
      const service: IService = { stop: vi.fn() }
      container.registerFactory('async-svc', async () => service)

      expect(() => container.get('async-svc')).toThrow('use resolve() instead')
    })

    it('resolve() 后 get() 可正常获取', async () => {
      const service: IService = { stop: vi.fn() }
      container.registerFactory('async-svc', async () => service)

      await container.resolve('async-svc')
      const result = container.get<IService>('async-svc')
      expect(result).toBe(service)
    })
  })

  // ===== stopAll =====

  describe('stopAll', () => {
    it('按注册逆序调用 stop()', async () => {
      const order: string[] = []

      const svc1: IService = { stop: vi.fn(() => { order.push('1') }) }
      const svc2: IService = { stop: vi.fn(() => { order.push('2') }) }
      const svc3: IService = { stop: vi.fn(() => { order.push('3') }) }

      container.register('svc-1', svc1)
      container.register('svc-2', svc2)
      container.register('svc-3', svc3)

      await container.stopAll()

      expect(order).toEqual(['3', '2', '1'])
    })

    it('stop() 抛错时不影响其他服务', async () => {
      const svc1: IService = { stop: vi.fn() }
      const svc2: IService = { stop: vi.fn(() => { throw new Error('boom') }) }
      const svc3: IService = { stop: vi.fn() }

      container.register('svc-1', svc1)
      container.register('svc-2', svc2)
      container.register('svc-3', svc3)

      // 不应抛出
      await expect(container.stopAll()).resolves.toBeUndefined()

      // svc1 和 svc3 的 stop 仍被调用
      expect(svc1.stop).toHaveBeenCalled()
      expect(svc3.stop).toHaveBeenCalled()
    })

    it('无注册服务时不抛错', async () => {
      await expect(container.stopAll()).resolves.toBeUndefined()
    })
  })

  // ===== MainWindowHolder =====

  describe('setMainWindowHolder + getMainWindowHolder', () => {
    it('正确存取', () => {
      const holder = new MainWindowHolder(() => null)
      container.setMainWindowHolder(holder)

      expect(container.getMainWindowHolder()).toBe(holder)
    })
  })

  describe('getMainWindowHolder 未设置', () => {
    it('抛出错误', () => {
      expect(() => container.getMainWindowHolder()).toThrow('MainWindowHolder not set')
    })
  })

  // ===== has =====

  describe('has', () => {
    it('已注册返回 true', () => {
      container.register('svc', { stop: vi.fn() })
      expect(container.has('svc')).toBe(true)
    })

    it('已注册工厂返回 true', () => {
      container.registerFactory('factory-svc', () => ({ stop: vi.fn() }))
      expect(container.has('factory-svc')).toBe(true)
    })

    it('未注册返回 false', () => {
      expect(container.has('nonexistent')).toBe(false)
    })
  })
})
