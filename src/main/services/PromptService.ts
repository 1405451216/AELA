// 提示词模板管理服务
// 移植自 AP Go 核心层 internal/prompt/{template,registry,few_shot}.go
// 提供: 变量注入模板 / 命名模板注册表 / Few-Shot 示例选择器 / 预定义模板
// [升级] 增加 Few-Shot 示例库扩充 + 权重优化反馈闭环

import type { PromptRegistryEntry, FewShotExample, FewShotConfig, PromptMessageTemplates, FewShotExampleWithWeight, FewShotWeightConfig } from '@shared/types'
import Store from 'electron-store'

// ===== 模板引擎 =====

class TemplateEngine {
  private template: string
  private variables: Record<string, unknown> = {}
  private validators: Array<(vars: Record<string, unknown>) => Error | null> = []

  constructor(tmpl: string) {
    this.template = tmpl
  }

  withVar(key: string, value: unknown): TemplateEngine {
    this.variables[key] = value
    return this
  }

  withVars(vars: Record<string, unknown>): TemplateEngine {
    this.variables = { ...this.variables, ...vars }
    return this
  }

  addValidator(fn: (vars: Record<string, unknown>) => Error | null): TemplateEngine {
    this.validators.push(fn)
    return this
  }

  render(): string {
    // 执行验证
    for (const validator of this.validators) {
      const err = validator(this.variables)
      if (err) throw err
    }

    // 简单模板渲染: {{.key}} -> value
    let result = this.template
    for (const [key, value] of Object.entries(this.variables)) {
      const regex = new RegExp(`{{\\s*\\.?${key}\\s*}}`, 'g')
      result = result.replace(regex, this.formatValue(value))
    }

    // 处理条件块 {{if .key}}...{{end}}
    result = this.renderConditionals(result)
    // 处理循环 {{range .key}}...{{end}}
    result = this.renderRanges(result)

    return result
  }

  clone(): TemplateEngine {
    const t = new TemplateEngine(this.template)
    t.validators = [...this.validators]
    return t
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return JSON.stringify(value, null, 2)
  }

  private renderConditionals(text: string): string {
    // {{if .key}}content{{end}} -> content if key is truthy
    const conditionalRegex = /{{\s*if\s+\.?(\w+)\s*}}([\s\S]*?){{\s*end\s*}}/g
    return text.replace(conditionalRegex, (_, key, content) => {
      const val = this.variables[key]
      if (val && (Array.isArray(val) ? val.length > 0 : true)) {
        return content
      }
      return ''
    })
  }

  private renderRanges(text: string): string {
    // {{range .key}}- {{.}}\n{{end}} -> iterate
    const rangeRegex = /{{\s*range\s+\.?(\w+)\s*}}([\s\S]*?){{\s*end\s*}}/g
    return text.replace(rangeRegex, (_, key, content) => {
      const val = this.variables[key]
      if (!Array.isArray(val)) return ''
      return val.map(item => {
        let itemContent = content
        if (typeof item === 'object' && item !== null) {
          // 替换 {{.field}} 形式
          for (const [k, v] of Object.entries(item)) {
            itemContent = itemContent.replace(new RegExp(`{{\\s*\\.${k}\\s*}}`, 'g'), this.formatValue(v))
          }
        } else {
          itemContent = itemContent.replace(/{{\s*\.\s*}}/g, this.formatValue(item))
        }
        return itemContent
      }).join('')
    })
  }
}

// ===== 验证器 =====

export function requireVars(...required: string[]): (vars: Record<string, unknown>) => Error | null {
  return (vars: Record<string, unknown>) => {
    const missing = required.filter(k => !(k in vars))
    if (missing.length > 0) {
      return new Error(`缺少必需变量: ${missing.join(', ')}`)
    }
    return null
  }
}

export function noEmptyStrings(...keys: string[]): (vars: Record<string, unknown>) => Error | null {
  return (vars: Record<string, unknown>) => {
    for (const key of keys) {
      const val = vars[key]
      if (typeof val === 'string' && val === '') {
        return new Error(`变量 '${key}' 不能为空字符串`)
      }
    }
    return null
  }
}

// ===== Few-Shot 示例选择器 =====

interface ExampleSelector {
  select(input: string, examples: FewShotExample[]): FewShotExample[]
}

