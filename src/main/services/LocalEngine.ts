/**
 * 本地引擎抽象层 — 为 AgentService 提供统一的本地推理接口
 *
 * 支持 Ollama（OpenAI 兼容 HTTP）和 llama.cpp（node-llama-cpp 绑定）两种引擎。
 * 设计目标：云端 API 失败时自动降级到本地引擎，完全不阻塞用户体验。
 */

import { EventEmitter } from 'events'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  content: string
  model: string
  done: boolean
}

export interface StreamChunk {
  content: string
  done: boolean
}

export interface LocalModelInfo {
  id: string
  name: string
  engine: 'ollama' | 'llamacpp'
  size: number // bytes
  parameters: string // e.g., "7B"
  contextLength: number
  quantization?: string
}

export interface LocalEngineConfig {
  ollamaBaseUrl: string
  ollamaModel: string
  llamacppModelPath: string
  llamacppModelName: string
  contextLength: number
  threads: number
  gpuLayers: number
}

/**
 * 本地引擎抽象类 — 子类实现具体的推理逻辑
 */
export abstract class LocalEngine extends EventEmitter {
  protected _isReady = false
  protected _isLoading = false
  protected _config: LocalEngineConfig | null = null

  abstract readonly engineType: 'ollama' | 'llamacpp'
  abstract readonly displayName: string

  /** 引擎是否可用 */
  get isReady(): boolean {
    return this._isReady
  }

  /** 模型是否正在加载 */
  get isLoading(): boolean {
    return this._isLoading
  }

  /** 初始化引擎 */
  abstract initialize(config?: Partial<LocalEngineConfig>): Promise<void>

  /** 聊天（非流式） */
  abstract chat(messages: ChatMessage[]): Promise<ChatResponse>

  /** 流式聊天 */
  abstract chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void>

  /** 获取可用模型列表 */
  abstract listModels(): Promise<LocalModelInfo[]>

  /** 获取能力信息 */
  getCapabilities(): {
    supportsStreaming: boolean
    supportsToolUse: boolean
    maxContextLength: number
    parameters: string
  } {
    return {
      supportsStreaming: true,
      supportsToolUse: false,
      maxContextLength: this._config?.contextLength ?? 8000,
      parameters: 'unknown',
    }
  }

  /** 健康检查 */
  abstract healthCheck(): Promise<boolean>

  /** 关闭引擎 */
  abstract close(): void

  /** 关闭前清理 */
  protected teardown(): void {
    this._isReady = false
    this._isLoading = false
  }
}

/**
 * Ollama 引擎 — 通过 HTTP 调用本地 Ollama 服务
 */
export class OllamaEngine extends LocalEngine {
  readonly engineType = 'ollama' as const
  readonly displayName = 'Ollama'
  private baseUrl: string = 'http://localhost:11434'

