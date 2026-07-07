// Agent 自适应学习服务
// 在工具学习闭环基础上自然延伸，让 Agent 越用越聪明
// 核心: 从历史交互中自动提取经验规则 → 生成自适应提示 → 注入 Agent 系统提示词

import Store from 'electron-store'
import type {
  AdaptiveLearningProfile,
  AdaptiveRule,
  AdaptiveHint,
  LearningProgress,
} from '@shared/types'
import type { ToolLearningService } from './ToolLearningService'
import type { MemoryService } from './MemoryService'
import { randomUUID } from 'crypto'

interface AdaptiveStoreSchema {
  profiles: Record<string, AdaptiveLearningProfile>
  rules: AdaptiveRule[]
  interactions: Array<{
    id: string
    agentId: string
    agentName: string
    input: string
    output: string
    success: boolean
    toolCalls: number
    duration: number
    timestamp: string
  }>
}

const DEFAULT_AGENT_ID = 'aela-default-agent'
const DEFAULT_AGENT_NAME = 'AELA Agent'

export class AdaptiveLearningService {
  private store: Store<AdaptiveStoreSchema>
  private toolLearningService: ToolLearningService | null = null
  private memoryService: MemoryService | null = null
  private maxInteractions = 5000

  constructor() {
    this.store = new Store<AdaptiveStoreSchema>({
      name: 'aela-adaptive-learning',
      defaults: { profiles: {}, rules: [], interactions: [] },
    })
  }

  setToolLearningService(tls: ToolLearningService): void {
    this.toolLearningService = tls
  }

  setMemoryService(ms: MemoryService): void {
    this.memoryService = ms
  }

  /**
   * 记录一次 Agent 交互（成功或失败）
   * 这是自适应学习的输入源
   */
  async recordInteraction(params: {
    agentId?: string
    agentName?: string
    input: string
    output: string
    success: boolean
    toolCalls?: number
    duration?: number
    sessionId?: string
  }): Promise<void> {
    const agentId = params.agentId ?? DEFAULT_AGENT_ID
    const agentName = params.agentName ?? DEFAULT_AGENT_NAME
    const now = new Date().toISOString()

    const interactions = this.store.get('interactions', [])
    interactions.push({
      id: randomUUID(),
      agentId,
      agentName,
      input: params.input.slice(0, 1000),
      output: params.output.slice(0, 1000),
      success: params.success,
      toolCalls: params.toolCalls ?? 0,
      duration: params.duration ?? 0,
      timestamp: now,
    })

    // 裁剪
    if (interactions.length > this.maxInteractions) {
      interactions.splice(0, interactions.length - this.maxInteractions)
    }
    this.store.set('interactions', interactions)

    // 更新 Agent 档案
    this.updateProfile(agentId, agentName, params.success)

    // 自动提取规则（每 10 次交互触发一次）
    const agentInteractions = interactions.filter(i => i.agentId === agentId)
    if (agentInteractions.length % 10 === 0) {
      this.extractRules(agentId)
    }

    // 存入记忆
    if (this.memoryService) {
      try {
        await this.memoryService.addEpisode({
          id: randomUUID(),
          sessionId: params.sessionId ?? 'adaptive_learning',
          role: 'agent_interaction',
          content: `输入: ${params.input.slice(0, 200)}\n输出: ${params.output.slice(0, 200)}\n成功: ${params.success}`,
          summary: `Agent 交互 ${params.success ? '成功' : '失败'}: ${params.input.slice(0, 80)}`,
          topics: `adaptive_learning,${agentId},${params.success ? 'success' : 'failure'}`,
          importance: params.success ? 0.3 : 0.6,
          createdAt: now,
        })
      } catch (err) {
        // 忽略
        console.error('[AdaptiveLearningService] 记忆保存失败:', err)
      }
    }
  }

  /**
   * 获取 Agent 学习档案
   */
  getProfile(agentId?: string): AdaptiveLearningProfile {
    const id = agentId ?? DEFAULT_AGENT_ID
    const profiles = this.store.get('profiles', {})
    const existing = profiles[id]
    if (existing) return existing

    // 创建空档案
    const profile: AdaptiveLearningProfile = {
      agentId: id,
      agentName: DEFAULT_AGENT_NAME,
      totalInteractions: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      learnedRules: [],
      strengths: [],
      weakAreas: [],
      avgConfidence: 0,
      learningProgress: 0,
      lastUpdated: new Date().toISOString(),
    }
    profiles[id] = profile
    this.store.set('profiles', profiles)
    return profile
  }

