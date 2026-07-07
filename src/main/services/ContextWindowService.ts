// 上下文窗口管理服务
// [重构] 使用 SDK 原生 ContextWindow + CompressStrategy + estimateTokens
// 保持 AELA 公共 API 不变，内部委托给 SDK 实现
// SDK 优势: LLM 压缩+超时保护+简单截断降级、token 估算复用

import {
  ContextWindow as SDKContextWindow,
  CompressStrategy as SDKCompressStrategy,
  estimateTokens as sdkEstimateTokens,
  estimateTokenCount as sdkEstimateTokenCount,
  type CompressConfig as SDKCompressConfig,
} from '@agentprimordia/sdk'
import type { Provider, Message } from '@agentprimordia/sdk'
import type { ContextWindowConfig, ContextCompressConfig } from '@shared/types'
import { getModelContextWindow } from '@shared/types/model'
import type { ModelConfig } from '@shared/types/model'

// ===== 上下文窗口策略接口（保持 AELA 内部兼容）=====

export interface ContextWindowStrategy {
  name: string
  trim(messages: Message[], maxMessages: number): Message[]
}

// ===== DefaultStrategy: 保留首条 + 最近 N 条 =====

export class DefaultStrategy implements ContextWindowStrategy {
  name = 'default'
  keepLast: number

  constructor(keepLast = 80) {
    this.keepLast = keepLast
  }

  trim(messages: Message[], maxMessages: number): Message[] {
    if (messages.length === 0) return messages

    const effectiveMax = maxMessages > 0 ? maxMessages : this.keepLast
    if (messages.length <= effectiveMax) return messages

    const result: Message[] = [messages[0]]

    let remaining = effectiveMax - 1
    if (remaining > this.keepLast) {
      remaining = this.keepLast
    }

    const start = Math.max(1, messages.length - remaining)
    result.push(...messages.slice(start))
    return result
  }
}

// ===== CompressStrategy: 使用 SDK CompressStrategy（LLM 摘要压缩 + 超时保护 + 降级截断）=====

export class CompressStrategy implements ContextWindowStrategy {
  name = 'compress'
  config: ContextCompressConfig
  private sdkStrategy: SDKCompressStrategy

  constructor(config: Partial<ContextCompressConfig> = {}, summaryModel?: Provider) {
    this.config = {
      maxTokens: config.maxTokens ?? 4000,
      keepSystemMessages: config.keepSystemMessages ?? true,
      keepRecentN: config.keepRecentN ?? 4,
      compressRatio: config.compressRatio ?? 0.3,
    }
    const sdkConfig: SDKCompressConfig = {
      maxTokens: this.config.maxTokens,
      keepSystemMessages: this.config.keepSystemMessages,
      keepRecentN: this.config.keepRecentN,
      compressRatio: this.config.compressRatio,
      summaryModel: summaryModel ?? undefined,
      // SDK 支持 LLM 压缩超时保护（30s），超时后降级为简单截断
      compressTimeoutMs: 30_000,
    }
    this.sdkStrategy = new SDKCompressStrategy(sdkConfig)
  }

  setSummaryModel(provider: Provider): void {
    // 重建 SDK 策略以注入新的 summaryModel
    this.sdkStrategy = new SDKCompressStrategy({
      maxTokens: this.config.maxTokens,
      keepSystemMessages: this.config.keepSystemMessages,
      keepRecentN: this.config.keepRecentN,
      compressRatio: this.config.compressRatio,
      summaryModel: provider,
      compressTimeoutMs: 30_000,
    })
  }

  trim(messages: Message[], maxMessages: number): Message[] {
    // SDK CompressStrategy.trim 是同步截断（非 LLM），与 AELA 原有行为一致
    return this.sdkStrategy.trim(messages, maxMessages)
  }

  /**
   * 异步压缩旧消息为摘要 — 委托给 SDK compressWithLLM
   * SDK 提供 30s 超时保护，超时后降级为简单截断
   */
  async compressOldMessages(old: Message[]): Promise<string> {
    if (old.length === 0) return ''

    // 使用 SDK 的 compressWithLLM，它内部有超时保护和降级逻辑
    const compressed = await this.sdkStrategy.compressWithLLM(old)
    // compressed 返回的是整个消息列表（system + summary + recent）
    // 我们只需要摘要部分
    const summaryMsg = compressed.find(m => m.role === 'system' && m.content.startsWith('[Conversation summary]'))
    return summaryMsg?.content ?? this.fallbackSummary(old)
  }

  /**
   * 无 LLM 时的降级摘要（取首尾各一条）
   */
  fallbackSummary(old: Message[]): string {
    if (old.length === 0) return ''
    if (old.length === 1) {
      return `${old[0].role}: ${old[0].content}`
    }
    const first = old[0]
    const last = old[old.length - 1]
    return `${first.role}: ${first.content}\n...\n${last.role}: ${last.content}`
  }
}

// ===== 上下文窗口管理器 =====

export class ContextWindowService {
  private strategy: ContextWindowStrategy
  private config: ContextWindowConfig
  private sdkContextWindow: SDKContextWindow | null = null
  private summaryModel: Provider | null = null

