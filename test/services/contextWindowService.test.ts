import { describe, it, expect, beforeEach } from 'vitest'
import { ContextWindowService, DefaultStrategy } from '../../src/main/services/ContextWindowService'
import type { Message } from '@agentprimordia/sdk'

function makeMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
    content: `Message ${i} with some content for testing`,
  }))
}

describe('DefaultStrategy', () => {
  it('returns empty array when input is empty', () => {
    const strategy = new DefaultStrategy(10)
    const result = strategy.trim([], 5)
    expect(result).toEqual([])
  })

  it('returns all messages when under limit', () => {
    const strategy = new DefaultStrategy(10)
    const msgs = makeMessages(5)
    const result = strategy.trim(msgs, 10)
    expect(result.length).toBe(5)
  })

  it('trims to maxMessages when over limit', () => {
    const strategy = new DefaultStrategy(80)
    const msgs = makeMessages(100)
    const result = strategy.trim(msgs, 50)
    expect(result.length).toBe(50)
  })

  it('preserves the first message after trimming', () => {
    const strategy = new DefaultStrategy(80)
    const msgs = makeMessages(100)
    const result = strategy.trim(msgs, 10)
    expect(result[0]).toBe(msgs[0])
  })
})

describe('ContextWindowService', () => {
  let service: ContextWindowService

  beforeEach(() => {
    service = new ContextWindowService({
      strategy: 'default',
      maxMessages: 50,
      keepLast: 30,
    })
  })

  describe('constructor', () => {
    it('creates with default config when no params', () => {
      const s = new ContextWindowService()
      const config = s.getConfig()
      expect(config.strategy).toBe('default')
      expect(config.maxMessages).toBe(80)
    })

    it('merges partial config with defaults', () => {
      const s = new ContextWindowService({ maxMessages: 100 })
      expect(s.getConfig().maxMessages).toBe(100)
      expect(s.getConfig().strategy).toBe('default')
    })
  })

  describe('setConfig', () => {
    it('updates maxMessages', () => {
      service.setConfig({ maxMessages: 20 })
      expect(service.getConfig().maxMessages).toBe(20)
    })

    it('updates strategy', () => {
      service.setConfig({ strategy: 'compress' })
      expect(service.getConfig().strategy).toBe('compress')
    })
  })

  describe('trim', () => {
    it('returns messages under limit unchanged', () => {
      const msgs = makeMessages(10)
      const result = service.trim(msgs)
      expect(result.length).toBe(10)
    })

    it('trims messages over limit respecting keepLast', () => {
      const msgs = makeMessages(100)
      const result = service.trim(msgs)
      // keepLast is 30, so result is 1 (first) + 30 (last) = 31
      expect(result.length).toBe(31)
    })
  })

  describe('estimateTokens', () => {
    it('returns a positive number for non-empty messages', () => {
      const msgs = makeMessages(5)
      const tokens = service.estimateTokens(msgs)
      expect(tokens).toBeGreaterThan(0)
    })

    it('returns 0 for empty messages', () => {
      const tokens = service.estimateTokens([])
      expect(tokens).toBe(0)
    })
  })

  describe('estimateTokenCount', () => {
    it('returns positive count for non-empty text', () => {
      const count = service.estimateTokenCount('Hello world, this is a test')
      expect(count).toBeGreaterThan(0)
    })

    it('returns 0 for empty text', () => {
      const count = service.estimateTokenCount('')
      expect(count).toBe(0)
    })
  })

  describe('measure', () => {
    it('returns tokens, budget, and usage', () => {
      const msgs = makeMessages(5)
      const result = service.measure(msgs)
      expect(result.tokens).toBeGreaterThanOrEqual(0)
      expect(result.budget).toBeGreaterThan(0)
      expect(result.usage).toBeGreaterThanOrEqual(0)
    })
  })
})
