/**
 * OrchestrationService 单元测试
 *
 * 覆盖: 预置模板库（注册/获取/列举）/ 执行回放（空状态）
 *       setToolManager / stop 生命周期方法
 *
 * 注: 仅测试不触发 SDK 执行引擎（run()）的纯逻辑分支，
 *     避免对 @agentprimordia/sdk 的 ReActAgent/ParallelRun/AgentPool 做深度 mock。
 *     编排引擎执行路径由 orchestration 策略类的专属测试覆盖。
 */

import { describe, it, expect, vi } from 'vitest'

// OrchestrationReplay 内部使用 electron-store，需要 mock 以避免 electron-store 在非 Electron 环境下
// 要求 projectName 而抛出 "Please specify the projectName option"
vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, unknown> = {}
    constructor(opts: { defaults?: Record<string, unknown> }) {
      this.data = { ...(opts?.defaults ?? {}) }
    }
    get(key: string, defaultValue?: unknown) {
      return key in this.data ? this.data[key] : defaultValue
    }
    set(key: string, value: unknown) {
      this.data[key] = value
    }
    clear() {
      this.data = {}
    }
  },
}))

// 最小化的 ConfigStore / ProviderManager mock（run() 之外的逻辑不需要真实实现）
const configStore = {
  getModel: vi.fn(),
  getConfig: vi.fn(() => ({ maxTurns: 10, maxMessages: 20 })),
}
const providerManager = {
  createProvider: vi.fn(),
}

import { OrchestrationService } from '../../src/main/services/OrchestrationService'

describe('OrchestrationService', () => {
  let service: OrchestrationService

  beforeEach(() => {
    service = new OrchestrationService(configStore as any, providerManager as any, null)
  })

  // ===== 模板库 =====

  describe('模板库', () => {
    it('构造函数不应抛出异常', () => {
      expect(() => new OrchestrationService(configStore as any, providerManager as any, null)).not.toThrow()
    })

    it('registerTemplate 后可 getTemplate 取到', () => {
      const tpl = { id: 't1', name: 'Code Review', mode: 'pipeline', agents: [] } as any
      service.registerTemplate(tpl)
      expect(service.getTemplate('t1')).toBe(tpl)
    })

    it('listTemplates 包含已注册模板', () => {
      const tpl = { id: 't2', name: 'Summarize', mode: 'parallel', agents: [] } as any
      service.registerTemplate(tpl)
      const list = service.listTemplates()
      expect(list.some(t => t.id === 't2')).toBe(true)
    })

    it('getTemplate 对未知 id 返回 undefined', () => {
      expect(service.getTemplate('nope')).toBeUndefined()
    })

    it('多个模板可累积注册（在预置模板之外追加）', () => {
      const before = service.listTemplates().length
      service.registerTemplate({ id: 'a', name: 'A', mode: 'pool', agents: [] } as any)
      service.registerTemplate({ id: 'b', name: 'B', mode: 'handoff', agents: [] } as any)
      const after = service.listTemplates()
      expect(after.length).toBe(before + 2)
      expect(after.some((t) => t.id === 'a')).toBe(true)
      expect(after.some((t) => t.id === 'b')).toBe(true)
    })
  })

  // ===== 执行回放 =====

  describe('执行回放', () => {
    it('listRuns 初始为空数组', () => {
      expect(service.listRuns()).toEqual([])
    })

    it('getRun 对未知 id 返回 undefined', () => {
      expect(service.getRun('missing')).toBeUndefined()
    })

    it('getPerformanceReport 返回对象', () => {
      const report = service.getPerformanceReport()
      expect(report).toBeDefined()
      expect(typeof report).toBe('object')
    })
  })

  // ===== 生命周期 =====

  describe('生命周期', () => {
    it('setToolManager 不抛错', () => {
      const tm = { getRegistry: vi.fn() } as any
      expect(() => service.setToolManager(tm)).not.toThrow()
    })

    it('stop() 无参为无操作（不抛错）', () => {
      expect(() => service.stop()).not.toThrow()
    })

    it('stop(runId) 对未知 run 不抛错', () => {
      expect(() => service.stop('ghost-run')).not.toThrow()
    })
  })
})
