// 多模型 Provider 管理器
// 根据 ModelConfig 创建对应的 LLM Provider 实例
// 支持: OpenAI / Anthropic / Gemini / Ollama / 自定义
// 自动包裹 ResilientProvider 实现重试 + 熔断 + Fallback

import {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OllamaProvider,
  ResilientProvider,
  RateLimiter,
  BatchProcessor,
  type BatchRequest,
  type BatchResult,
  // [SDK 集成] 专用 Provider
  DeepSeekProvider,
  QwenProvider,
  GLMProvider,
  MistralProvider,
  CohereProvider,
  AzureOpenAIProvider,
} from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type { ModelConfig, ResilienceConfig } from '@shared/types'

/** Provider 熔断器运行时状态（从 ResilientProvider.getBreakerState() 提取） */
export interface ProviderBreakerRuntimeState {
  state: 'closed' | 'open' | 'half_open'
  failures: number
  lastFailTime: number
}

export class ProviderManager {
  private providers: Map<string, Provider> = new Map()
  private resilienceConfig: ResilienceConfig | null = null

  // [SDK 集成] 全局限流器 — 令牌桶算法防止 API 限流
  private rateLimiter: RateLimiter | null = null
  private rateLimitRPM: number = 0 // 0 = 不限流

  // [SDK 集成] 批处理器缓存（按 modelId 隔离）
  private batchProcessors: Map<string, BatchProcessor> = new Map()

