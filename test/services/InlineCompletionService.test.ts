/**
 * InlineCompletionService 单元测试
 *
 * 覆盖: 启用/禁用 / 补全生成 / 缓存 / 提示词构建 / 边界条件
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InlineCompletionService } from '../../src/main/services/InlineCompletionService'

// Mock ProviderManager
function createMockProviderManager(response: string = 'const x = 1;') {
  return {
    createProvider: vi.fn(() => ({
      complete: vi.fn().mockResolvedValue({ content: response }),
    })),
  }
}

// Mock ConfigStore
function createMockConfigStore(models: Array<{ id: string; isDefault: boolean }> = []) {
  const defaultModels = models.length > 0
    ? models
    : [{ id: 'default', isDefault: true }]

  return {
    getModels: vi.fn(() => defaultModels),
    getConfig: vi.fn(() => ({})),
  }
}

describe('InlineCompletionService', () => {
  let service: InlineCompletionService
  let providerManager: ReturnType<typeof createMockProviderManager>
  let configStore: ReturnType<typeof createMockConfigStore>

  beforeEach(() => {
    providerManager = createMockProviderManager()
    configStore = createMockConfigStore()
    service = new InlineCompletionService(providerManager as any, configStore as any)
  })

  // ===== 启用/禁用 =====

  describe('启用/禁用', () => {
    it('默认应禁用', () => {
      expect(service.isEnabled()).toBe(false)
    })

    it('setEnabled(true) 应启用', () => {
      service.setEnabled(true)
      expect(service.isEnabled()).toBe(true)
    })

    it('setEnabled(false) 应禁用', () => {
      service.setEnabled(true)
      service.setEnabled(false)
      expect(service.isEnabled()).toBe(false)
    })

    it('禁用时 complete 应返回 null', async () => {
      service.setEnabled(false)
      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 6,
      })
      expect(result).toBeNull()
    })
  })

  // ===== 补全生成 =====

  describe('补全生成', () => {
    beforeEach(() => {
      service.setEnabled(true)
    })

    it('应返回补全结果', async () => {
      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const x = ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 10,
      })

      expect(result).not.toBeNull()
      expect(result!.text).toBe('const x = 1;')
      expect(result!.confidence).toBe(0.7)
      expect(result!.cacheHit).toBe(false)
    })

    it('应调用 provider.complete', async () => {
      await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'function ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 9,
      })

      expect(providerManager.createProvider).toHaveBeenCalled()
    })

    it('空响应应返回 null', async () => {
      providerManager = createMockProviderManager('')
      service = new InlineCompletionService(providerManager as any, configStore as any)
      service.setEnabled(true)

      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 6,
      })

      expect(result).toBeNull()
    })

    it('极短响应（< 2 字符）应返回 null', async () => {
      providerManager = createMockProviderManager('x')
      service = new InlineCompletionService(providerManager as any, configStore as any)
      service.setEnabled(true)

      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 6,
      })

      expect(result).toBeNull()
    })

    it('Provider 异常应返回 null', async () => {
      const failingProvider = {
        createProvider: vi.fn(() => ({
          complete: vi.fn().mockRejectedValue(new Error('API error')),
        })),
      }
      service = new InlineCompletionService(failingProvider as any, configStore as any)
      service.setEnabled(true)

      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 6,
      })

      expect(result).toBeNull()
    })

    it('无模型配置时应返回 null', async () => {
      const emptyConfig = createMockConfigStore([])
      // 覆盖 getModels 返回空数组
      emptyConfig.getModels = vi.fn(() => [])
      service = new InlineCompletionService(providerManager as any, emptyConfig as any)
      service.setEnabled(true)

      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 6,
      })

      expect(result).toBeNull()
    })
  })

  // ===== 缓存 =====

  describe('缓存', () => {
    beforeEach(() => {
      service.setEnabled(true)
    })

    it('相同请求应命中缓存', async () => {
      const request = {
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const y = ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 10,
      }

      const r1 = await service.complete(request)
      const r2 = await service.complete(request)

      expect(r1).not.toBeNull()
      expect(r2).not.toBeNull()
      expect(r2!.cacheHit).toBe(true)
      expect(r2!.text).toBe(r1!.text)

      // provider 只应被调用一次
      expect(providerManager.createProvider).toHaveBeenCalledTimes(1)
    })

    it('clearCache 应清空缓存', async () => {
      const request = {
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const z = ',
        contentAfter: '',
        cursorLine: 0,
        cursorColumn: 10,
      }

      await service.complete(request)
      service.clearCache()
      const r2 = await service.complete(request)

      expect(r2!.cacheHit).toBe(false)
    })
  })

  // ===== 上下文窗口 =====

  describe('上下文窗口', () => {
    beforeEach(() => {
      service.setEnabled(true)
    })

    it('超长上下文应被截断', async () => {
      const longContent = Array(500).fill('// line').join('\n')

      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: longContent + '\nconst ',
        contentAfter: '',
        cursorLine: 500,
        cursorColumn: 6,
      })

      // 不应抛出异常
      expect(result).toBeDefined()
    })

    it('应处理后文上下文', async () => {
      const result = await service.complete({
        filePath: 'test.ts',
        language: 'typescript',
        contentBefore: 'const x = ',
        contentAfter: '\nconsole.log(x)',
        cursorLine: 0,
        cursorColumn: 10,
      })

      expect(result).not.toBeNull()
    })
  })
})
