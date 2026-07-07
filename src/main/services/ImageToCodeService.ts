// 图片转代码工作流服务
// 解决问题：多模态有/无工作流
// 工作流: 截图分析 → UI 组件识别 → 代码生成 → 迭代优化

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { randomUUID } from 'crypto'
import type {
  ImageAnalysis,
  ImageToCodeResult,
  ImageToCodeRequest,
  GeneratedCodeFile,
  CodeFramework,
} from '@shared/types'
import type { Provider, Message } from '@agentprimordia/sdk'

/** SDK Message.content 仅支持 string，多模态需要 content 为数组，故扩展类型 */
interface _VisionMessage extends Omit<Message, 'content'> {
  content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: string } }>
}
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'

// MIME 类型映射
const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

// 框架信息
const FRAMEWORK_INFO: Record<CodeFramework, { label: string; extension: string; language: string; template: string }> = {
  react: { label: 'React', extension: 'tsx', language: 'typescript', template: 'jsx' },
  vue: { label: 'Vue 3', extension: 'vue', language: 'vue', template: 'vue' },
  html: { label: 'HTML/CSS', extension: 'html', language: 'html', template: 'html' },
  tailwind: { label: 'Tailwind CSS', extension: 'html', language: 'html', template: 'tailwind' },
  svelte: { label: 'Svelte', extension: 'svelte', language: 'svelte', template: 'svelte' },
  angular: { label: 'Angular', extension: 'ts', language: 'typescript', template: 'angular' },
}

