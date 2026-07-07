export interface ModelConfig {
  id: string
  name: string
  provider: string
  apiKey: string
  baseURL: string
  model: string
  temperature?: number
  maxTokens?: number
  /** 用户可覆盖的上下文窗口大小（字符数），未设置时按模型名称自动推断 */
  contextSize?: number
  isDefault?: boolean
  createdAt: string
}

export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16000,
  'claude-3-5-sonnet': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-opus': 200000,
  'claude-3-haiku': 200000,
  'claude-haiku': 200000,
  'claude-3-sonnet': 200000,
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
  'gemini-pro': 32000,
  'deepseek-chat': 64000,
  'deepseek-reasoner': 64000,
  'deepseek-coder': 64000,
  'qwen-72b': 32000,
  'qwen-14b': 32000,
  'llama-3': 8000,
  'mistral': 32000,
}

export function getModelContextWindow(model: string): number {
  const lower = model.toLowerCase()
  if (MODEL_CONTEXT_WINDOWS[lower]) return MODEL_CONTEXT_WINDOWS[lower]
  for (const [key, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (lower.includes(key)) return size
  }
  return 8000
}
