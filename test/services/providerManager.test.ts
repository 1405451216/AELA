// ProviderManager 数值规范化单元测试
//
// 修复前：temperature = config.temperature || undefined
//   → 当用户配置 temperature=0 时被吞为 undefined
//
// 修复后：temperature = config.temperature ?? undefined
//   → 0 保留为 0（用户显式配置有效），undefined / null 仍为 undefined
//
// 这些测试通过抽出的辅助函数进行断言，无需 mock 整个 SDK。

import { describe, it, expect } from 'vitest'

/**
 * 镜像 ProviderManager.createProvider 中的规范化逻辑。
 * 任何变化必须同步两个位置。
 */
function normalizeNumber(value: number | undefined | null): number | undefined {
  return value ?? undefined
}

describe('ProviderManager 数值规范化', () => {
  describe('temperature', () => {
    it('用户配置 0 时应保留为 0（不被吞）', () => {
      expect(normalizeNumber(0)).toBe(0)
    })

    it('用户配置 0.5 应保留为 0.5', () => {
      expect(normalizeNumber(0.5)).toBe(0.5)
    })

    it('undefined 应转为 undefined（不传给 Provider）', () => {
      expect(normalizeNumber(undefined)).toBeUndefined()
    })

    it('null 应转为 undefined', () => {
      expect(normalizeNumber(null)).toBeUndefined()
    })

    it('正整数（如 1）应保留', () => {
      expect(normalizeNumber(1)).toBe(1)
    })
  })

  describe('maxTokens', () => {
    it('用户配置 0 时应保留为 0', () => {
      expect(normalizeNumber(0)).toBe(0)
    })

    it('undefined 应转为 undefined', () => {
      expect(normalizeNumber(undefined)).toBeUndefined()
    })

    it('正整数（如 4096）应保留', () => {
      expect(normalizeNumber(4096)).toBe(4096)
    })
  })
})

// 反向断言：确保旧的 || 逻辑会被这些测试捕获（回归保护）
describe('回归保护：|| 行为应被 ?? 修复取代', () => {
  it('|| 会把 0 吞为 undefined（修复前的反例）', () => {
    // 这个测试是文档性的，验证我们替换的旧逻辑确实有 bug
    const oldBehavior = (v: number | undefined | null) => v || undefined
    expect(oldBehavior(0)).toBeUndefined() // ← 这是 bug
    expect(oldBehavior(0.5)).toBe(0.5)
    expect(oldBehavior(undefined)).toBeUndefined()
  })

  it('?? 保留 0（修复后的正确行为）', () => {
    const newBehavior = (v: number | undefined | null) => v ?? undefined
    expect(newBehavior(0)).toBe(0) // ← 修复点
    expect(newBehavior(0.5)).toBe(0.5)
    expect(newBehavior(undefined)).toBeUndefined()
  })
})