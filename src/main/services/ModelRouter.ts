// 模型智能路由服务
// [重构] 使用 SDK 原生 ComplexityEvaluator 改善复杂度评分
// 保持 AELA 公共 API 不变（基于 ModelConfig 的配置化路由）
// SDK 优势: ComplexityEvaluator 提供代码块检测、推理关键词、多步骤识别等启发式评估

import { ComplexityEvaluator } from '@agentprimordia/sdk'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import type { ModelRouteConfig, RouteRule, RouteSuggestion, ModelConfig } from '@shared/types'

// 模型成本估算（每 1M tokens 的美元价格）
interface ModelCostInfo {
  inputPer1M: number
  outputPer1M: number
  latencyMs: number   // 首 token 延迟估算
  qualityScore: number // 0-100 质量评分
  contextWindow: number
}

const KNOWN_MODEL_COSTS: Record<string, ModelCostInfo> = {
  'gpt-4o':           { inputPer1M: 2.5,  outputPer1M: 10,  latencyMs: 800,  qualityScore: 90, contextWindow: 128000 },
  'gpt-4o-mini':      { inputPer1M: 0.15, outputPer1M: 0.6, latencyMs: 400,  qualityScore: 75, contextWindow: 128000 },
  'gpt-4-turbo':      { inputPer1M: 10,   outputPer1M: 30,  latencyMs: 1200, qualityScore: 88, contextWindow: 128000 },
  'gpt-3.5-turbo':    { inputPer1M: 0.5,  outputPer1M: 1.5, latencyMs: 300,  qualityScore: 70, contextWindow: 16000 },
  'claude-3-5-sonnet':{ inputPer1M: 3,    outputPer1M: 15,  latencyMs: 600,  qualityScore: 92, contextWindow: 200000 },
  'claude-3-opus':    { inputPer1M: 15,   outputPer1M: 75,  latencyMs: 1500, qualityScore: 95, contextWindow: 200000 },
  'claude-3-haiku':   { inputPer1M: 0.25, outputPer1M: 1.25,latencyMs: 250,  qualityScore: 72, contextWindow: 200000 },
  'claude-3-sonnet':  { inputPer1M: 3,    outputPer1M: 15,  latencyMs: 600,  qualityScore: 85, contextWindow: 200000 },
  'gemini-1.5-pro':   { inputPer1M: 1.25, outputPer1M: 5,   latencyMs: 700,  qualityScore: 88, contextWindow: 1000000 },
  'gemini-1.5-flash': { inputPer1M: 0.075,outputPer1M: 0.3, latencyMs: 200,  qualityScore: 70, contextWindow: 1000000 },
  'deepseek-chat':    { inputPer1M: 0.14, outputPer1M: 0.28,latencyMs: 500,  qualityScore: 80, contextWindow: 64000 },
  'deepseek-reasoner':{ inputPer1M: 0.55, outputPer1M: 2.19,latencyMs: 2000, qualityScore: 90, contextWindow: 64000 },
}

export class ModelRouter {
  private configPath: string
  private config: ModelRouteConfig
  private models: Map<string, ModelConfig> = new Map()
  private complexityEvaluator = new ComplexityEvaluator()

  constructor() {
    const userDataPath = app.getPath('userData')
    this.configPath = join(userDataPath, 'model-route-config.json')
    this.config = this.getDefaultConfig()
    this.loadConfig()
  }

  /**
   * 更新可用模型列表
   */
  updateModels(modelList: ModelConfig[]): void {
    this.models.clear()
    for (const m of modelList) {
      this.models.set(m.id, m)
    }
    // 如果默认模型不在列表中，取第一个
    if (!this.config.defaultModelConfigId && modelList.length > 0) {
      this.config.defaultModelConfigId = modelList[0].id
    }
  }

