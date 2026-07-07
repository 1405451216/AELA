// 推理引擎服务
// [SDK 集成] 封装 SDK ReasoningEngine，提供独立的 LLM 推理能力
// 与 AgentService 不同，ReasoningService 不包含 ReAct 循环，
// 专注于单轮推理（同步/流式），适用于轻量级推理任务
// SDK 优势:
//   - 内置重试 + 指数退避
//   - 流式推理 + 工具调用一体化
//   - 可配置温度/maxTokens

import {
  ReasoningEngine,
  singleRoundReasoning,
  singleRoundReasoningStream,
  type Thought,
  type ReasoningConfig,
} from '@agentprimordia/sdk'
import type { Provider, Message, ToolDefinition } from '@agentprimordia/sdk'
import type { ModelConfig } from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'

export interface ReasonOptions {
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
}

export interface ReasonStreamOptions extends ReasonOptions {
  /** 流式回调 — 类型与 ReasoningConfig.onStream 保持同步 */
  onStream?: NonNullable<ReasoningConfig['onStream']>
}

export class ReasoningService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  /** 引擎缓存（按 modelId 隔离） */
  private engines: Map<string, ReasoningEngine> = new Map()

  constructor(providerManager: ProviderManager, configStore: ConfigStore) {
    this.providerManager = providerManager
    this.configStore = configStore
  }

  /**
   * 创建或获取推理引擎实例
   */
  private getEngine(
    modelConfig: ModelConfig,
    opts?: { temperature?: number; maxTokens?: number; onStream?: ReasonStreamOptions['onStream'] },
  ): ReasoningEngine {
    const key = modelConfig.id
    // 每次创建新引擎以保证 onStream 回调正确
    if (opts?.onStream || !this.engines.has(key)) {
      const provider: Provider = this.providerManager.createProvider(modelConfig)
      const config: ReasoningConfig = {
        provider,
        temperature: opts?.temperature ?? modelConfig.temperature ?? 0.7,
        maxTokens: opts?.maxTokens ?? modelConfig.maxTokens ?? 4096,
        maxRetries: 3,
        onStream: opts?.onStream,
      }
      if (opts?.onStream) {
        // 流式场景需要新引擎（onStream 不同）
        return new ReasoningEngine(config)
      }
      const engine = new ReasoningEngine(config)
      this.engines.set(key, engine)
      return engine
    }
    return this.engines.get(key)!
  }

  /**
   * 单轮同步推理
   * @param modelConfigId 模型配置 ID
   * @param messages 消息列表
   * @param opts 推理选项（温度/maxTokens/工具定义）
   */
  async reason(
    modelConfigId: string,
    messages: Message[],
    opts?: ReasonOptions,
  ): Promise<Thought> {
    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`Model config not found: ${modelConfigId}`)
    }

    const engine = this.getEngine(modelConfig, {
      temperature: opts?.temperature,
      maxTokens: opts?.maxTokens,
    })

    return engine.reason(messages, opts?.tools ?? [])
  }

  /**
   * 单轮流式推理
   * @param modelConfigId 模型配置 ID
   * @param messages 消息列表
   * @param opts 流式选项（含 onStream 回调）
   */
  async reasonStream(
    modelConfigId: string,
    messages: Message[],
    opts?: ReasonStreamOptions,
  ): Promise<Thought> {
    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`Model config not found: ${modelConfigId}`)
    }

    const engine = this.getEngine(modelConfig, opts)

    return engine.reasonStream(messages, opts?.tools ?? [])
  }

  /**
   * 快捷单轮推理（不缓存引擎，一次性使用）
   * 使用 SDK singleRoundReasoning 函数
   */
  async quickReason(
    modelConfigId: string,
    messages: Message[],
    opts?: { temperature?: number; maxTokens?: number; tools?: ToolDefinition[] },
  ): Promise<Thought> {
    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`Model config not found: ${modelConfigId}`)
    }

    const provider: Provider = this.providerManager.createProvider(modelConfig)

    return singleRoundReasoning(
      provider,
      messages,
      opts?.tools ?? [],
      {
        temperature: opts?.temperature ?? modelConfig.temperature,
        maxTokens: opts?.maxTokens ?? modelConfig.maxTokens,
      },
    )
  }

  /**
   * 快捷单轮流式推理（不缓存引擎）
   * 使用 SDK singleRoundReasoningStream 函数
   */
  async quickReasonStream(
    modelConfigId: string,
    messages: Message[],
    opts?: ReasonStreamOptions,
  ): Promise<Thought> {
    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`Model config not found: ${modelConfigId}`)
    }

    const provider: Provider = this.providerManager.createProvider(modelConfig)

    return singleRoundReasoningStream(
      provider,
      messages,
      opts?.tools ?? [],
      {
        temperature: opts?.temperature ?? modelConfig.temperature,
        maxTokens: opts?.maxTokens ?? modelConfig.maxTokens,
      onStream: opts?.onStream,
    },
  )
  }

  /** 生命周期停止方法 */
  stop(): void {
    this.engines.clear()
  }
}