  async initialize(config?: Partial<LocalEngineConfig>): Promise<void> {
    if (config?.ollamaBaseUrl) {
      this.baseUrl = config.ollamaBaseUrl.replace(/\/+$/, '')
    }
    this._config = {
      ollamaBaseUrl: this.baseUrl,
      ollamaModel: config?.ollamaModel ?? 'qwen2.5:7b',
      llamacppModelPath: config?.llamacppModelPath ?? '',
      llamacppModelName: config?.llamacppModelName ?? '',
      contextLength: config?.contextLength ?? 8000,
      threads: config?.threads ?? 4,
      gpuLayers: config?.gpuLayers ?? 0,
    }
    const ok = await this.healthCheck()
    if (ok) {
      this._isReady = true
      this.emit('ready')
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      })
      clearTimeout(timer)
      return res.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<LocalModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`)
      if (!res.ok) return []
      const data = await res.json() as { models?: Array<{ name: string; size: number; details?: { parameter_size?: string; context_length?: number; quantization_level?: string } }> }
      return (data.models ?? []).map((m) => ({
        id: m.name,
        name: m.name,
        engine: 'ollama' as const,
        size: m.size ?? 0,
        parameters: m.details?.parameter_size ?? 'unknown',
        contextLength: m.details?.context_length ?? 8000,
        quantization: m.details?.quantization_level,
      }))
    } catch {
      return []
    }
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this._config!.ollamaModel,
        messages,
        stream: false,
      }),
    })
    const data = await res.json() as { message?: { content: string }; model?: string }
    return {
      content: data.message?.content ?? '',
      model: data.model ?? this._config!.ollamaModel,
      done: true,
    }
  }

  async chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this._config!.ollamaModel,
        messages,
        stream: true,
      }),
      signal,
    })
    if (!res.body) {
      onChunk({ content: '', done: true })
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        for (const line of text.split('\n').filter(Boolean)) {
          try {
            const json = JSON.parse(line)
            onChunk({
              content: json.message?.content ?? '',
              done: json.done ?? false,
            })
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    onChunk({ content: '', done: true })
  }

  close(): void {
    this.teardown()
    this.removeAllListeners()
  }
}

/**
 * Llama.cpp 引擎 — 本地 GGUF 模型加载和推理
 *
 * 使用 node-llama-cpp 进行原生绑定；未安装时该构造函数将抛出，
 * 调用方应捕获并降级到 Ollama。
 */
export class LlamaCppEngine extends LocalEngine {
  readonly engineType = 'llamacpp' as const
  readonly displayName = 'llama.cpp'
  private llamaModule: any = null
  private model: any = null
  private context: any = null

  async initialize(config?: Partial<LocalEngineConfig>): Promise<void> {
    if (!config?.llamacppModelPath) {
      throw new Error('LlamaCppEngine requires llamacppModelPath')
    }
    this._config = {
      ollamaBaseUrl: config.ollamaBaseUrl ?? 'http://localhost:11434',
      ollamaModel: config.ollamaModel ?? '',
      llamacppModelPath: config.llamacppModelPath,
      llamacppModelName: config.llamacppModelName ?? config.llamacppModelPath,
      contextLength: config.contextLength ?? 8000,
      threads: config.threads ?? 4,
      gpuLayers: config.gpuLayers ?? 0,
    }

    // Dynamic import so that missing optional dependency doesn't break startup
    try {
      this.llamaModule = await import('node-llama-cpp')
    } catch {
      throw new Error(
        'node-llama-cpp is not installed. Run: npm i node-llama-cpp'
      )
    }

    const { Llama, LlamaChatSession } = this.llamaModule
    this.model = await Llama.load({
      modelPath: this._config.llamacppModelPath,
      contextSize: this._config.contextLength,
      gpuLayers: this._config.gpuLayers,
    })
    this.context = await LlamaChatSession.create({
      context: await this.model.createContext({ threads: this._config.threads }),
    })
    this._isReady = true
    this.emit('ready')
  }

  async healthCheck(): Promise<boolean> {
    return this._isReady
  }

  async listModels(): Promise<LocalModelInfo[]> {
    if (!this._isReady) return []
    return [
      {
        id: this._config!.llamacppModelPath,
        name: this._config!.llamacppModelName,
        engine: 'llamacpp' as const,
        size: 0,
        parameters: 'unknown',
        contextLength: this._config!.contextLength,
      },
    ]
  }

  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    if (!this._isReady || !this.context) {
      throw new Error('LlamaCppEngine not initialized')
    }
    const systemMsg = messages.find(m => m.role === 'system')
    const userMsgs = messages.filter(m => m.role !== 'system')
    const systemContent = systemMsg?.content ?? ''
    const content = userMsgs.map(m => `${m.role}: ${m.content}`).join('\n')

    const result = await this.context.prompt(content, { systemPrompt: systemContent })
    return { content: result, model: this._config!.llamacppModelName, done: true }
  }

  async chatStream(
    messages: ChatMessage[],
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal
  ): Promise<void> {
    if (!this._isReady || !this.context) {
      throw new Error('LlamaCppEngine not initialized')
    }
    const systemMsg = messages.find(m => m.role === 'system')
    const userMsgs = messages.filter(m => m.role !== 'system')
    const systemContent = systemMsg?.content ?? ''
    const content = userMsgs.map(m => `${m.role}: ${m.content}`).join('\n')

    // node-llama-cpp 不直接支持流式，使用分片回调模拟
    await this.context.prompt(content, {
      systemPrompt: systemContent,
      onChunk: (chunk: string) => onChunk({ content: chunk, done: false }),
    })
    onChunk({ content: '', done: true })
  }

  close(): void {
    this.teardown()
    this.model?.dispose?.()
    this.context?.dispose?.()
    this.removeAllListeners()
  }
}

/**
 * 本地引擎工厂 — 创建和管理引擎实例
 */
export class LocalEngineFactory {
  private engines = new Map<string, LocalEngine>()
  private ollama: OllamaEngine | null = null

  /**
   * 创建引擎实例
   */
  create(type: 'ollama' | 'llamacpp'): LocalEngine {
    const key = type === 'ollama' ? 'ollama' : `llamacpp-${Date.now()}`

    if (type === 'ollama') {
      if (this.ollama) return this.ollama
      this.ollama = new OllamaEngine()
      this.engines.set(key, this.ollama)
      return this.ollama
    }

    const engine = new LlamaCppEngine()
    this.engines.set(key, engine)
    return engine
  }

  /**
   * 获取或创建 Ollama 引擎
   */
  getOllamaEngine(): OllamaEngine {
    if (!this.ollama) {
      this.ollama = new OllamaEngine()
      this.engines.set('ollama', this.ollama)
    }
    return this.ollama
  }

  /**
   * 检查是否有可用的本地引擎
   */
  async hasAvailableEngine(): Promise<boolean> {
    const ollama = this.getOllamaEngine()
    try {
      const ok = await ollama.healthCheck()
      if (ok && !ollama.isReady) {
        await ollama.initialize()
      }
      return ok
    } catch {
      return false
    }
  }

  /**
   * 关闭所有引擎
   */
  disposeAll(): void {
    for (const engine of this.engines.values()) {
      engine.close()
    }
    this.engines.clear()
    this.ollama = null
  }
}
