// SkillRouter — 智能技能路由服务
// 根据用户输入语义匹配和关键词匹配，自动发现并推荐相关 Skill
//
// 匹配策略（双通道）：
// 1. 语义通道：用户输入 → HashEmbedding → 与 Skill 描述向量余弦相似度
// 2. 关键词通道：Skill 的 trigger 字段正则匹配用户输入

import type { Skill } from '@shared/types'
import type { EmbeddingService } from './EmbeddingService'

// 匹配结果
export interface SkillMatch {
  skill: Skill
  score: number        // 0-1，越高越匹配
  matchType: 'semantic' | 'keyword' | 'both'
}

// 路由配置
export interface SkillRouterConfig {
  // 自动激活阈值（相似度 >= 此值时自动激活）
  autoActivateThreshold: number
  // 推荐阈值（相似度 >= 此值时推荐给 Agent）
  recommendThreshold: number
  // 最大返回数量
  maxResults: number
}

const DEFAULT_CONFIG: SkillRouterConfig = {
  autoActivateThreshold: 0.75,
  recommendThreshold: 0.5,
  maxResults: 5,
}

export class SkillRouter {
  private embeddingService: EmbeddingService | null = null
  private config: SkillRouterConfig
  private skillVectors: Map<string, number[]> = new Map()
  private skills: Map<string, Skill> = new Map()

  constructor(config?: Partial<SkillRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 设置 Embedding 服务（由 ServiceBootstrap 注入）
   * 接入后使用 OpenAI 语义嵌入替代 hash trick
   */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service
    // 维度变更后需要重新索引
    if (this.skills.size > 0) {
      const allSkills = Array.from(this.skills.values())
      this.indexSkills(allSkills)
    }
  }

  /**
   * 为所有可用 Skill 建立索引
   */
  indexSkills(skills: Skill[]): void {
    this.skillVectors.clear()
    this.skills.clear()

    for (const skill of skills) {
      this.skills.set(skill.id, skill)
      // 使用 name + description + tags 作为嵌入文本
      const text = [skill.name, skill.description, ...(skill.tags || [])].join(' ')
      const vector = this.embeddingService 
        ? this.embeddingService.embedSync(text)
        : this.fallbackEmbed(text)
      this.skillVectors.set(skill.id, vector)
    }
  }

  /**
   * 根据用户输入查找相关 Skill
   */
  findRelevantSkills(input: string, topK?: number): SkillMatch[] {
    const limit = topK ?? this.config.maxResults
    const matches: SkillMatch[] = []

    // 语义匹配
    const inputVector = this.embeddingService
      ? this.embeddingService.embedSync(input)
      : this.fallbackEmbed(input)
    const semanticMatches = this.computeSimilarity(inputVector)

    // 关键词匹配
    const keywordMatches = this.findByTrigger(input)

    // 合并结果
    const matchMap = new Map<string, SkillMatch>()

    for (const { skillId, score } of semanticMatches) {
      const skill = this.skills.get(skillId)
      if (!skill) continue
      matchMap.set(skillId, {
        skill,
        score,
        matchType: 'semantic',
      })
    }

    for (const skill of keywordMatches) {
      const existing = matchMap.get(skill.id)
      if (existing) {
        // 同时命中两种通道，提升分数（至少 0.9）
        existing.score = Math.max(Math.min(1, existing.score + 0.2), 0.9)
        existing.matchType = 'both'
      } else {
        matchMap.set(skill.id, {
          skill,
          score: 0.9, // 关键词精确匹配给予高分
          matchType: 'keyword',
        })
      }
    }

    // 按分数排序，返回 Top-K
    matches.push(...matchMap.values())
    matches.sort((a, b) => b.score - a.score)

    return matches.slice(0, limit)
  }

  /**
   * 查找应自动激活的高置信度 Skill
   */
  findAutoActivateSkills(input: string): Skill[] {
    const matches = this.findRelevantSkills(input, this.config.maxResults)
    return matches
      .filter(m => m.score >= this.config.autoActivateThreshold)
      .map(m => m.skill)
  }

  /**
   * 查找应推荐给 Agent 的 Skill
   */
  findRecommendedSkills(input: string): SkillMatch[] {
    const matches = this.findRelevantSkills(input, this.config.maxResults)
    return matches.filter(
      m => m.score >= this.config.recommendThreshold && m.score < this.config.autoActivateThreshold
    )
  }

  /**
   * 获取所有已索引的 Skill
   */
  getIndexedSkills(): Skill[] {
    return Array.from(this.skills.values())
  }

  /**
   * 获取已索引 Skill 数量
   */
  getIndexedCount(): number {
    return this.skills.size
  }

  // ===== 私有方法 =====

  /**
   * 降级嵌入（无 EmbeddingService 时使用简单 hash）
   */
  private fallbackEmbed(text: string): number[] {
    const dim = 128
    const vector = new Array(dim).fill(0)
    const tokens = text.toLowerCase().split(/[\s\p{P}]+/u).filter(t => t.length > 0)
    for (const token of tokens) {
      let hash = 0
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0
      }
      vector[Math.abs(hash) % dim] += 1
    }
    // L2 归一化
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
    return norm > 0 ? vector.map(v => v / norm) : vector
  }

  /**
   * 计算输入向量与所有 Skill 的相似度
   */
  private computeSimilarity(inputVector: number[]): Array<{ skillId: string; score: number }> {
    const results: Array<{ skillId: string; score: number }> = []

    for (const [skillId, skillVector] of this.skillVectors) {
      const score = this.cosineSimilarity(inputVector, skillVector)
      results.push({ skillId, score })
    }

    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * 根据 trigger 关键词精确匹配
   */
  private findByTrigger(input: string): Skill[] {
    const matches: Skill[] = []
    const lowerInput = input.toLowerCase()

    for (const skill of this.skills.values()) {
      if (!skill.trigger) continue
      const triggers = skill.trigger.split(',').map(t => t.trim().toLowerCase())
      for (const trigger of triggers) {
        if (trigger && lowerInput.includes(trigger)) {
          matches.push(skill)
          break
        }
      }
    }

    return matches
  }
}
