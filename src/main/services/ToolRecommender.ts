// ToolRecommender — 工具推荐引擎
// 综合任务类型、语义匹配、历史成功率三个维度推荐工具
//
// 评分公式：
//   finalScore = semanticScore * 0.4 + taskTypeScore * 0.3 + historyScore * 0.2 + chainScore * 0.1

import type { TaskRouter, TaskRoute } from './TaskRouter'
import type { ToolLearningService } from './ToolLearningService'
import type { EmbeddingService } from './EmbeddingService'

export interface ToolRecommendation {
  toolName: string
  score: number
  reason: string
  metadata: {
    semanticScore: number
    taskTypeScore: number
    historyScore: number
    chainScore: number
  }
}

export interface ToolRecommenderOptions {
  // 语义匹配权重
  semanticWeight: number
  // 任务类型权重
  taskTypeWeight: number
  // 历史成功率权重
  historyWeight: number
  // 工具链协同权重
  chainWeight: number
  // 最少调用次数（低于此数量的历史数据不可靠）
  minCallHistory: number
}

const DEFAULT_OPTIONS: ToolRecommenderOptions = {
  semanticWeight: 0.4,
  taskTypeWeight: 0.3,
  historyWeight: 0.2,
  chainWeight: 0.1,
  minCallHistory: 5,
}

export class ToolRecommender {
  private embeddingService: EmbeddingService | null = null
  private taskRouter: TaskRouter
  private toolLearning: ToolLearningService | null = null
  private options: ToolRecommenderOptions
  private toolVectors: Map<string, number[]> = new Map()
  private toolDescriptions: Map<string, string> = new Map()

  constructor(
    taskRouter: TaskRouter,
    options?: Partial<ToolRecommenderOptions>
  ) {
    this.taskRouter = taskRouter
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * 设置 Embedding 服务
   */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service
    // 重新索引
    if (this.toolDescriptions.size > 0) {
      const tools = Array.from(this.toolDescriptions.entries()).map(([name, desc]) => ({ name, description: desc }))
      this.indexTools(tools)
    }
  }

  /**
   * 设置工具学习服务
   */
  setToolLearningService(service: ToolLearningService): void {
    this.toolLearning = service
  }

  /**
   * 索引所有可用工具描述
   */
  indexTools(tools: Array<{ name: string; description: string }>): void {
    this.toolVectors.clear()
    this.toolDescriptions.clear()

    for (const tool of tools) {
      this.toolDescriptions.set(tool.name, tool.description)
      const vector = this.embeddingService
        ? this.embeddingService.embedSync(tool.description)
        : this.fallbackEmbed(tool.description)
      this.toolVectors.set(tool.name, vector)
    }
  }

  /**
   * 推荐工具
   */
  recommendTools(input: string, topK: number = 5): ToolRecommendation[] {
    const taskRoute = this.taskRouter.detectTask(input)
    const recommendations: ToolRecommendation[] = []

    for (const [toolName, toolVector] of this.toolVectors) {
      // 1. 语义匹配分数
      const inputVector = this.embeddingService
        ? this.embeddingService.embedSync(input)
        : this.fallbackEmbed(input)
      const semanticScore = this.cosineSimilarity(inputVector, toolVector)

      // 2. 任务类型分数
      const taskTypeScore = taskRoute.recommendedTools.includes(toolName) ? 1.0 : 0.1

      // 3. 历史成功率分数
      const historyScore = this.getHistoryScore(toolName)

      // 4. 工具链协同分数
      const chainScore = this.getChainScore(toolName, taskRoute)

      // 加权计算最终分数
      const finalScore =
        semanticScore * this.options.semanticWeight +
        taskTypeScore * this.options.taskTypeWeight +
        historyScore * this.options.historyWeight +
        chainScore * this.options.chainWeight

      // 只返回有意义的推荐
      if (finalScore > 0.2) {
        const reasons: string[] = []
        if (semanticScore > 0.5) reasons.push('语义相关')
        if (taskTypeScore > 0.5) reasons.push('任务匹配')
        if (historyScore > 0.7) reasons.push('历史高成功率')
        if (chainScore > 0.5) reasons.push('常用工具链')

        recommendations.push({
          toolName,
          score: finalScore,
          reason: reasons.join(', ') || '综合推荐',
          metadata: {
            semanticScore,
            taskTypeScore,
            historyScore,
            chainScore,
          },
        })
      }
    }

    // 按分数降序排列
    recommendations.sort((a, b) => b.score - a.score)

    return recommendations.slice(0, topK)
  }

  /**
   * 获取已索引工具数量
   */
  getIndexedCount(): number {
    return this.toolDescriptions.size
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
    const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0))
    return norm > 0 ? vector.map(v => v / norm) : vector
  }

  /**
   * 获取工具历史成功率分数
   */
  private getHistoryScore(toolName: string): number {
    if (!this.toolLearning) return 0.5 // 无历史数据时返回中性分

    const allStats = this.toolLearning.getToolStats(toolName)
    if (!allStats || allStats.length === 0) {
      return 0.5
    }
    const stats = allStats[0]
    if (stats.totalCalls < this.options.minCallHistory) {
      return 0.5 // 数据不足时返回中性分
    }

    return stats.successRate
  }

  /**
   * 获取工具链协同分数
   */
  private getChainScore(toolName: string, taskRoute: TaskRoute): number {
    const recommendedTools = taskRoute.recommendedTools
    if (recommendedTools.includes(toolName)) {
      return 1.0 // 在当前任务推荐列表中
    }

    // 检查是否是推荐工具的常见协同工具
    const chainBonus = 0.3
    for (const recTool of recommendedTools) {
      const chain = TOOL_CHAIN_MAP[recTool]
      if (chain && chain.includes(toolName)) {
        return chainBonus
      }
    }

    return 0
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
}

// 工具链协同映射：当使用了某个工具后，协同推荐其他工具
const TOOL_CHAIN_MAP: Record<string, string[]> = {
  review_code: ['read_file', 'search_code', 'generate_test'],
  generate_test: ['review_code', 'execute_command'],
  read_file: ['search_code', 'write_file', 'review_code'],
  write_file: ['read_file', 'execute_command'],
  search_code: ['read_file', 'write_file'],
  execute_command: ['read_file', 'write_file'],
  generate_wiki: ['read_file', 'get_project_structure'],
  get_project_structure: ['read_file', 'generate_wiki'],
}