  constructor(config: Partial<ContextWindowConfig> = {}) {
    this.config = {
      strategy: config.strategy ?? 'default',
      maxMessages: config.maxMessages ?? 80,
      keepLast: config.keepLast ?? 60,
      compress: config.compress ?? {
        maxTokens: 4000,
        keepSystemMessages: true,
        keepRecentN: 4,
        compressRatio: 0.3,
      },
    }
    this.strategy = this.createStrategy(null)
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<ContextWindowConfig>, summaryModel?: Provider): void {
    this.config = { ...this.config, ...config }
    if (summaryModel) this.summaryModel = summaryModel
    this.strategy = this.createStrategy(this.summaryModel)
    this.sdkContextWindow = null // 重置 SDK ContextWindow
  }

  /**
   * 获取配置
   */
  getConfig(): ContextWindowConfig {
    return { ...this.config }
  }

  /**
   * 设置摘要模型（用于 CompressStrategy）
   */
  setSummaryModel(provider: Provider): void {
    this.summaryModel = provider
    if (this.strategy instanceof CompressStrategy) {
      this.strategy.setSummaryModel(provider)
    } else if (this.config.strategy === 'compress') {
      this.strategy = this.createStrategy(provider)
    }
    this.sdkContextWindow = null
  }

  /**
   * 裁剪消息历史
   */
  trim(messages: Message[]): Message[] {
    return this.strategy.trim(messages, this.config.maxMessages)
  }

  /**
   * 估算消息的 Token 数 — 委托给 SDK estimateTokens
   */
  estimateTokens(messages: Message[]): number {
    return sdkEstimateTokens(messages)
  }

  /**
   * 估算单条文本的 Token 数 — 委托给 SDK estimateTokenCount
   */
  estimateTokenCount(text: string): number {
    return sdkEstimateTokenCount(text)
  }

  /**
   * 获取模型的上下文窗口大小（token 数）
   * 由调用方传入，服务自身不依赖 ConfigStore（保持解耦）
   */
  static resolveContextSize(model?: { contextSize?: number; model?: string } | null): number {
    if (!model) return 8192
    if (model.contextSize && model.contextSize > 0) return model.contextSize
    if (model.model) return getModelContextWindow(model.model)
    return 8192
  }

  /**
   * 计算动态压缩触发阈值（0.5~0.85）
   * @param contextSize 当前模型上下文窗口大小（token 数）
   */
  static computeDynamicThreshold(contextSize: number): number {
    const safetyMargin = Math.min(contextSize * 0.1, 4096)
    const raw = 1 - safetyMargin / contextSize
    return Math.max(0.5, Math.min(0.85, raw))
  }

  /**
   * 实例方法版本，需配合 setModelContext 使用（向后兼容）
   */
  private currentModelContextSize = 8192

  setModelContextSize(size: number): void {
    this.currentModelContextSize = size
  }

  getModelContextSize(): number {
    return this.currentModelContextSize
  }

  computeDynamicThresholdForCurrent(): number {
    return ContextWindowService.computeDynamicThreshold(this.currentModelContextSize)
  }

  /**
   * 测量当前消息的 Token 用量和预算占比 — 使用 SDK ContextWindow.measure
   */
  measure(messages: Message[]): { tokens: number; budget: number; usage: number } {
    // 懒创建 SDK ContextWindow
    const maxTokens = this.config.compress?.maxTokens ?? 4000
    if (!this.sdkContextWindow) {
      this.sdkContextWindow = new SDKContextWindow({ maxTokens })
    }
    return this.sdkContextWindow.measure(messages)
  }

  /**
   * 使用 SDK ContextWindow.manage 自动管理上下文（含 LLM 压缩 + 超时保护）
   */
  async manageAsync(messages: Message[], summaryModel?: Provider): Promise<Message[]> {
    const maxTokens = this.config.compress?.maxTokens ?? 4000
    const provider = summaryModel ?? this.summaryModel
    if (!provider) {
      // 无 Provider，使用同步截断
      return this.trim(messages)
    }

    const compressConfig: SDKCompressConfig = {
      maxTokens,
      keepSystemMessages: this.config.compress?.keepSystemMessages ?? true,
      keepRecentN: this.config.compress?.keepRecentN ?? 4,
      compressRatio: this.config.compress?.compressRatio ?? 0.3,
      summaryModel: provider,
      compressTimeoutMs: 30_000,
    }
    const ctxWindow = new SDKContextWindow({ maxTokens, compressConfig })
    return ctxWindow.manage(messages)
  }

  /**
   * 异步压缩：使用 LLM 生成摘要并替换旧消息
   */
  async compressAsync(messages: Message[], summaryModel: Provider): Promise<Message[]> {
    if (messages.length <= this.config.maxMessages) return messages

    const compress = new CompressStrategy(this.config.compress, summaryModel)
    const summary = await compress.compressOldMessages(
      messages.filter(m => m.role !== 'system')
    )

    const systemMsgs = messages.filter(m => m.role === 'system')
    const nonSystem = messages.filter(m => m.role !== 'system')
    const keepN = Math.min(this.config.compress?.keepRecentN ?? 4, nonSystem.length)
    const recentMsgs = nonSystem.slice(nonSystem.length - keepN)

    const summaryMsg: Message = {
      role: 'system',
      content: `[对话摘要]\n${summary}`,
    } as Message

    return [...systemMsgs, summaryMsg, ...recentMsgs]
  }

  private createStrategy(summaryModel: Provider | null | undefined): ContextWindowStrategy {
    switch (this.config.strategy) {
      case 'compress':
        return new CompressStrategy(this.config.compress, summaryModel ?? undefined)
      case 'default':
      default:
        return new DefaultStrategy(this.config.keepLast)
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