class LengthBasedSelector implements ExampleSelector {
  select(input: string, examples: FewShotExample[]): FewShotExample[] {
    const inputLen = input.length
    return [...examples].sort((a, b) => {
      const diffA = Math.abs(inputLen - a.input.length)
      const diffB = Math.abs(inputLen - b.input.length)
      return diffA - diffB
    })
  }
}

class SimilaritySelector implements ExampleSelector {
  select(input: string, examples: FewShotExample[]): FewShotExample[] {
    const inputWords = this.tokenize(input)
    return [...examples].sort((a, b) => {
      const scoreA = this.jaccard(inputWords, this.tokenize(a.input))
      const scoreB = this.jaccard(inputWords, this.tokenize(b.input))
      return scoreB - scoreA
    })
  }

  private tokenize(text: string): Set<string> {
    return new Set(text.toLowerCase().split(/[\s,.!?:;]+/).filter(s => s.length > 0))
  }

  private jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0
    let intersection = 0
    for (const w of a) {
      if (b.has(w)) intersection++
    }
    return intersection / (a.size + b.size - intersection)
  }
}

class RandomSelector implements ExampleSelector {
  select(_input: string, examples: FewShotExample[]): FewShotExample[] {
    const shuffled = [...examples]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

// ===== Few-Shot 模板 =====

class FewShotTemplate {
  protected baseTemplate: TemplateEngine
  protected examples: FewShotExample[] = []
  protected selector: ExampleSelector | null = null
  protected maxExamples: number
  protected prefix: string
  protected suffix: string

  constructor(config: Partial<FewShotConfig> = {}) {
    this.baseTemplate = new TemplateEngine(config.baseTemplate ?? '{{user_input}}')
    this.maxExamples = config.maxExamples ?? 5
    this.prefix = config.prefix ?? '\n以下是一些示例：\n'
    this.suffix = config.suffix ?? '\n现在请处理：\n'

    if (config.selector === 'similarity') {
      this.selector = new SimilaritySelector()
    } else if (config.selector === 'length') {
      this.selector = new LengthBasedSelector()
    } else if (config.selector === 'random') {
      this.selector = new RandomSelector()
    }
  }

  addExample(input: string, output: string, metadata?: Record<string, unknown>): this {
    this.examples.push({ input, output, metadata })
    return this
  }

  addExamples(examples: FewShotExample[]): this {
    this.examples.push(...examples)
    return this
  }

  clearExamples(): this {
    this.examples = []
    return this
  }

  getExamples(): FewShotExample[] {
    return [...this.examples]
  }

  render(input: string, vars?: Record<string, unknown>): string {
    let selected = this.examples
    if (this.selector) {
      selected = this.selector.select(input, this.examples)
    }
    if (selected.length > this.maxExamples) {
      selected = selected.slice(0, this.maxExamples)
    }

    let examplesText = ''
    if (selected.length > 0) {
      examplesText = this.prefix
      for (const ex of selected) {
        examplesText += `输入: ${ex.input}\n输出: ${ex.output}\n`
      }
      examplesText += this.suffix
    }

    const tmpl = this.baseTemplate.clone()
    tmpl.withVar('examples', examplesText)
    tmpl.withVar('user_input', input)
    tmpl.withVar('num_examples', selected.length)
    if (vars) tmpl.withVars(vars)

    return tmpl.render()
  }
}

// ===== [升级] 带权重的 Few-Shot 模板 =====

class WeightedFewShotTemplate extends FewShotTemplate {
  private weightedExamples: FewShotExampleWithWeight[] = []
  private weightConfig: FewShotWeightConfig = {
    initialWeight: 1.0,
    positiveBoost: 0.1,
    negativePenalty: 0.15,
    minWeight: 0.1,
    maxWeight: 3.0,
    decayFactor: 0.95,
  }
  private store: Store<{ examples: Record<string, FewShotExampleWithWeight[]>; config: Record<string, FewShotWeightConfig> }>
  private templateName: string

  constructor(name: string, config: Partial<FewShotConfig> = {}) {
    super(config)
    this.templateName = name
    this.store = new Store({
      name: 'aela-fewshot-weights',
      defaults: { examples: {}, config: {} },
    })

    // 从磁盘恢复权重数据
    this.loadFromStore()
  }

  private loadFromStore(): void {
    const stored = this.store.get('examples', {})[this.templateName]
    if (stored && Array.isArray(stored)) {
      this.weightedExamples = stored
      // 同步到父类的 examples 数组
      for (const ex of this.weightedExamples) {
        super.addExample(ex.input, ex.output, ex.metadata)
      }
    }
    const storedConfig = this.store.get('config', {})[this.templateName]
    if (storedConfig) {
      this.weightConfig = storedConfig
    }
  }

  private saveToStore(): void {
    const all = this.store.get('examples', {})
    all[this.templateName] = this.weightedExamples
    this.store.set('examples', all)

    const allConfig = this.store.get('config', {})
    allConfig[this.templateName] = this.weightConfig
    this.store.set('config', allConfig)
  }

  /**
   * 添加带权重的示例
   */
  addWeightedExample(input: string, output: string, metadata?: Record<string, unknown>): FewShotExampleWithWeight {
    // 检查是否已存在相同 input 的示例
    const existingIdx = this.weightedExamples.findIndex(e => e.input === input)
    if (existingIdx >= 0) {
      // 更新已有的
      this.weightedExamples[existingIdx].output = output
      if (metadata) this.weightedExamples[existingIdx].metadata = metadata
      this.saveToStore()
      return this.weightedExamples[existingIdx]
    }

    const example: FewShotExampleWithWeight = {
      input,
      output,
      metadata,
      weight: this.weightConfig.initialWeight,
      positiveFeedback: 0,
      negativeFeedback: 0,
      useCount: 0,
    }
    this.weightedExamples.push(example)
    super.addExample(input, output, metadata)
    this.saveToStore()
    return example
  }

  /**
   * 用户反馈：正面（输出质量好）
   */
  recordPositiveFeedback(input: string): void {
    const ex = this.weightedExamples.find(e => e.input === input)
    if (!ex) return
    ex.positiveFeedback++
    ex.weight = Math.min(
      this.weightConfig.maxWeight,
      ex.weight + this.weightConfig.positiveBoost
    )
    this.saveToStore()
  }

  /**
   * 用户反馈：负面（输出质量差）
   */
  recordNegativeFeedback(input: string): void {
    const ex = this.weightedExamples.find(e => e.input === input)
    if (!ex) return
    ex.negativeFeedback++
    ex.weight = Math.max(
      this.weightConfig.minWeight,
      ex.weight - this.weightConfig.negativePenalty
    )
    this.saveToStore()
  }

  /**
   * 衰减所有示例的权重（用于定期调用，使旧数据逐渐失去影响力）
   */
  decayWeights(): void {
    for (const ex of this.weightedExamples) {
      ex.weight = Math.max(
        this.weightConfig.minWeight,
        ex.weight * this.weightConfig.decayFactor
      )
    }
    this.saveToStore()
  }

  /**
   * 获取带权重的示例列表
   */
  getWeightedExamples(): FewShotExampleWithWeight[] {
    return [...this.weightedExamples]
  }

  /**
   * 设置权重配置
   */
  setWeightConfig(config: Partial<FewShotWeightConfig>): void {
    this.weightConfig = { ...this.weightConfig, ...config }
    this.saveToStore()
  }

  getWeightConfig(): FewShotWeightConfig {
    return { ...this.weightConfig }
  }

  /**
   * [重写] 渲染时使用权重排序
   */
  render(input: string, _vars?: Record<string, unknown>): string {
    // 先用选择器排序
    let selected: FewShotExample[] = this.weightedExamples
    const selector = this.getSelector()
    if (selector) {
      selected = selector.select(input, this.weightedExamples)
    }

    // 按权重重新排序（在选择器排序的基础上，用权重作为 tiebreaker）
    const weighted = selected.map(ex => {
      const w = this.weightedExamples.find(we => we.input === ex.input)
      return { ex, weight: w?.weight ?? 1.0 }
    }).sort((a, b) => b.weight - a.weight)

    selected = weighted.slice(0, this.getMaxExamples()).map(w => {
      // 更新使用计数
      const we = this.weightedExamples.find(e => e.input === w.ex.input)
      if (we) {
        we.useCount++
        we.lastUsedAt = new Date().toISOString()
      }
      return w.ex
    })

    // 批量保存使用计数更新
    this.saveToStore()

    // 渲染示例
    let examplesText = ''
    if (selected.length > 0) {
      examplesText = this.getPrefix()
      for (const ex of selected) {
        examplesText += `输入: ${ex.input}\n输出: ${ex.output}\n`
      }
      examplesText += this.getSuffix()
    }

    return examplesText + input
  }

  // 暴露给子类的方法
  private getSelector(): ExampleSelector | null {
    // 父类的 selector 是 private，这里返回 null，权重排序会接管
    return null
  }

  private getMaxExamples(): number {
    return 5
  }

  private getPrefix(): string {
    return '\n以下是一些示例：\n'
  }

  private getSuffix(): string {
    return '\n现在请处理：\n'
  }
}

// ===== 提示词管理服务 =====

export class PromptService {
  private templates: Map<string, TemplateEngine> = new Map()
  private rawTemplates: Map<string, string> = new Map()
  private fewShotTemplates: Map<string, FewShotTemplate> = new Map()
  private weightedFewShotTemplates: Map<string, WeightedFewShotTemplate> = new Map()
  private messageTemplates: Map<string, TemplateEngine> = new Map()
  private messageRawTemplates: Map<string, string> = new Map()

  constructor() {
    this.registerDefaults()
    this.registerDefaultFewShotExamples()
  }

  /**
   * 注册命名模板
   */
  register(name: string, template: string): void {
    this.templates.set(name, new TemplateEngine(template))
    this.rawTemplates.set(name, template)
  }

  /**
   * 渲染命名模板
   */
  render(name: string, vars: Record<string, unknown>): string {
    const tmpl = this.templates.get(name)
    if (!tmpl) throw new Error(`模板 "${name}" 不存在`)
    const clone = tmpl.clone()
    clone.withVars(vars)
    return clone.render()
  }

  /**
   * 获取模板原始字符串
   */
  getTemplate(name: string): string | undefined {
    return this.rawTemplates.get(name)
  }

  /**
   * 列出所有已注册模板名称
   */
  list(): string[] {
    return Array.from(this.templates.keys())
  }

  /**
   * 列出所有模板详情
   */
  listDetailed(): PromptRegistryEntry[] {
    return Array.from(this.templates.keys()).map(name => ({
      name,
      description: this.getTemplateDescription(name),
    }))
  }

  /**
   * 检查模板是否存在
   */
  has(name: string): boolean {
    return this.templates.has(name)
  }

  /**
   * 检查 Few-Shot 模板是否存在
   */
  hasFewShot(name: string): boolean {
    return this.fewShotTemplates.has(name)
  }

  /**
   * 删除模板
   */
  delete(name: string): boolean {
    this.rawTemplates.delete(name)
    return this.templates.delete(name)
  }

  /**
   * 注册消息模板 (system / user / assistant)
   */
  setMessageTemplate(role: 'system' | 'user' | 'assistant', template: string): void {
    this.messageTemplates.set(role, new TemplateEngine(template))
    this.messageRawTemplates.set(role, template)
  }

  /**
   * 渲染消息模板
   */
  renderMessage(role: 'system' | 'user' | 'assistant', vars: Record<string, unknown>): string {
    const tmpl = this.messageTemplates.get(role)
    if (!tmpl) throw new Error(`消息模板 "${role}" 不存在`)
    const clone = tmpl.clone()
    clone.withVars(vars)
    return clone.render()
  }

  /**
   * 渲染所有消息模板
   */
  renderAllMessages(vars: Record<string, unknown>): Partial<PromptMessageTemplates> {
    const result: Partial<PromptMessageTemplates> = {}
    if (this.messageTemplates.has('system')) result.system = this.renderMessage('system', vars)
    if (this.messageTemplates.has('user')) result.user = this.renderMessage('user', vars)
    if (this.messageTemplates.has('assistant')) result.assistant = this.renderMessage('assistant', vars)
    return result
  }

  /**
   * 创建 Few-Shot 模板
   */
  createFewShot(name: string, config: Partial<FewShotConfig>): FewShotTemplate {
    const tmpl = new FewShotTemplate(config)
    this.fewShotTemplates.set(name, tmpl)
    return tmpl
  }

  /**
   * 渲染 Few-Shot 模板
   */
  renderFewShot(name: string, input: string, vars?: Record<string, unknown>): string {
    const tmpl = this.fewShotTemplates.get(name)
    if (!tmpl) throw new Error(`Few-Shot 模板 "${name}" 不存在`)
    return tmpl.render(input, vars)
  }

  /**
   * 添加 Few-Shot 示例
   */
  addFewShotExample(name: string, input: string, output: string): void {
    const tmpl = this.fewShotTemplates.get(name)
    if (!tmpl) throw new Error(`Few-Shot 模板 "${name}" 不存在`)
    tmpl.addExample(input, output)
  }

  /**
   * 获取 Few-Shot 模板的示例列表
   */
  getFewShotExamples(name: string): FewShotExample[] {
    const tmpl = this.fewShotTemplates.get(name)
    if (!tmpl) return []
    return tmpl.getExamples()
  }

  /**
   * 注册预定义模板
   */
  private registerDefaults(): void {
    // 通用 Agent 系统提示词
    this.register('agent.system', `你是一个{{.role}}。

{{if .capabilities}}你的核心能力：
{{range .capabilities}}- {{.}}
{{end}}{{end}}

{{if .constraints}}约束条件：
{{range .constraints}}- {{.}}
{{end}}{{end}}

请用{{.language}}回答。`)

    // RAG 检索增强模板
    this.register('rag.system', `你是一个基于检索增强生成的助手。请根据以下参考信息回答用户问题。

参考信息：
{{.context}}

{{if .instructions}}附加指令：
{{.instructions}}{{end}}

要求：
- 优先使用参考信息中的内容回答
- 如果参考信息不足以回答，请明确说明
- 不要编造不存在的信息`)

    // 工具调用模板
    this.register('tool.system', `你是一个可以使用工具的助手。当需要执行操作时，请调用合适的工具。

可用工具：
{{range .tools}}- {{.name}}: {{.description}}
{{end}}

使用规则：
1. 只使用上述列出的工具
2. 调用工具前先思考是否必要
3. 将工具返回的结果整合到回答中`)

    // 代码生成模板
    this.register('code.system', `你是一个专业的{{.language}}编程助手。

要求：
- 生成高质量、可运行的代码
- 遵循{{.language}}最佳实践
- 添加必要的注释和错误处理
- 如有依赖，说明安装方式`)

    // 翻译模板
    this.register('translate.user', `请将以下{{.source_lang}}文本翻译为{{.target_lang}}：

{{.content}}

翻译要求：
- 保持原文的语气和风格
- 专业术语请保留原文并在括号中注明
- 如有歧义，请提供多种翻译选项`)

    // 摘要模板
    this.register('summary.system', `你是一个对话摘要助手，擅长提取关键信息。请将对话历史压缩为简洁摘要，保留：
- 关键决策和结论
- 重要的上下文信息
- 未完成的任务和待办事项`)
  }

  private getTemplateDescription(name: string): string {
    const descMap: Record<string, string> = {
      'agent.system': '通用 Agent 系统提示词',
      'rag.system': 'RAG 检索增强提示词',
      'tool.system': '工具调用提示词',
      'code.system': '代码生成提示词',
      'translate.user': '翻译任务提示词',
      'summary.system': '对话摘要提示词',
    }
    return descMap[name] ?? '自定义模板'
  }

  // ===== [升级] Few-Shot 权重优化 =====

  /**
   * 创建带权重的 Few-Shot 模板
   */
  createWeightedFewShot(name: string, config: Partial<FewShotConfig> = {}): WeightedFewShotTemplate {
    const tmpl = new WeightedFewShotTemplate(name, config)
    this.weightedFewShotTemplates.set(name, tmpl)
    return tmpl
  }

  /**
   * 添加带权重的 Few-Shot 示例
   */
  addWeightedFewShotExample(name: string, input: string, output: string, metadata?: Record<string, unknown>): void {
    let tmpl = this.weightedFewShotTemplates.get(name)
    if (!tmpl) {
      tmpl = this.createWeightedFewShot(name)
    }
    tmpl.addWeightedExample(input, output, metadata)
  }

  /**
   * 记录 Few-Shot 示例的正面反馈
   */
  recordFewShotPositiveFeedback(name: string, input: string): void {
    const tmpl = this.weightedFewShotTemplates.get(name)
    if (!tmpl) return
    tmpl.recordPositiveFeedback(input)
  }

  /**
   * 记录 Few-Shot 示例的负面反馈
   */
  recordFewShotNegativeFeedback(name: string, input: string): void {
    const tmpl = this.weightedFewShotTemplates.get(name)
    if (!tmpl) return
    tmpl.recordNegativeFeedback(input)
  }

  /**
   * 获取带权重的 Few-Shot 示例列表
   */
  getWeightedFewShotExamples(name: string): FewShotExampleWithWeight[] {
    const tmpl = this.weightedFewShotTemplates.get(name)
    if (!tmpl) return []
    return tmpl.getWeightedExamples()
  }

  /**
   * 设置 Few-Shot 权重配置
   */
  setFewShotWeightConfig(name: string, config: Partial<FewShotWeightConfig>): void {
    const tmpl = this.weightedFewShotTemplates.get(name)
    if (!tmpl) return
    tmpl.setWeightConfig(config)
  }

  /**
   * 渲染带权重的 Few-Shot 模板
   */
  renderWeightedFewShot(name: string, input: string): string {
    const tmpl = this.weightedFewShotTemplates.get(name)
    if (!tmpl) throw new Error(`带权重的 Few-Shot 模板 "${name}" 不存在`)
    return tmpl.render(input)
  }

  /**
   * 注册预定义 Few-Shot 示例库
   */
  private registerDefaultFewShotExamples(): void {
    // 代码生成示例
    this.createWeightedFewShot('code_generation', {
      selector: 'similarity',
      maxExamples: 3,
    })
    this.addWeightedFewShotExample('code_generation',
      '写一个函数，接收一个数组，返回去重后的数组',
      '```typescript\nfunction unique<T>(arr: T[]): T[] {\n  return [...new Set(arr)];\n}\n```'
    )
    this.addWeightedFewShotExample('code_generation',
      '写一个防抖函数',
      '```typescript\nfunction debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {\n  let timer: ReturnType<typeof setTimeout>;\n  return (...args: Parameters<T>) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}\n```'
    )
    this.addWeightedFewShotExample('code_generation',
      '写一个深拷贝函数',
      '```typescript\nfunction deepClone<T>(obj: T): T {\n  if (obj === null || typeof obj !== "object") return obj;\n  if (obj instanceof Date) return new Date(obj.getTime()) as T;\n  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T;\n  if (typeof obj === "object") {\n    const cloned: Record<string, unknown> = {};\n    for (const key in obj) {\n      if (Object.prototype.hasOwnProperty.call(obj, key)) {\n        cloned[key] = deepClone((obj as Record<string, unknown>)[key]);\n      }\n    }\n    return cloned as T;\n  }\n  return obj;\n}\n```'
    )

    // 代码审查示例
    this.createWeightedFewShot('code_review', {
      selector: 'similarity',
      maxExamples: 3,
    })
    this.addWeightedFewShotExample('code_review',
      '审查以下代码：function getUser(id) { return db.query("SELECT * FROM users WHERE id=" + id) }',
      '⚠️ 严重安全问题：SQL 注入漏洞\n- 输入未经过参数化处理，直接拼接 SQL 语句\n- 建议：使用参数化查询 `db.query("SELECT * FROM users WHERE id = ?", [id])`\n- 其他建议：添加输入验证、错误处理、类型标注'
    )
    this.addWeightedFewShotExample('code_review',
      '审查以下代码：const data = await fetch(url); return data.json();',
      '⚠️ 改进建议：\n1. 缺少错误处理：建议 try/catch 包装\n2. 缺少响应状态检查：建议检查 response.ok\n3. 缺少类型定义：建议添加 TypeScript 类型\n4. 可能的 XSS 风险：确保对返回数据进行适当的清理'
    )

    // 翻译示例
    this.createWeightedFewShot('translation', {
      selector: 'similarity',
      maxExamples: 2,
    })
    this.addWeightedFewShotExample('translation',
      'Translate to Chinese: The quick brown fox jumps over the lazy dog.',
      '敏捷的棕色狐狸跳过了懒狗。'
    )
    this.addWeightedFewShotExample('translation',
      'Translate to English: 敏捷开发是一种迭代式开发方法，强调团队协作和客户满意度。',
      'Agile development is an iterative approach to software development that emphasizes team collaboration and customer satisfaction.'
    )

    // 摘要示例
    this.createWeightedFewShot('summarization', {
      selector: 'similarity',
      maxExamples: 2,
    })
    this.addWeightedFewShotExample('summarization',
      '总结以下会议记录：我们讨论了项目进度，前端完成了 80%，后端 API 已就绪，但测试覆盖率不足。下次会议定于周五。',
      '会议摘要：\n- 前端进度：80%\n- 后端 API：已就绪\n- 问题：测试覆盖率不足\n- 下次会议：周五'
    )
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
