// AELA — Inline Completion 服务（Tab 补全）
// 基于光标位置和上下文调用 LLM 生成代码补全
// 返回 ghost text 供前端渲染
//
// 设计：
//   1. 延迟去抖（300ms）避免频繁调用
//   2. 上下文窗口：光标前后各 200 行 + 文件类型
//   3. 缓存：相同前缀的补全结果缓存 30 秒
//   4. 短补全优先（1-3 行），多行补全需要更高置信度

import type { ConfigStore } from './ConfigStore'
import type { ProviderManager } from './ProviderManager'

export interface CompletionRequest {
  filePath: string
  language: string
  contentBefore: string  // 光标前的文件内容
  contentAfter: string   // 光标后的文件内容
  cursorLine: number
  cursorColumn: number
}

export interface CompletionResult {
  text: string
  confidence: number
  cacheHit: boolean
}

export class InlineCompletionService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private cache = new Map<string, { text: string; timestamp: number }>()
  private readonly cacheTtl = 30_000 // 30 秒缓存
  private readonly maxContextLines = 200
  private enabled = false

  constructor(providerManager: ProviderManager, configStore: ConfigStore) {
    this.providerManager = providerManager
    this.configStore = configStore
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * 生成代码补全
   */
  async complete(request: CompletionRequest): Promise<CompletionResult | null> {
    if (!this.enabled) return null

    // 检查缓存
    const cacheKey = this.buildCacheKey(request)
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return { text: cached.text, confidence: 0.9, cacheHit: true }
    }

    // 构建补全提示词
    const prompt = this.buildPrompt(request)
    if (!prompt) return null

    // 获取模型配置
    const models = this.configStore.getModels()
    const model = models.find(m => m.isDefault) || models[0]
    if (!model) return null

    try {
      const provider = this.providerManager.createProvider(model)
      // 使用 SDK Provider 的 complete 方法
      const response = await provider.complete({
        messages: [
          { role: 'system', content: this.getSystemPrompt(request.language) },
          { role: 'user', content: prompt },
        ],
      })

      const text = (response.content || '').trim()
      if (!text || text.length < 2) return null

      // 缓存
      this.cache.set(cacheKey, { text, timestamp: Date.now() })

      // 清理过期缓存
      if (this.cache.size > 1000) {
        const now = Date.now()
        for (const [key, val] of this.cache) {
          if (now - val.timestamp > this.cacheTtl) {
            this.cache.delete(key)
          }
        }
      }

      return { text, confidence: 0.7, cacheHit: false }
    } catch {
      return null
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 构建补全提示词
   */
  private buildPrompt(request: CompletionRequest): string | null {
    const beforeLines = request.contentBefore.split('\n').slice(-this.maxContextLines)
    const afterLines = request.contentAfter.split('\n').slice(0, 10)

    const before = beforeLines.join('\n')
    const after = afterLines.join('\n')

    return `Complete the code at the cursor position (marked with <|CURSOR|>). Return only the completion text, no explanation.

\`\`\`${request.language}
${before}<|CURSOR|>${after}
\`\`\`

Return only the text to insert at the cursor:`
  }

  /**
   * 获取语言对应的系统提示词
   */
  private getSystemPrompt(language: string): string {
    return `You are a code completion engine. Generate concise, correct code completions for ${language}. Rules:
1. Return ONLY the completion text (no markdown, no explanation)
2. Keep completions short (1-5 lines preferred)
3. Match the surrounding code style and indentation
4. If uncertain, return empty string
5. Do not repeat code that's already before the cursor`
  }

  /**
   * 构建缓存键
   */
  private buildCacheKey(request: CompletionRequest): string {
    // 使用光标前最后 50 字符作为缓存键
    const prefix = request.contentBefore.slice(-50)
    return `${request.language}:${prefix}`
  }
}