  /**
   * 根据 ModelConfig 创建 Provider 实例
   * 所有 Provider 自动包裹 ResilientProvider:
   *   - 自动重试 (5xx / 429 / 超时, 指数退避)
   *   - 熔断器 (连续 5 次失败后熔断 30s)
   *   - Fallback 链 (可选)
   */
  createProvider(config: ModelConfig): Provider {
    // 检查缓存
    const cached = this.providers.get(config.id)
    if (cached) return cached

    // temperature=0 是合法值，保留；maxTokens=0 表示"使用模型默认值"，转为 undefined 不传给 SDK
    const temperature = config.temperature ?? undefined
    const maxTokens = (config.maxTokens && config.maxTokens > 0) ? config.maxTokens : undefined

    let rawProvider: Provider

    switch (config.provider) {
      case 'anthropic':
        rawProvider = new AnthropicProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'gemini':
        rawProvider = new GeminiProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'ollama':
        rawProvider = new OllamaProvider({
          apiKey: config.apiKey || 'ollama',
          baseURL: config.baseURL || 'http://localhost:11434',
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      // [SDK 集成] 专用 Provider — 原生支持各家 API 特性
      case 'deepseek':
        rawProvider = new DeepSeekProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'qwen':
        rawProvider = new QwenProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'glm':
      case 'zhipu':
        rawProvider = new GLMProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'mistral':
        rawProvider = new MistralProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'cohere':
        rawProvider = new CohereProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || undefined,
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'azure':
      case 'azure-openai': {
        // AzureConfig 需要 resourceName + deploymentName，从 AELA 的 baseURL/model 映射
        // baseURL 格式: https://{resourceName}.openai.azure.com
        const azureResourceName = config.baseURL
          ? config.baseURL.replace(/^https?:\/\//, '').split('.')[0]
          : ''
        rawProvider = new AzureOpenAIProvider({
          apiKey: config.apiKey,
          resourceName: azureResourceName,
          deploymentName: config.model,
          temperature,
          maxTokens,
        })
        break
      }

      case 'openai-compatible':
        // OpenAICompatibleProvider 是抽象类，使用具体的 OpenAIProvider 替代
        rawProvider = new OpenAIProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || 'http://localhost:8080/v1',
          model: config.model,
          temperature,
          maxTokens,
        })
        break

      case 'openai':
      case 'custom':
      default:
        // OpenAI 兼容协议：DeepSeek / Qwen / GLM / Mistral 等都走这里
        rawProvider = new OpenAIProvider({
          apiKey: config.apiKey,
          baseURL: config.baseURL || 'https://api.openai.com/v1',
          model: config.model,
          temperature,
          maxTokens,
        })
        break
    }

    // 包裹 ResilientProvider: 自动重试 + 熔断器（可配置）
    const rc = this.resilienceConfig
    const provider = new ResilientProvider(rawProvider, {
      maxRetries: rc?.maxRetries ?? 3,
      retryBackoff: rc?.retryBackoffMs ?? 500,
      maxBackoff: rc?.maxBackoffMs ?? 10000,
      circuitThreshold: rc?.circuitThreshold ?? 5,
      circuitRecoverAfter: rc?.circuitRecoverMs ?? 30000,
    })

    this.providers.set(config.id, provider)
    return provider
  }

  /**
   * 测试模型连接是否可用
   */
  async testConnection(config: ModelConfig): Promise<{ success: boolean; message: string }> {
    try {
      const provider = this.createProvider(config)
      const resp = await provider.complete({
        messages: [{ role: 'user', content: '请回复"连接成功"四个字。' }],
      })
      return {
        success: true,
        message: `连接成功: ${resp.content.slice(0, 100)}`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        message: `连接失败: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  /**
   * 清除缓存的 Provider（配置变更后需要重新创建）
   */
  invalidate(modelId: string): void {
    this.providers.delete(modelId)
  }

  /**
   * 清除所有缓存
   */
  invalidateAll(): void {
    this.providers.clear()
  }

  /**
   * 设置韧性配置（清除缓存使新配置生效）
   */
  setResilienceConfig(config: ResilienceConfig): void {
    this.resilienceConfig = config
    this.invalidateAll()
  }

  /**
   * 获取当前韧性配置
   */
  getResilienceConfig(): ResilienceConfig | null {
    return this.resilienceConfig
  }

  /**
   * 获取所有已缓存 Provider 的熔断器运行时状态
   * 直接从 ResilientProvider 实例内部读取，作为唯一真实来源
   */
  getProviderBreakerStates(): Record<string, ProviderBreakerRuntimeState> {
    const result: Record<string, ProviderBreakerRuntimeState> = {}

    for (const [id, provider] of this.providers) {
      if (provider instanceof ResilientProvider) {
        const bs = provider.getBreakerState()
        result[id] = {
          state: bs.state,
          failures: bs.failures,
          lastFailTime: bs.lastFailTime,
        }
      }
    }
    return result
  }

  /**
   * 重置指定 Provider 的熔断器（运行时状态）
   */
  resetProviderBreaker(modelId: string): boolean {
    const provider = this.providers.get(modelId)
    if (provider instanceof ResilientProvider) {
      provider.resetBreaker()
      return true
    }
    return false
  }

  // ===== [SDK 集成] 限流 + 批处理 =====

  /**
   * 设置全局限流配置（RPM = Requests Per Minute）
   * @param rpm 每分钟最大请求数，0 表示不限流
   */
  setRateLimit(rpm: number): void {
    this.rateLimitRPM = rpm
    if (rpm > 0) {
      this.rateLimiter = new RateLimiter(rpm)
    } else {
      this.rateLimiter = null
    }
  }

  /**
   * 获取当前限流器（可能为 null 表示不限流）
   */
  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter
  }

  /**
   * 获取当前限流配置
   */
  getRateLimitRPM(): number {
    return this.rateLimitRPM
  }

  /**
   * 创建批处理器（按 modelId 隔离）
   * 集成 SDK RateLimiter + 并发控制
   * @param modelConfigId 模型配置 ID
   * @param maxConcurrent 最大并发数（默认 5）
   */
  getBatchProcessor(modelConfig: ModelConfig, maxConcurrent: number = 5): BatchProcessor {
    const key = modelConfig.id
    if (!this.batchProcessors.has(key)) {
      const provider = this.createProvider(modelConfig)
      this.batchProcessors.set(key, new BatchProcessor(provider, {
        maxConcurrent,
        rateLimiter: this.rateLimiter ?? undefined,
      }))
    }
    return this.batchProcessors.get(key)!
  }

  /**
   * 批量处理 LLM 请求
   * 使用 SDK BatchProcessor 并发执行，自动限流
   * @param modelConfig 模型配置
   * @param requests 批量请求列表
   * @param maxConcurrent 最大并发数
   */
  async batchProcess(
    modelConfig: ModelConfig,
    requests: BatchRequest[],
    maxConcurrent: number = 5,
  ): Promise<BatchResult[]> {
    const processor = this.getBatchProcessor(modelConfig, maxConcurrent)
    return processor.process(requests)
  }

  /**
   * 清除批处理器缓存
   */
  invalidateBatchProcessors(): void {
    this.batchProcessors.clear()
  }
}
