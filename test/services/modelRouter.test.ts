import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock electron app before importing ModelRouter
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata'),
  },
}))

// Mock fs/promises to avoid real file I/O
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => { throw new Error('file not found') }),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}))

import { ModelRouter } from '../../src/main/services/ModelRouter'

describe('ModelRouter', () => {
  let router: ModelRouter

  const mockModels = [
    { id: 'm1', name: 'GPT-4o', provider: 'openai', apiKey: 'k', baseURL: '', model: 'gpt-4o', createdAt: '' },
    { id: 'm2', name: 'Claude 3.5 Sonnet', provider: 'anthropic', apiKey: 'k', baseURL: '', model: 'claude-3-5-sonnet', createdAt: '' },
    { id: 'm3', name: 'GPT-4o Mini', provider: 'openai', apiKey: 'k', baseURL: '', model: 'gpt-4o-mini', createdAt: '' },
  ]

  beforeEach(() => {
    router = new ModelRouter()
    router.updateModels(mockModels)
  })

  describe('getConfig', () => {
    it('returns default config when no models configured', () => {
      const r = new ModelRouter()
      const config = r.getConfig()
      expect(config.strategy).toBe('balanced')
      expect(config.rules).toEqual([])
    })
  })

  describe('updateModels', () => {
    it('sets defaultModelConfigId when not set and models provided', () => {
      const r = new ModelRouter()
      r.updateModels(mockModels)
      const config = r.getConfig()
      expect(config.defaultModelConfigId).toBe('m1')
    })
  })

  describe('suggest', () => {
    it('returns a suggestion with valid model', () => {
      const suggestion = router.suggest('code', 'Write a sorting algorithm')
      expect(suggestion.modelConfigId).toBeDefined()
      expect(suggestion.modelName).toBeDefined()
      expect(suggestion.strategy).toBe('balanced')
    })

    it('uses rule matching when matching rule exists', async () => {
      const rule = await router.addRule({
        taskType: 'code',
        modelConfigId: 'm2',
        strategy: 'quality',
        enabled: true,
        priority: 1,
      })
      const suggestion = router.suggest('code', 'some code task')
      expect(suggestion.modelConfigId).toBe('m2')
      expect(suggestion.reason).toContain('规则匹配')

      // cleanup
      await router.removeRule(rule.id)
    })

    it('has reason string describing the strategy', () => {
      const suggestion = router.suggest('code', 'print hello')
      expect(suggestion.reason.length).toBeGreaterThan(0)
    })

    it('returns estimated cost >= 0', () => {
      const suggestion = router.suggest('code', 'write tests')
      expect(suggestion.estimatedCost).toBeGreaterThanOrEqual(0)
    })
  })

  describe('addRule', () => {
    it('creates a rule with auto-generated id', async () => {
      const rule = await router.addRule({
        taskType: 'analysis',
        modelConfigId: 'm1',
        strategy: 'cost',
        enabled: true,
        priority: 5,
      })
      expect(rule.id).toBeDefined()
      expect(rule.taskType).toBe('analysis')

      await router.removeRule(rule.id)
    })
  })

  describe('removeRule', () => {
    it('returns true when rule existed', async () => {
      const rule = await router.addRule({
        taskType: 'chat',
        modelConfigId: 'm3',
        strategy: 'latency',
        enabled: true,
        priority: 1,
      })
      const removed = await router.removeRule(rule.id)
      expect(removed).toBe(true)
    })

    it('returns false when rule does not exist', async () => {
      const removed = await router.removeRule('nonexistent-id')
      expect(removed).toBe(false)
    })
  })
})
