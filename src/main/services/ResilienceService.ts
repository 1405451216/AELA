// ResilientProvider 韧性服务
// 提供可配置的重试/熔断/Fallback 设置 + 熔断器状态追踪
// ProviderManager 已内置 ResilientProvider，此服务提供配置和可观测能力
// [SDK 集成] 使用 SDK CircuitBreaker/Retry/ResilientWrapper 提供独立弹性包装能力

import Store from 'electron-store'
import { CircuitBreaker, ResilientWrapper, FallbackHandler, type CircuitState } from '@agentprimordia/sdk'
import type {
  ResilienceConfig,
  CircuitBreakerState,
  ResilienceStats,
  ModelConfig,
} from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'

interface ResilienceStoreSchema {
  config: ResilienceConfig
  breakerStates: Record<string, CircuitBreakerState>
  // 全局统计
  totalRequests: number
  totalRetries: number
  totalFallbacks: number
  totalFailures: number
}

const DEFAULT_CONFIG: ResilienceConfig = {
  maxRetries: 3,
  retryBackoffMs: 500,
  maxBackoffMs: 10000,
  circuitThreshold: 5,
  circuitRecoverMs: 30000,
  retryOnErrors: [
    'timeout',
    'timed out',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'socket hang up',
    'network error',
    'fetch failed',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
  fallbackModelId: null,
}

export class ResilienceService {
  private store: Store<ResilienceStoreSchema>
  private providerManager: ProviderManager
  private configStore: ConfigStore

  constructor(providerManager: ProviderManager, configStore: ConfigStore) {
    this.providerManager = providerManager
    this.configStore = configStore
    this.store = new Store<ResilienceStoreSchema>({
      name: 'aela-resilience',
      defaults: {
        config: DEFAULT_CONFIG,
        breakerStates: {},
        totalRequests: 0,
        totalRetries: 0,
        totalFallbacks: 0,
        totalFailures: 0,
      },
    })
  }

  /**
   * 获取当前韧性配置
   */
  getConfig(): ResilienceConfig {
    return this.store.get('config', DEFAULT_CONFIG)
  }

  /**
   * 更新韧性配置
   * 注意: 更新后需要清除 Provider 缓存才能生效
   */
  setConfig(partial: Partial<ResilienceConfig>): ResilienceConfig {
    const current = this.getConfig()
    const updated = { ...current, ...partial }
    this.store.set('config', updated)

    // 清除所有缓存的 Provider，使其在下次创建时使用新配置
    this.providerManager.invalidateAll()

    return updated
  }

  /**
   * 获取所有熔断器状态
   * 优先从 ProviderManager 中 ResilientProvider 的实际运行状态读取，
   * electron-store 中的 breakerStates 仅作为历史统计补充
   */
  getStats(): ResilienceStats {
    const config = this.getConfig()
    const storeBreakerStates = this.store.get('breakerStates', {})
    const totalRequests = this.store.get('totalRequests', 0)
    const totalRetries = this.store.get('totalRetries', 0)
    const totalFallbacks = this.store.get('totalFallbacks', 0)

    // 从 ProviderManager 获取实际运行时状态
    const runtimeStates = this.providerManager.getProviderBreakerStates()

    // 合并：运行时状态为准，store 中的统计字段补充
    const breakers: CircuitBreakerState[] = []

    // 先处理有运行时状态的 Provider
    for (const [modelId, rtState] of Object.entries(runtimeStates)) {
      const stored = storeBreakerStates[modelId]
      breakers.push({
        modelId,
        modelName: stored?.modelName ?? modelId,
        state: rtState.state,
        failureCount: rtState.failures,
        lastFailureTime: rtState.lastFailTime > 0 ? new Date(rtState.lastFailTime).toISOString() : null,
        lastFailureError: stored?.lastFailureError ?? null,
        totalRequests: stored?.totalRequests ?? 0,
        totalFailures: stored?.totalFailures ?? 0,
        totalRetries: stored?.totalRetries ?? 0,
        totalFallbacks: stored?.totalFallbacks ?? 0,
      })
    }

    // 再处理 store 中有记录但当前无缓存 Provider 的（Provider 已失效但历史记录保留）
    for (const [modelId, stored] of Object.entries(storeBreakerStates)) {
      if (!runtimeStates[modelId]) {
        breakers.push(stored)
      }
    }

    return {
      config,
      circuitBreakers: breakers,
      totalRequests,
      totalRetries,
      totalFallbacks,
      avgRetryRate: totalRequests > 0 ? totalRetries / totalRequests : 0,
    }
  }

  /**
   * 重置指定模型的熔断器
   * 同时重置 ProviderManager 中 ResilientProvider 的运行时状态和 electron-store 中的记录
   */
  resetBreaker(modelId: string): boolean {
    // 重置 ProviderManager 中的实际熔断器
    const runtimeReset = this.providerManager.resetProviderBreaker(modelId)

    // 重置 electron-store 中的记录
    const breakerStates = this.store.get('breakerStates', {})
    if (breakerStates[modelId]) {
      breakerStates[modelId] = {
        ...breakerStates[modelId],
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        lastFailureError: null,
      }
      this.store.set('breakerStates', breakerStates)
      return true
    }

    // 如果 store 中没有记录但有运行时实例，也算成功
    return runtimeReset
  }

  /**
   * 记录一次请求（由 ProviderManager 调用或手动调用）
   */
  recordRequest(modelId: string, success: boolean, retried: boolean, usedFallback: boolean): void {
    const config = this.getConfig()
    const breakerStates = this.store.get('breakerStates', {})

    // 获取模型名
    const modelConfig = this.configStore.getModel(modelId)
    const modelName = modelConfig?.name ?? modelId

    // 获取或创建熔断器状态
    if (!breakerStates[modelId]) {
      breakerStates[modelId] = {
        modelId,
        modelName,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        lastFailureError: null,
        totalRequests: 0,
        totalFailures: 0,
        totalRetries: 0,
        totalFallbacks: 0,
      }
    }

    const breaker = breakerStates[modelId]
    breaker.totalRequests++

    if (success) {
      // 成功 → 重置失败计数
      if (breaker.state === 'half_open') {
        breaker.state = 'closed'
      }
      breaker.failureCount = 0
    } else {
      // 失败 → 增加失败计数
      breaker.failureCount++
      breaker.totalFailures++
      breaker.lastFailureTime = new Date().toISOString()

      // 检查是否触发熔断
      if (breaker.failureCount >= config.circuitThreshold && breaker.state === 'closed') {
        breaker.state = 'open'
      }
    }

    if (retried) breaker.totalRetries++
    if (usedFallback) breaker.totalFallbacks++

    breakerStates[modelId] = breaker
    this.store.set('breakerStates', breakerStates)

    // 更新全局统计
    this.store.set('totalRequests', this.store.get('totalRequests', 0) + 1)
    if (retried) this.store.set('totalRetries', this.store.get('totalRetries', 0) + 1)
    if (usedFallback) this.store.set('totalFallbacks', this.store.get('totalFallbacks', 0) + 1)
  }

  /**
   * 记录错误（带错误信息）
   */
  recordError(modelId: string, error: string): void {
    const breakerStates = this.store.get('breakerStates', {})
    const modelConfig = this.configStore.getModel(modelId)
    const modelName = modelConfig?.name ?? modelId

    if (!breakerStates[modelId]) {
      breakerStates[modelId] = {
        modelId,
        modelName,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: null,
        lastFailureError: null,
        totalRequests: 0,
        totalFailures: 0,
        totalRetries: 0,
        totalFallbacks: 0,
      }
    }

    breakerStates[modelId].lastFailureError = error.slice(0, 500)
    this.store.set('breakerStates', breakerStates)
  }

  /**
   * 判断是否应该重试
   */
  shouldRetry(error: string): boolean {
    const config = this.getConfig()
    const lower = error.toLowerCase()
    return config.retryOnErrors.some(keyword =>
      lower.includes(keyword.toLowerCase())
    )
  }

  /**
   * 判断熔断器是否打开（应该拒绝请求）
   * 优先检查 ProviderManager 中 ResilientProvider 的实际状态
   */
  isCircuitOpen(modelId: string): boolean {
    // 优先从 ProviderManager 获取运行时状态
    const runtimeStates = this.providerManager.getProviderBreakerStates()
    const rtState = runtimeStates[modelId]
    if (rtState) {
      return rtState.state === 'open'
    }

    // 回退到 electron-store 中的状态（Provider 尚未被创建/缓存时）
    const breakerStates = this.store.get('breakerStates', {})
    const breaker = breakerStates[modelId]
    if (!breaker) return false

    const config = this.getConfig()

    if (breaker.state === 'open') {
      // 检查是否已过恢复时间
      if (breaker.lastFailureTime) {
        const elapsed = Date.now() - new Date(breaker.lastFailureTime).getTime()
        if (elapsed > config.circuitRecoverMs) {
          return false
        }
      }
      return true
    }

    return false
  }

  /**
   * 获取 Fallback 模型配置
   */
  getFallbackModel(): ModelConfig | null {
    const config = this.getConfig()
    if (!config.fallbackModelId) return null
    return this.configStore.getModel(config.fallbackModelId) ?? null
  }

  /**
   * 重置所有统计
   */
  resetStats(): void {
    this.store.set('breakerStates', {})
    this.store.set('totalRequests', 0)
    this.store.set('totalRetries', 0)
    this.store.set('totalFallbacks', 0)
    this.store.set('totalFailures', 0)
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }

  // ===== [SDK 集成] SDK 弹性组件 =====
  // SDK CircuitBreaker/Retry/ResilientWrapper 提供独立的弹性包装能力
  // 可用于包装任意异步操作（不限于 Provider 调用）

  /** SDK 熔断器实例缓存（按 key 隔离） */
  private sdkBreakers: Map<string, CircuitBreaker> = new Map()

  /** SDK 弹性包装器实例缓存 */
  private sdkWrappers: Map<string, ResilientWrapper> = new Map()

  /**
   * 创建或获取 SDK CircuitBreaker 实例
   * @param key 隔离键（如 modelId 或操作名）
   */
  getSdkCircuitBreaker(key: string = 'default'): CircuitBreaker {
    if (!this.sdkBreakers.has(key)) {
      const config = this.getConfig()
      this.sdkBreakers.set(key, new CircuitBreaker({
        maxFailures: config.circuitThreshold,
        resetTimeoutMs: config.circuitRecoverMs,
      }))
    }
    return this.sdkBreakers.get(key)!
  }

  /**
   * 创建或获取 SDK ResilientWrapper 实例
   * 整合 CircuitBreaker + Retry + Timeout 三层弹性保护
   * @param key 隔离键
   * @param timeoutMs 可选超时
   */
  getSdkResilientWrapper(key: string = 'default', timeoutMs?: number): ResilientWrapper {
    if (!this.sdkWrappers.has(key)) {
      const config = this.getConfig()
      this.sdkWrappers.set(key, new ResilientWrapper({
        circuitBreaker: {
          maxFailures: config.circuitThreshold,
          resetTimeoutMs: config.circuitRecoverMs,
        },
        retry: {
          maxRetries: config.maxRetries,
          initialDelayMs: config.retryBackoffMs,
          maxDelayMs: config.maxBackoffMs,
          jitter: true,
          retryableErrors: config.retryOnErrors,
        },
        timeoutMs: timeoutMs ?? config.maxBackoffMs,
      }))
    }
    return this.sdkWrappers.get(key)!
  }

  /**
   * 使用 SDK ResilientWrapper 执行异步操作
   * 自动应用重试 + 熔断 + 超时保护
   */
  async executeWithResilience<T>(
    key: string,
    fn: () => Promise<T>,
    timeoutMs?: number,
  ): Promise<T> {
    const wrapper = this.getSdkResilientWrapper(key, timeoutMs)
    return wrapper.execute(fn)
  }

  /**
   * 创建 Fallback 链 — 多个备选操作依次尝试
   * @returns 第一个成功的操作结果
   */
  async executeWithFallback<T>(
    operations: Array<{ name: string; fn: () => Promise<T> }>,
  ): Promise<{ result: T; provider: string }> {
    const handler = new FallbackHandler<T>()
    for (const op of operations) {
      handler.add(op.name, op.fn)
    }
    return handler.execute()
  }

  /**
   * 获取 SDK 熔断器状态
   */
  getSdkBreakerState(key: string = 'default'): CircuitState {
    return this.getSdkCircuitBreaker(key).getState()
  }

  /**
   * 重置 SDK 熔断器
   */
  resetSdkBreaker(key: string = 'default'): void {
    this.getSdkCircuitBreaker(key).reset()
  }
}