  /**
   * 生成自适应提示 — 注入到 Agent 系统提示词
   * 基于已学习的规则，生成针对性提示
   */
  getHints(agentId?: string): AdaptiveHint[] {
    const profile = this.getProfile(agentId)
    const rules = this.store.get('rules', [])
    const agentRules = rules.filter(
      r => profile.learnedRules.some(lr => lr.id === r.id)
    )

    const hints: AdaptiveHint[] = []

    // 按类别分组生成提示
    const byCategory = new Map<string, AdaptiveRule[]>()
    for (const rule of agentRules) {
      if (rule.confidence < 0.5) continue
      const cat = rule.category
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push(rule)
    }

    // 工具使用提示
    const toolRules = byCategory.get('tool_usage') ?? []
    if (toolRules.length > 0) {
      const topRule = toolRules[0]
      hints.push({
        ruleIds: toolRules.map(r => r.id),
        hint: `工具使用经验: ${topRule.description}（成功率 ${(topRule.successRate * 100).toFixed(0)}%）`,
        priority: topRule.confidence > 0.8 ? 'high' : 'medium',
        category: 'tool_usage',
      })
    }

    // 错误规避提示
    const errorRules = byCategory.get('error_avoidance') ?? []
    if (errorRules.length > 0) {
      hints.push({
        ruleIds: errorRules.map(r => r.id),
        hint: `避免以下模式: ${errorRules.map(r => r.pattern).join('; ')}`,
        priority: 'high',
        category: 'error_avoidance',
      })
    }

    // 任务策略提示
    const strategyRules = byCategory.get('task_strategy') ?? []
    if (strategyRules.length > 0) {
      hints.push({
        ruleIds: strategyRules.map(r => r.id),
        hint: `推荐策略: ${strategyRules.map(r => r.description).join('; ')}`,
        priority: 'medium',
        category: 'task_strategy',
      })
    }

    // 弱项提示
    if (profile.weakAreas.length > 0) {
      hints.push({
        ruleIds: [],
        hint: `注意: 在以下领域需要谨慎: ${profile.weakAreas.join(', ')}`,
        priority: 'medium',
        category: 'weak_area',
      })
    }

    return hints
  }

  /**
   * 获取学习进度统计
   */
  getProgress(agentId?: string): LearningProgress {
    const profile = this.getProfile(agentId)
    const rules = this.store.get('rules', [])
    const agentRules = rules.filter(r =>
      profile.learnedRules.some(lr => lr.id === r.id)
    )

    // 按类别统计
    const categoryStats: Record<string, { rules: number; avgSuccessRate: number }> = {}
    for (const rule of agentRules) {
      const cat = rule.category
      if (!categoryStats[cat]) {
        categoryStats[cat] = { rules: 0, avgSuccessRate: 0 }
      }
      categoryStats[cat].rules++
      categoryStats[cat].avgSuccessRate += rule.successRate
    }
    for (const cat of Object.keys(categoryStats)) {
      const cs = categoryStats[cat]
      cs.avgSuccessRate = cs.rules > 0 ? cs.avgSuccessRate / cs.rules : 0
    }

    // 计算进度
    const avgConfidence = agentRules.length > 0
      ? agentRules.reduce((sum, r) => sum + r.confidence, 0) / agentRules.length
      : 0
    const progressPercent = Math.min(100, Math.round(
      (agentRules.length / 20) * 40 +  // 规则数占 40%
      avgConfidence * 40 +               // 置信度占 40%
      (profile.successfulInteractions / Math.max(1, profile.totalInteractions)) * 20  // 成功率占 20%
    ))

    // 最近改进记录
    const interactions = this.store.get('interactions', [])
    const agentInteractions = interactions.filter(i => i.agentId === (agentId ?? DEFAULT_AGENT_ID))
    const recent = agentInteractions.slice(-20)
    const recentSuccessRate = recent.length > 0
      ? recent.filter(i => i.success).length / recent.length
      : 0
    const older = agentInteractions.slice(-40, -20)
    const olderSuccessRate = older.length > 0
      ? older.filter(i => i.success).length / older.length
      : 0

    const improvements: LearningProgress['recentImprovements'] = []
    if (older.length > 0 && recentSuccessRate > olderSuccessRate) {
      improvements.push({
        timestamp: new Date().toISOString(),
        description: '成功率提升',
        metric: 'success_rate',
        before: olderSuccessRate,
        after: recentSuccessRate,
      })
    }

    return {
      totalRules: agentRules.length,
      avgConfidence,
      progressPercent,
      recentImprovements: improvements,
      categoryStats,
    }
  }

