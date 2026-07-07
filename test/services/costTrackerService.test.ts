/**
 * CostTrackerService 单元测试
 *
 * 覆盖: 定价管理 / 成本估算 / 调用记录 / 预算管理 / 汇总统计 / 重置
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron-store
const mockStoreData = new Map<string, unknown>()
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private data: Map<string, unknown> = new Map()
      get(key: string, defaultValue?: unknown): unknown {
        return this.data.has(key) ? this.data.get(key) : defaultValue
      }
      set(key: string, value: unknown): void {
        this.data.set(key, value)
      }
    },
  }
})

import { CostTrackerService } from '../../src/main/services/CostTrackerService'
import type { Usage } from '@agentprimordia/sdk'
import type { BudgetConfig, ModelPricing } from '@shared/types'

describe('CostTrackerService', () => {
  let service: CostTrackerService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CostTrackerService()
  })

  describe('定价管理', () => {
    it('默认包含 gpt-4o 定价', () => {
      const pricing = service.getPricing('gpt-4o')
      expect(pricing).toBeDefined()
      expect(pricing?.promptPricePer1M).toBe(2.5)
      expect(pricing?.completionPricePer1M).toBe(10.0)
    })

    it('默认包含 claude-3-5-sonnet 定价', () => {
      const pricing = service.getPricing('claude-3-5-sonnet-20241022')
      expect(pricing).toBeDefined()
      expect(pricing?.provider).toBe('anthropic')
    })

    it('setPricing 添加自定义定价', () => {
      const customPricing: ModelPricing = {
        model: 'custom-model',
        provider: 'custom',
        promptPricePer1M: 1.0,
        completionPricePer1M: 2.0,
      }
      service.setPricing('custom-model', customPricing)
      expect(service.getPricing('custom-model')).toEqual(customPricing)
    })

    it('listPricing 返回所有定价', () => {
      const all = service.listPricing()
      expect(all.length).toBeGreaterThanOrEqual(13)
      expect(all.some(p => p.model === 'gpt-4o')).toBe(true)
    })

    it('未知模型返回 undefined', () => {
      expect(service.getPricing('unknown-model')).toBeUndefined()
    })
  })

  describe('成本估算', () => {
    it('正确计算 gpt-4o 成本', () => {
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      // gpt-4o: prompt $2.5/1M, completion $10/1M
      // 1000/1M * 2.5 + 500/1M * 10 = 0.0025 + 0.005 = 0.0075
      const cost = service.estimateCost('gpt-4o', usage)
      expect(cost).toBeCloseTo(0.0075, 6)
    })

    it('未知模型成本为 0', () => {
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      expect(service.estimateCost('unknown-model', usage)).toBe(0)
    })

    it('零 token 成本为 0', () => {
      const usage: Usage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }
      expect(service.estimateCost('gpt-4o', usage)).toBe(0)
    })
  })

  describe('调用记录', () => {
    it('record 记录调用并累加成本', () => {
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      const overBudget = service.record('gpt-4o', 'session-1', 'TestAgent', usage)
      expect(overBudget).toBe(false) // 没有预算

      const summary = service.summary()
      expect(summary.callCount).toBe(1)
      expect(summary.totalCostUSD).toBeCloseTo(0.0075, 6)
      expect(summary.totalPromptTokens).toBe(1000)
      expect(summary.totalCompTokens).toBe(500)
      expect(summary.totalTokens).toBe(1500)
    })

    it('多次调用累加', () => {
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      service.record('gpt-4o', 's1', 'A', usage)
      service.record('gpt-4o', 's2', 'B', usage)
      service.record('gpt-4o-mini', 's3', 'C', usage)

      const summary = service.summary()
      expect(summary.callCount).toBe(3)
      expect(summary.totalTokens).toBe(4500)
    })

    it('summary byModel 按模型分组', () => {
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      service.record('gpt-4o', 's1', 'A', usage)
      service.record('gpt-4o-mini', 's2', 'B', usage)

      const summary = service.summary()
      expect(summary.byModel['gpt-4o']).toBeDefined()
      expect(summary.byModel['gpt-4o'].calls).toBe(1)
      expect(summary.byModel['gpt-4o-mini']).toBeDefined()
      expect(summary.byModel['gpt-4o-mini'].calls).toBe(1)
    })

    it('getRecords 返回记录（倒序）', () => {
      const usage: Usage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      }
      service.record('gpt-4o', 's1', 'A', usage)
      service.record('gpt-4o-mini', 's2', 'B', usage)

      const records = service.getRecords()
      expect(records).toHaveLength(2)
      // 倒序：最后记录的在前
      expect(records[0].model).toBe('gpt-4o-mini')
      expect(records[1].model).toBe('gpt-4o')
    })

    it('getRecords 支持 limit', () => {
      const usage: Usage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      }
      for (let i = 0; i < 5; i++) {
        service.record('gpt-4o', `s${i}`, 'A', usage)
      }

      const records = service.getRecords(3)
      expect(records).toHaveLength(3)
    })
  })

  describe('预算管理', () => {
    it('setBudget / getBudget', () => {
      const budget: BudgetConfig = {
        maxTotalCostUSD: 10.0,
        maxTokensPerSession: 100000,
        maxTokensPerCall: 10000,
      }
      service.setBudget(budget)
      expect(service.getBudget()).toEqual(budget)
    })

    it('setBudget(null) 清除预算', () => {
      service.setBudget({ maxTotalCostUSD: 10.0 })
      service.setBudget(null)
      expect(service.getBudget()).toBeNull()
    })

    it('checkBudget 无预算时返回 false', () => {
      expect(service.checkBudget()).toBe(false)
    })

    it('checkBudget 总成本超限返回 true', () => {
      service.setBudget({ maxTotalCostUSD: 0.001 })
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      // gpt-4o: 0.0075 USD > 0.001
      service.record('gpt-4o', 's1', 'A', usage)
      expect(service.checkBudget()).toBe(true)
    })

    it('checkBudget 总 token 超限返回 true', () => {
      service.setBudget({ maxTokensPerSession: 1000 })
      const usage: Usage = {
        promptTokens: 600,
        completionTokens: 500,
        totalTokens: 1100,
      }
      service.record('gpt-4o', 's1', 'A', usage)
      expect(service.checkBudget()).toBe(true)
    })

    it('checkBudget 单次 token 超限返回 true', () => {
      service.setBudget({ maxTokensPerCall: 1000 })
      const usage: Usage = {
        promptTokens: 600,
        completionTokens: 500,
        totalTokens: 1100,
      }
      service.record('gpt-4o', 's1', 'A', usage)
      expect(service.checkBudget()).toBe(true)
    })

    it('checkBudget 未超限返回 false', () => {
      service.setBudget({ maxTotalCostUSD: 100.0, maxTokensPerSession: 1000000, maxTokensPerCall: 100000 })
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      service.record('gpt-4o', 's1', 'A', usage)
      expect(service.checkBudget()).toBe(false)
    })

    it('record 返回预算超限状态', () => {
      service.setBudget({ maxTotalCostUSD: 0.001 })
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      const overBudget = service.record('gpt-4o', 's1', 'A', usage)
      expect(overBudget).toBe(true)
    })
  })

  describe('重置', () => {
    it('reset 清空所有记录和统计', () => {
      const usage: Usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }
      service.record('gpt-4o', 's1', 'A', usage)
      service.reset()

      const summary = service.summary()
      expect(summary.callCount).toBe(0)
      expect(summary.totalCostUSD).toBe(0)
      expect(summary.totalTokens).toBe(0)
      expect(service.getRecords()).toHaveLength(0)
    })

    it('reset 不清除预算', () => {
      service.setBudget({ maxTotalCostUSD: 10.0 })
      service.reset()
      expect(service.getBudget()).not.toBeNull()
    })

    it('reset 不清除定价', () => {
      service.setPricing('custom-model', {
        model: 'custom-model',
        provider: 'custom',
        promptPricePer1M: 1.0,
        completionPricePer1M: 2.0,
      })
      service.reset()
      expect(service.getPricing('custom-model')).toBeDefined()
    })
  })

  describe('stop 生命周期', () => {
    it('stop 不抛出异常', () => {
      expect(() => service.stop()).not.toThrow()
    })
  })
})