  /**
   * 根据任务类型和输入内容推荐模型
   */
  suggest(taskType: string, input: string): RouteSuggestion {
    // 1. 查找匹配的规则
    const matchedRule = this.findMatchingRule(taskType)
    if (matchedRule) {
      const model = this.models.get(matchedRule.modelConfigId)
      if (model) {
        return {
          modelConfigId: model.id,
          modelName: model.name,
          reason: `规则匹配: ${matchedRule.taskType} (策略: ${matchedRule.strategy})`,
          strategy: matchedRule.strategy,
          estimatedCost: this.estimateCost(model, input),
        }
      }
    }

    // 2. 使用 SDK ComplexityEvaluator 评估复杂度
    const messages = [{ role: 'user' as const, content: input }]
    const complexity = this.complexityEvaluator.evaluate(messages)
    const inputLength = input.length
    const estimatedTokens = Math.ceil(inputLength / 4) // 粗略估算

    const candidates = Array.from(this.models.values())
    if (candidates.length === 0) {
      return {
        modelConfigId: this.config.defaultModelConfigId,
        modelName: '默认模型',
        reason: '无可用模型，使用默认',
        strategy: this.config.strategy,
        estimatedCost: 0,
      }
    }

    // 为每个候选模型评分（结合 SDK 复杂度评估）
    const scored = candidates.map(model => {
      const costInfo = this.getCostInfo(model)
      const cost = this.estimateCost(model, input)
      let score = 0

      switch (this.config.strategy) {
        case 'cost':
          // 成本优先：成本越低分越高
          score = 100 - (cost * 1000) // 放大成本差异
          break
        case 'latency':
          // 延迟优先
          score = 100 - (costInfo.latencyMs / 20)
          break
        case 'quality':
          // 质量优先：复杂度越高越需要高质量模型
          score = costInfo.qualityScore * (0.5 + complexity * 0.5)
          // 大上下文需求加分
          if (estimatedTokens > 16000 && costInfo.contextWindow > 100000) score += 10
          break
        case 'balanced':
        default:
          // 均衡：综合评分（SDK 复杂度作为权重因子）
          score = (costInfo.qualityScore * (0.3 + complexity * 0.3)) + (100 - cost * 100) * 0.2 + (100 - costInfo.latencyMs / 20) * 0.2
          // 上下文窗口不够直接淘汰
          if (estimatedTokens > costInfo.contextWindow / 4) score -= 50
          break
      }

      // 任务类型加分
      score += this.getTaskTypeBonus(model, taskType)

      // 高复杂度任务惩罚低质量模型
      if (complexity > 0.6 && costInfo.qualityScore < 75) score -= 20

      return { model, score, cost, costInfo, complexity }
    })

    // 选最高分
    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    const reasonMap: Record<string, string> = {
      'code': '代码任务需要强推理能力',
      'chat': '对话任务适合快速响应模型',
      'analysis': '分析任务需要大上下文窗口',
      'translation': '翻译任务适合多语言模型',
      'summarization': '摘要任务适合中等能力模型',
    }

    const complexityLabel = complexity > 0.7 ? '高复杂度' : complexity > 0.4 ? '中复杂度' : '低复杂度'

    return {
      modelConfigId: best.model.id,
      modelName: best.model.name,
      reason: best.costInfo ? `${reasonMap[taskType] || '智能匹配'} · ${this.config.strategy} 策略 · ${complexityLabel}` : '默认选择',
      strategy: this.config.strategy,
      estimatedCost: best.cost,
    }
  }

  getConfig(): ModelRouteConfig {
    return { ...this.config }
  }

  async setConfig(partial: Partial<ModelRouteConfig>): Promise<ModelRouteConfig> {
    this.config = { ...this.config, ...partial }
    await this.saveConfig()
    return this.getConfig()
  }

  async addRule(rule: Omit<RouteRule, 'id'>): Promise<RouteRule> {
    const newRule: RouteRule = { ...rule, id: randomUUID() }
    this.config.rules.push(newRule)
    await this.saveConfig()
    return newRule
  }

  async removeRule(id: string): Promise<boolean> {
    const before = this.config.rules.length
    this.config.rules = this.config.rules.filter(r => r.id !== id)
    const removed = this.config.rules.length < before
    if (removed) await this.saveConfig()
    return removed
  }

  // ===== 私有方法 =====

  private getDefaultConfig(): ModelRouteConfig {
    return {
      rules: [],
      defaultModelConfigId: '',
      strategy: 'balanced',
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const data = await readFile(this.configPath, 'utf-8')
      const loaded = JSON.parse(data) as ModelRouteConfig
      this.config = { ...this.getDefaultConfig(), ...loaded }
    } catch (err) {
      // 文件不存在 → 使用默认配置
      console.error('[ModelRouter] 加载配置失败:', err)
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await mkdir(join(this.configPath, '..'), { recursive: true })
      await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (err) {
      // 保存失败忽略
      console.error('[ModelRouter] 保存配置失败:', err)
    }
  }

  private findMatchingRule(taskType: string): RouteRule | null {
    const enabled = this.config.rules
      .filter(r => r.enabled && r.taskType === taskType)
      .sort((a, b) => a.priority - b.priority)
    return enabled[0] || null
  }

  private getCostInfo(model: ModelConfig): ModelCostInfo {
    // 尝试从已知模型库中查找
    const modelLower = model.name.toLowerCase()
    for (const [key, info] of Object.entries(KNOWN_MODEL_COSTS)) {
      if (modelLower.includes(key)) {
        return info
      }
    }
    // 默认估算
    return {
      inputPer1M: 1.0,
      outputPer1M: 3.0,
      latencyMs: 600,
      qualityScore: 80,
      contextWindow: 32000,
    }
  }

  private estimateCost(model: ModelConfig, input: string): number {
    const info = this.getCostInfo(model)
    const inputTokens = input.length / 4
    const outputTokens = inputTokens * 0.5 // 假设输出是输入的一半
    return (inputTokens / 1_000_000 * info.inputPer1M) + (outputTokens / 1_000_000 * info.outputPer1M)
  }

  private getTaskTypeBonus(model: ModelConfig, taskType: string): number {
    const modelLower = model.name.toLowerCase()
    const info = this.getCostInfo(model)

    switch (taskType) {
      case 'code':
        // 代码任务：高质量模型加分
        if (modelLower.includes('opus') || modelLower.includes('sonnet') || modelLower.includes('gpt-4') || modelLower.includes('reasoner')) return 15
        return 0
      case 'chat':
        // 对话任务：低延迟加分
        return Math.max(0, 10 - info.latencyMs / 100)
      case 'analysis':
        // 分析任务：大上下文加分
        if (info.contextWindow > 100000) return 15
        return 0
      case 'translation':
        return 5
      case 'summarization':
        // 摘要：中等能力即可
        if (info.qualityScore > 70 && info.qualityScore < 90) return 10
        return 0
      default:
        return 0
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