export class ImageToCodeService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private results: Map<string, ImageToCodeResult> = new Map()

  constructor(configStore: ConfigStore, providerManager: ProviderManager) {
    this.configStore = configStore
    this.providerManager = providerManager
  }

  listFrameworks(): Array<{ id: CodeFramework; label: string; extension: string }> {
    return Object.entries(FRAMEWORK_INFO).map(([id, info]) => ({
      id: id as CodeFramework,
      label: info.label,
      extension: info.extension,
    }))
  }

  /**
   * Step 1: 分析图片 — 识别 UI 结构、组件、颜色、字体
   */
  async analyze(
    imagePath: string,
    modelConfigId: string
  ): Promise<ImageAnalysis> {
    const { base64Data, mime } = await this.loadImage(imagePath)
    const provider = this.getProvider(modelConfigId)

    const prompt = `你是一个 UI/UX 专家。请分析这张截图，返回 JSON 格式的分析结果。

请识别：
1. 整体描述 — 页面的用途和风格
2. 布局结构 — 使用什么布局（flex/grid/absolute等）
3. 组件清单 — 识别所有 UI 组件（header, nav, card, button, form, table, list, modal 等）
4. 颜色方案 — 提取主要颜色（hex格式）
5. 字体 — 识别字体样式

请严格按以下 JSON 格式返回（不要 markdown 包裹）：
{
  "description": "页面整体描述",
  "layout": "布局描述，如 '顶部导航 + 侧边栏 + 主内容区'",
  "components": [
    { "type": "header", "description": "页面顶部导航栏", "position": "顶部", "props": { "bgColor": "#1a1a2e", "height": "60px" } }
  ],
  "colors": ["#1a1a2e", "#e94560", "#ffffff"],
  "typography": ["标题: 24px bold", "正文: 14px regular"],
  "responsive": true,
  "frameworkHint": "react"
}`

    const content = await this.callVisionModel(provider, prompt, base64Data, mime)
    return this.parseAnalysis(content)
  }

  /**
   * Step 2: 生成代码 — 基于分析结果生成框架特定代码
   */
  async generate(request: ImageToCodeRequest): Promise<ImageToCodeResult> {
    // 先分析图片
    const analysis = await this.analyze(request.imagePath, request.modelConfigId)

    // 生成代码
    const { base64Data, mime } = await this.loadImage(request.imagePath)
    const provider = this.getProvider(request.modelConfigId)
    const _fwInfo = FRAMEWORK_INFO[request.framework]

    const componentName = request.componentName || 'GeneratedComponent'
    const responsive = request.responsive ?? true
    const customPrompt = request.customPrompt || ''

    const prompt = this.buildGenerationPrompt(analysis, request.framework, componentName, responsive, customPrompt)

    // 附带原图让模型参考
    const codeContent = await this.callVisionModel(provider, prompt, base64Data, mime)

    // 解析生成的代码文件
    const files = this.parseGeneratedCode(codeContent, request.framework, componentName)

    const result: ImageToCodeResult = {
      id: randomUUID(),
      analysis,
      files,
      framework: request.framework,
      generatedAt: new Date().toISOString(),
      modelConfigId: request.modelConfigId,
      refinementHistory: [],
    }

    this.results.set(result.id, result)
    return result
  }

  /**
   * Step 3: 迭代优化 — 基于反馈改进代码
   */
  async refine(
    resultId: string,
    feedback: string,
    modelConfigId: string
  ): Promise<ImageToCodeResult> {
    const existing = this.results.get(resultId)
    if (!existing) throw new Error('Result not found')

    const provider = this.getProvider(modelConfigId)

    const currentCode = existing.files.map(f =>
      `## ${f.fileName}\n\`\`\`${f.language}\n${f.content}\n\`\`\``
    ).join('\n\n')

    const prompt = `你是前端专家。请根据反馈优化以下代码。

## 分析
${existing.analysis.description}
布局: ${existing.analysis.layout}
组件: ${existing.analysis.components.map(c => c.type).join(', ')}

## 当前代码
${currentCode}

## 优化反馈
${feedback}

## 要求
1. 保持框架 ${existing.framework} 不变
2. 只输出修改后的完整代码文件
3. 每个文件用以下格式标记：
\`\`\`文件名
代码内容
\`\`\`
4. 只输出代码，不要解释`

    const resp = await provider.complete({
      messages: [
        { role: 'system', content: '你是前端代码专家，擅长根据设计图生成高质量代码。' },
        { role: 'user', content: prompt },
      ],
    })

    const responseText = resp.content

    // 解析优化后的代码
    const newFiles = this.parseCodeBlocks(responseText, existing.framework)

    if (newFiles.length > 0) {
      existing.files = newFiles
    }

    existing.refinementHistory.push({
      iteration: existing.refinementHistory.length + 1,
      feedback,
      changes: newFiles.map(f => f.fileName).join(', '),
    })

    this.results.set(resultId, existing)
    return existing
  }

  getResult(id: string): ImageToCodeResult | null {
    return this.results.get(id) || null
  }

  // ===== 私有方法 =====

  private async loadImage(imagePath: string): Promise<{ base64Data: string; mime: string }> {
    const ext = extname(imagePath).toLowerCase()
    const mime = IMAGE_MIME[ext]
    if (!mime) throw new Error(`不支持的图片格式: ${ext}。支持: ${Object.keys(IMAGE_MIME).join(', ')}`)

    const data = await readFile(imagePath)
    return {
      base64Data: data.toString('base64'),
      mime,
    }
  }

  private getProvider(modelConfigId: string): Provider {
    const modelConfig = this.configStore.getModel(modelConfigId)
    if (!modelConfig) throw new Error(`模型未找到: ${modelConfigId}`)
    return this.providerManager.createProvider(modelConfig)
  }

  /**
   * 调用视觉模型（多模态）
   */
  private async callVisionModel(
    provider: Provider,
    prompt: string,
    base64Data: string,
    mime: string
  ): Promise<string> {
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

    return resp.content
  }

  private buildGenerationPrompt(
    analysis: ImageAnalysis,
    framework: CodeFramework,
    componentName: string,
    responsive: boolean,
    customPrompt: string
  ): string {
    const fwInfo = FRAMEWORK_INFO[framework]
    const componentList = analysis.components.map(c =>
      `- ${c.type}: ${c.description} (${c.position})`
    ).join('\n')

    let frameworkSpecific = ''
    switch (framework) {
      case 'react':
        frameworkSpecific = `生成一个 React 函数组件，使用 TypeScript + CSS Module 或内联样式。
组件名: ${componentName}
文件: ${componentName}.tsx
${responsive ? '使用响应式设计（媒体查询或 Tailwind 响应式类）' : ''}`
        break
      case 'vue':
        frameworkSpecific = `生成一个 Vue 3 SFC 组件（<script setup lang="ts">）。
组件名: ${componentName}
文件: ${componentName}.vue
${responsive ? '使用响应式设计' : ''}`
        break
      case 'html':
        frameworkSpecific = `生成一个完整的 HTML 文件，包含内联 CSS。
${responsive ? '添加 viewport meta 和响应式设计' : ''}`
        break
      case 'tailwind':
        frameworkSpecific = `生成一个 HTML 文件，使用 Tailwind CSS CDN。
${responsive ? '使用 Tailwind 响应式前缀 (sm:/md:/lg:)' : ''}`
        break
      case 'svelte':
        frameworkSpecific = `生成一个 Svelte 组件。
组件名: ${componentName}
文件: ${componentName}.svelte`
        break
      case 'angular':
        frameworkSpecific = `生成一个 Angular 组件（含 template 和 styles）。
组件名: ${componentName}`
        break
    }

    return `你是前端代码专家。根据以下 UI 分析和截图，生成 ${fwInfo.label} 代码。

## UI 分析
描述: ${analysis.description}
布局: ${analysis.layout}
组件:
${componentList}
颜色: ${analysis.colors.join(', ')}
字体: ${analysis.typography.join(', ')}

## 要求
${frameworkSpecific}

${customPrompt ? `## 额外要求\n${customPrompt}` : ''}

## 输出格式
每个文件用以下格式标记：
\`\`\`文件名.扩展名
代码内容
\`\`\`

只输出代码文件，不要解释。`
  }

  /**
   * 解析 LLM 生成的代码块
   */
  private parseGeneratedCode(content: string, framework: CodeFramework, componentName: string): GeneratedCodeFile[] {
    const files = this.parseCodeBlocks(content, framework)
    // 如果没解析到文件，把整个内容作为单个文件
    if (files.length === 0) {
      const fwInfo = FRAMEWORK_INFO[framework]
      files.push({
        fileName: `${componentName}.${fwInfo.extension}`,
        language: fwInfo.language,
        content: this.stripMarkdown(content),
        description: '生成的代码',
      })
    }
    return files
  }

  private parseCodeBlocks(content: string, _framework: CodeFramework): GeneratedCodeFile[] {
    const files: GeneratedCodeFile[] = []
    // 匹配 ```文件名 或 ```language 代码块
    const regex = /```(\w+(?:\.\w+)?)\n([\s\S]*?)```/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(content)) !== null) {
      const identifier = match[1]  // 可能是文件名或语言标识
      const code = match[2].trim()

      // 判断是文件名还是语言
      let fileName: string
      let language: string

      if (identifier.includes('.')) {
        // 是文件名
        fileName = identifier
        language = extname(identifier).slice(1) || 'text'
      } else {
        // 是语言标识
        language = identifier
        const ext = this.languageToExt(identifier)
        fileName = `component.${ext}`
      }

      files.push({
        fileName,
        language,
        content: code,
        description: `Generated ${language} file`,
      })
    }

    return files
  }

  private languageToExt(lang: string): string {
    const map: Record<string, string> = {
      tsx: 'tsx', ts: 'ts', jsx: 'jsx', js: 'js',
      vue: 'vue', html: 'html', css: 'css', svelte: 'svelte',
      python: 'py', json: 'json', markdown: 'md',
    }
    return map[lang] || lang
  }

  private stripMarkdown(text: string): string {
    const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/)
    return match ? match[1].trim() : text.trim()
  }

  private parseAnalysis(content: string): ImageAnalysis {
    try {
      // 提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      const parsed = JSON.parse(jsonMatch[0])

      return {
        description: parsed.description || '无法分析',
        layout: parsed.layout || '未知',
        components: Array.isArray(parsed.components) ? parsed.components : [],
        colors: Array.isArray(parsed.colors) ? parsed.colors : [],
        typography: Array.isArray(parsed.typography) ? parsed.typography : [],
        responsive: parsed.responsive ?? true,
        frameworkHint: parsed.frameworkHint || 'react',
      }
    } catch (err) {
      // JSON 解析失败，返回默认值
      console.error('[ImageToCodeService] 解析设计分析结果失败:', err)
      return {
        description: content.substring(0, 500),
        layout: '未知',
        components: [],
        colors: [],
        typography: [],
        responsive: true,
        frameworkHint: 'react',
      }
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