  /**
   * 手动触发规则提取
   */
  extractRules(agentId?: string): AdaptiveRule[] {
    const id = agentId ?? DEFAULT_AGENT_ID
    const interactions = this.store.get('interactions', [])
    const agentInteractions = interactions.filter(i => i.agentId === id)

    if (agentInteractions.length < 5) return []

    const existingRules = this.store.get('rules', [])
    const newRules: AdaptiveRule[] = []
    const now = new Date().toISOString()

    // 1. 从工具学习服务获取失败模式 → 生成 error_avoidance 规则
    if (this.toolLearningService) {
      const failureModes = this.toolLearningService.analyzeFailureModes()
      for (const fm of failureModes.slice(0, 5)) {
        // 检查是否已有相同模式的规则
        const exists = existingRules.some(r =>
          r.category === 'error_avoidance' && r.pattern === fm.error.slice(0, 80)
        )
        if (!exists) {
          newRules.push({
            id: randomUUID(),
            pattern: fm.error.slice(0, 80),
            description: `工具 ${fm.toolName} 常见错误: ${fm.error.slice(0, 60)}...`,
            confidence: Math.min(0.9, fm.count / 10),
            occurrences: fm.count,
            successRate: 0,
            category: 'error_avoidance',
            createdAt: now,
            lastTriggered: fm.lastSeen,
          })
        }
      }

      // 2. 从最佳实践提取 tool_usage 规则
      const viz = this.toolLearningService.getVisualization()
      for (const bp of viz.bestPractices.slice(0, 5)) {
        const exists = existingRules.some(r =>
          r.category === 'tool_usage' && r.pattern === bp.pattern
        )
        if (!exists && bp.successRate > 0.5) {
          newRules.push({
            id: randomUUID(),
            pattern: bp.pattern,
            description: bp.description,
            confidence: bp.successRate,
            occurrences: bp.examples.length,
            successRate: bp.successRate,
            category: 'tool_usage',
            createdAt: now,
            lastTriggered: now,
          })
        }
      }
    }

    // 3. 从交互历史提取 task_strategy 规则
    const successInteractions = agentInteractions.filter(i => i.success)
    const failedInteractions = agentInteractions.filter(i => !i.success)

    // 分析成功交互的共性
    if (successInteractions.length >= 3) {
      const avgToolCalls = successInteractions.reduce((s, i) => s + i.toolCalls, 0) / successInteractions.length
      const avgDuration = successInteractions.reduce((s, i) => s + i.duration, 0) / successInteractions.length

      const exists = existingRules.some(r =>
        r.category === 'task_strategy' && r.pattern.includes('avg_tools')
      )
      if (!exists) {
        newRules.push({
          id: randomUUID(),
          pattern: `avg_tools=${avgToolCalls.toFixed(1)}, avg_duration=${avgDuration.toFixed(0)}ms`,
          description: `成功交互平均使用 ${avgToolCalls.toFixed(1)} 个工具调用，耗时 ${avgDuration.toFixed(0)}ms`,
          confidence: Math.min(0.8, successInteractions.length / 20),
          occurrences: successInteractions.length,
          successRate: 1,
          category: 'task_strategy',
          createdAt: now,
          lastTriggered: now,
        })
      }
    }

    // 4. 从失败交互提取 prompt_pattern 规则
    if (failedInteractions.length >= 2) {
      // 找出失败交互中的共性关键词
      const wordFreq: Record<string, number> = {}
      for (const fi of failedInteractions) {
        const words = fi.input.toLowerCase().split(/\s+/)
        for (const w of words) {
          if (w.length > 3) {
            wordFreq[w] = (wordFreq[w] ?? 0) + 1
          }
        }
      }
      const topWords = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

      if (topWords.length > 0 && topWords[0][1] >= 2) {
        const exists = existingRules.some(r =>
          r.category === 'prompt_pattern' && r.pattern.includes(topWords[0][0])
        )
        if (!exists) {
          newRules.push({
            id: randomUUID(),
            pattern: `input_contains: ${topWords.map(w => w[0]).join(', ')}`,
            description: `包含关键词 "${topWords.map(w => w[0]).join(', ')}" 的任务失败率较高`,
            confidence: Math.min(0.7, failedInteractions.length / 10),
            occurrences: topWords[0][1],
            successRate: 0,
            category: 'prompt_pattern',
            createdAt: now,
            lastTriggered: now,
          })
        }
      }
    }

    // 合并新规则
    const allRules = [...existingRules, ...newRules]
    this.store.set('rules', allRules)

    // 更新 Agent 档案
    this.updateProfileRules(id, allRules)

    return newRules
  }

