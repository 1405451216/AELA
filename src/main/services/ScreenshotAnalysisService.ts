// 截图分析报错服务
// 多模态深化: 用户上传错误截图 → 视觉 LLM 分析 → 提取错误信息 → 诊断 + 修复建议
// 应用场景: 浏览器控制台报错 / 终端报错 / IDE 编译错误 / 移动端崩溃

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { randomUUID } from 'crypto'
import type {
  ScreenshotAnalysis,
  ScreenshotAnalysisRequest,
  ErrorCategory,
  ErrorSeverity,
} from '@shared/types'
import type { Provider, Message } from '@agentprimordia/sdk'

/** SDK Message.content 仅支持 string，多模态需要 content 为数组，故扩展类型 */
interface _VisionMessage extends Omit<Message, 'content'> {
  content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: string } }>
}
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

export class ScreenshotAnalysisService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private results: Map<string, ScreenshotAnalysis> = new Map()

  constructor(configStore: ConfigStore, providerManager: ProviderManager) {
    this.configStore = configStore
    this.providerManager = providerManager
  }

  /**
   * 分析错误截图
   */
  async analyze(request: ScreenshotAnalysisRequest): Promise<ScreenshotAnalysis> {
    const { base64Data, mime } = await this.loadImage(request.imagePath)
    const provider = this.getProvider(request.modelConfigId)

    const contextHint = request.context
      ? `\n\n附加上下文: ${request.context}`
      : ''

    const prompt = `你是一个高级错误诊断专家。请分析这张截图中的错误信息，返回 JSON 格式的分析结果。

请识别：
1. 错误类别 — runtime(运行时错误) / compile(编译错误) / network(网络错误) / ui_render(UI渲染错误) / permission(权限错误) / timeout(超时) / memory(内存错误) / unknown
2. 严重程度 — info / warning / error / critical
3. 错误标题 — 一句话概括错误
4. 完整错误文本 — 从截图中提取的完整错误信息
5. 错误来源 — browser_console(浏览器控制台) / terminal(终端) / ide(IDE) / mobile(移动端) / unknown
6. 诊断分析 — 对错误原因的详细分析
7. 可能的原因列表 — 导致此错误的可能原因（2-5条）
8. 修复建议 — 每条包含标题、描述、可选代码片段、置信度(0-1)
9. 关键词 — 用于搜索的相关关键词

请严格按以下 JSON 格式返回（不要 markdown 包裹）：
{
  "category": "runtime",
  "severity": "error",
  "errorTitle": "TypeError: Cannot read properties of undefined",
  "errorText": "完整的错误堆栈信息...",
  "source": "browser_console",
  "diagnosis": "详细诊断分析...",
  "possibleCauses": ["原因1", "原因2", "原因3"],
  "fixSuggestions": [
    {
      "title": "检查变量初始化",
      "description": "在使用变量前确保已正确初始化",
      "codeSnippet": "const data = response?.data || {}",
      "confidence": 0.85
    }
  ],
  "keywords": ["TypeError", "undefined", "null"]
}${contextHint}`

    const content = await this.callVisionModel(provider, prompt, base64Data, mime)
    const parsed = this.parseAnalysis(content, request.modelConfigId)

    this.results.set(parsed.id, parsed)
    return parsed
  }

  getResult(id: string): ScreenshotAnalysis | null {
    return this.results.get(id) || null
  }

  listResults(): ScreenshotAnalysis[] {
    return Array.from(this.results.values()).sort((a, b) =>
      b.analyzedAt.localeCompare(a.analyzedAt)
    )
  }

  // ===== 私有方法 =====

  private async loadImage(imagePath: string): Promise<{ base64Data: string; mime: string }> {
    const ext = extname(imagePath).toLowerCase()
    const mime = IMAGE_MIME[ext]
    if (!mime) {
      throw new Error(`不支持的图片格式: ${ext}。支持: ${Object.keys(IMAGE_MIME).join(', ')}`)
    }
    const data = await readFile(imagePath)
    return { base64Data: data.toString('base64'), mime }
  }

  private getProvider(modelConfigId: string): Provider {
    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) throw new Error(`模型未找到: ${modelConfigId}`)
    return this.providerManager.createProvider(modelConfig)
  }

  private async callVisionModel(
    provider: Provider,
    prompt: string,
    base64Data: string,
    mime: string
  ): Promise<string> {
    // 构造 OpenAI 兼容的多模态消息
    // 注：SDK 当前 Message.content 仅支持 string，多模态场景需要绕过类型
    const visionMsg: _VisionMessage = {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mime};base64,${base64Data}`,
            detail: 'high',
          },
        },
      ],
    }
    const resp = await provider.complete({
      messages: [visionMsg as unknown as Message],
    })
    return resp.content || ''
  }

  private parseAnalysis(content: string, modelConfigId: string): ScreenshotAnalysis {
    // 尝试提取 JSON
    let parsed: any
    try {
      // 去除可能的 markdown 代码块包裹
      const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch (err) {
      // 解析失败，构造一个 fallback 结果
      console.error('[ScreenshotAnalysisService] 解析截图分析结果失败:', err)
      return {
        id: randomUUID(),
        category: 'unknown' as ErrorCategory,
        severity: 'error' as ErrorSeverity,
        errorTitle: '无法解析截图内容',
        errorText: content.slice(0, 500),
        source: 'unknown',
        diagnosis: 'AI 返回的内容无法解析为结构化结果。以下是原始返回:',
        possibleCauses: ['截图清晰度不足', '截图中无明确错误信息', 'AI 模型不支持视觉理解'],
        fixSuggestions: [
          {
            title: '手动检查',
            description: '请手动查看截图中的错误信息，或尝试使用支持视觉的模型（如 GPT-4o）',
            confidence: 0.3,
          },
        ],
        keywords: [],
        analyzedAt: new Date().toISOString(),
        modelConfigId,
      }
    }

    const validCategories: ErrorCategory[] = ['runtime', 'compile', 'network', 'ui_render', 'permission', 'timeout', 'memory', 'unknown']
    const validSeverities: ErrorSeverity[] = ['info', 'warning', 'error', 'critical']
    const validSources = ['browser_console', 'terminal', 'ide', 'mobile', 'unknown']

    return {
      id: randomUUID(),
      category: validCategories.includes(parsed.category) ? parsed.category : 'unknown',
      severity: validSeverities.includes(parsed.severity) ? parsed.severity : 'error',
      errorTitle: String(parsed.errorTitle || '未知错误').slice(0, 200),
      errorText: String(parsed.errorText || '').slice(0, 5000),
      source: validSources.includes(parsed.source) ? parsed.source : 'unknown',
      diagnosis: String(parsed.diagnosis || '').slice(0, 5000),
      possibleCauses: Array.isArray(parsed.possibleCauses)
        ? parsed.possibleCauses.map((c: unknown) => String(c).slice(0, 500)).slice(0, 10)
        : [],
      fixSuggestions: Array.isArray(parsed.fixSuggestions)
        ? parsed.fixSuggestions.map((s: any) => ({
            title: String(s.title || '').slice(0, 200),
            description: String(s.description || '').slice(0, 2000),
            codeSnippet: s.codeSnippet ? String(s.codeSnippet).slice(0, 5000) : undefined,
            confidence: typeof s.confidence === 'number' ? Math.min(1, Math.max(0, s.confidence)) : 0.5,
          })).slice(0, 10)
        : [],
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map((k: unknown) => String(k).slice(0, 50)).slice(0, 20)
        : [],
      analyzedAt: new Date().toISOString(),
      modelConfigId,
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
