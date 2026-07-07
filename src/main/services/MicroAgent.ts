import { readFile } from 'node:fs/promises'
import type { ProviderManager } from './ProviderManager'
import type { ToolManager } from './ToolManager'

export interface MicroAgentResult {
  filePath: string
  originalContent: string
  fixedContent: string
  description: string
}

interface LLMFixResponse {
  filePath?: string
  fixedContent?: string
  description?: string
  noFixNeeded?: boolean
}

export class MicroAgent {
  private timeoutMs = 5000
  private maxTokens = 2000

  constructor(
    private providerManager: ProviderManager,
    private toolManager: ToolManager,
  ) {}

  async run(filePath: string, diagnostics: string): Promise<MicroAgentResult | null> {
    let originalContent: string
    try {
      originalContent = await readFile(filePath, 'utf-8')
    } catch {
      return null
    }

    const prompt = this.buildPrompt(originalContent, diagnostics)

    const provider = this.providerManager.createProvider({
      id: 'micro-agent',
      name: 'Micro Agent',
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: '',
      baseURL: 'https://api.openai.com/v1',
      createdAt: new Date().toISOString(),
    })

    const response: string = await Promise.race([
      provider.complete({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: this.maxTokens,
        temperature: 0.1,
      }).then((r) => r.content),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`MicroAgent timeout after ${this.timeoutMs}ms`)), this.timeoutMs),
      ),
    ])

    return this.parseResponse(response, filePath, originalContent)
  }

  private buildPrompt(content: string, diagnostics: string): string {
    return `你是一个代码修复 Agent。根据以下诊断信息，修复文件内容中的问题。
只修改问题所在位置，保持其余代码不变。
输入格式：JSON {"filePath": "...", "description": "..."}
如果无需修复，返回：{"noFixNeeded": true}

诊断信息：${diagnostics}
文件内容：
${content}

请直接返回修复后的完整文件内容或 noFixNeeded 标记，格式为 JSON：{"filePath": "...", "fixedContent": "...", "description": "..."} 或 {"noFixNeeded": true}`
  }

  private parseResponse(response: string, filePath: string, originalContent: string): MicroAgentResult | null {
    let parsed: LLMFixResponse
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      parsed = JSON.parse(jsonMatch[0]) as LLMFixResponse
    } catch {
      return null
    }

    if (parsed.noFixNeeded) return null

    if (!parsed.fixedContent || parsed.fixedContent === originalContent) return null

    return {
      filePath: parsed.filePath ?? filePath,
      originalContent,
      fixedContent: parsed.fixedContent,
      description: parsed.description ?? '自动修复',
    }
  }
}