  /**
   * 清空 Agent 档案
   */
  clearProfile(agentId?: string): void {
    const id = agentId ?? DEFAULT_AGENT_ID
    const profiles = this.store.get('profiles', {})
    delete profiles[id]
    this.store.set('profiles', profiles)

    // 清理相关交互
    const interactions = this.store.get('interactions', [])
    const filtered = interactions.filter(i => i.agentId !== id)
    this.store.set('interactions', filtered)
  }

  // ===== 私有方法 =====

  private updateProfile(agentId: string, agentName: string, success: boolean): void {
    const profiles = this.store.get('profiles', {})
    const profile = profiles[agentId] ?? {
      agentId,
      agentName,
      totalInteractions: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      learnedRules: [],
      strengths: [],
      weakAreas: [],
      avgConfidence: 0,
      learningProgress: 0,
      lastUpdated: new Date().toISOString(),
    }

    profile.agentName = agentName
    profile.totalInteractions++
    if (success) {
      profile.successfulInteractions++
    } else {
      profile.failedInteractions++
    }
    profile.lastUpdated = new Date().toISOString()

    // 更新强弱项
    const interactions = this.store.get('interactions', [])
    const agentInteractions = interactions.filter(i => i.agentId === agentId)

    // 分析最近 50 次交互的成功模式
    const recent = agentInteractions.slice(-50)
    if (recent.length >= 5) {
      const successInputs = recent.filter(i => i.success).map(i => i.input)
      const failedInputs = recent.filter(i => !i.success).map(i => i.input)

      // 简单关键词分析
      const successKeywords = this.extractKeywords(successInputs)
      const failedKeywords = this.extractKeywords(failedInputs)

      profile.strengths = successKeywords.slice(0, 5)
      profile.weakAreas = failedKeywords.slice(0, 5)
    }

    // 更新置信度
    const rules = this.store.get('rules', [])
    const agentRules = rules.filter(r =>
      profile.learnedRules.some(lr => lr.id === r.id)
    )
    profile.avgConfidence = agentRules.length > 0
      ? agentRules.reduce((s, r) => s + r.confidence, 0) / agentRules.length
      : 0

    // 更新学习进度
    profile.learningProgress = Math.min(100, Math.round(
      (agentRules.length / 20) * 40 +
      profile.avgConfidence * 40 +
      (profile.successfulInteractions / Math.max(1, profile.totalInteractions)) * 20
    ))

    profiles[agentId] = profile
    this.store.set('profiles', profiles)
  }

  private updateProfileRules(agentId: string, allRules: AdaptiveRule[]): void {
    const profiles = this.store.get('profiles', {})
    const profile = profiles[agentId]
    if (!profile) return

    // 关联规则到档案（最多 50 条）
    profile.learnedRules = allRules
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50)
      .map(r => ({ ...r }))

    profile.avgConfidence = profile.learnedRules.length > 0
      ? profile.learnedRules.reduce((s, r) => s + r.confidence, 0) / profile.learnedRules.length
      : 0

    profile.lastUpdated = new Date().toISOString()
    profiles[agentId] = profile
    this.store.set('profiles', profiles)
  }

  private extractKeywords(inputs: string[]): string[] {
    const freq: Record<string, number> = {}
    for (const input of inputs) {
      const words = input.toLowerCase().split(/[\s,;:.\n]+/)
      for (const w of words) {
        if (w.length > 3 && w.length < 30) {
          freq[w] = (freq[w] ?? 0) + 1
        }
      }
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
