// 工具使用学习服务
// [重构] 集成 SDK EnhancedToolLearner 的 few-shot 生成和模式提取能力
// 保持 AELA 公共 API 不变（electron-store 持久化 + 可视化数据 + 失败模式分析）
// SDK 优势: 闭环增强——自动生成 few-shot 示例注入 system prompt、工具使用模式识别

import Store from 'electron-store'
import type { ToolUsageRecord, BestPractice, ToolLearningSuggestion, ToolLearningVisualization } from '@shared/types'
import type { MemoryService } from './MemoryService'
import { randomUUID } from 'crypto'

interface ToolLearningStoreSchema {
  records: ToolUsageRecord[]
}

export class ToolLearningService {
  private memoryService: MemoryService | null = null
  private store: Store<ToolLearningStoreSchema>
  private records: ToolUsageRecord[]
  private maxRecords: number = 10000

  constructor() {
    this.store = new Store<ToolLearningStoreSchema>({
      name: 'aela-tool-learning',
      defaults: { records: [] },
    })
    this.records = this.store.get('records', [])
  }

  /**
   * 设置记忆服务（用于持久化工具使用经验）
   */
  setMemoryService(ms: MemoryService): void {
    this.memoryService = ms
  }

  /**
   * 记录工具成功使用
   */
  async recordSuccess(toolName: string, args: string, result: string, sessionId?: string): Promise<void> {
    const record: ToolUsageRecord = {
      toolName,
      args,
      result: result.slice(0, 2000),
      success: true,
      timestamp: new Date().toISOString(),
    }

    this.records.push(record)
    this.trimRecords()
    this.persist()

    // 存入记忆服务
    if (this.memoryService) {
      try {
        await this.memoryService.addEpisode({
          id: randomUUID(),
          sessionId: sessionId ?? 'tool_learning',
          role: 'tool_usage',
          content: JSON.stringify(record),
          summary: `工具 ${toolName} 成功调用`,
          topics: `tool_learning,${toolName},success`,
          importance: 0.3,
          metadata: {
            tool_name: toolName,
            success: 'true',
          },
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        // 记忆保存失败不影响主流程
        console.error('[ToolLearningService] 记录工具成功调用失败:', err)
      }
    }
  }

  /**
   * 记录工具失败使用
   */
  async recordFailure(toolName: string, args: string, errorMsg: string, sessionId?: string): Promise<void> {
    const record: ToolUsageRecord = {
      toolName,
      args,
      error: errorMsg.slice(0, 2000),
      success: false,
      timestamp: new Date().toISOString(),
    }

    this.records.push(record)
    this.trimRecords()
    this.persist()

    // 存入记忆服务
    if (this.memoryService) {
      try {
        await this.memoryService.addEpisode({
          id: randomUUID(),
          sessionId: sessionId ?? 'tool_learning',
          role: 'tool_usage',
          content: JSON.stringify(record),
          summary: `工具 ${toolName} 调用失败: ${errorMsg.slice(0, 100)}`,
          topics: `tool_learning,${toolName},failure`,
          importance: 0.5,
          metadata: {
            tool_name: toolName,
            success: 'false',
            error: errorMsg.slice(0, 500),
          },
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        // 忽略
        console.error('[ToolLearningService] 记录工具失败调用失败:', err)
      }
    }
  }

  /**
   * 获取工具最佳实践
   * 基于历史记录分析成功率和常见参数模式
   */
  getBestPractices(toolName: string): BestPractice[] {
    const toolRecords = this.records.filter(r => r.toolName === toolName && r.success)
    if (toolRecords.length === 0) return []

    const total = this.records.filter(r => r.toolName === toolName).length
    const successCount = toolRecords.length
    const successRate = total > 0 ? successCount / total : 0

    // 提取成功示例（取最近的 5 个）
    const examples = toolRecords
      .slice(-5)
      .map(r => `参数: ${r.args.slice(0, 200)}\n结果: ${(r.result ?? '').slice(0, 200)}`)

    // 分析常见参数模式
    const patterns = this.analyzePatterns(toolRecords)

    return patterns.map(p => ({
      toolName,
      pattern: p.pattern,
      description: p.description,
      successRate,
      examples: examples.slice(0, 3),
      createdAt: new Date().toISOString(),
    }))
  }

  /**
   * 基于历史经验建议改进
   */
  suggestImprovement(toolName: string, args: string): ToolLearningSuggestion {
    const practices = this.getBestPractices(toolName)

    if (practices.length === 0 || practices[0].examples.length === 0) {
      return {
        originalArgs: args,
        improvedArgs: args,
        reason: '没有足够的历史数据提供改进建议',
        confidence: 0,
      }
    }

    const bestPractice = practices[0]
    const successRate = bestPractice.successRate

    // 尝试解析原始参数，结合最佳实践模式生成建议
    let improvedArgs = args
    try {
      const parsed = JSON.parse(args)
      // 如果最佳实践的描述包含参数建议，合并到原始参数中
      const pattern = bestPractice.pattern
      if (pattern && typeof parsed === 'object' && parsed !== null) {
        // 将最佳实践模式作为参考，但不覆盖原有参数
        improvedArgs = JSON.stringify({ ...parsed, _bestPracticePattern: pattern }, null, 2)
      }
    } catch {
      // 参数不是合法 JSON，保持原样
    }

    return {
      originalArgs: args,
      improvedArgs,
      reason: `基于历史成功记录「${bestPractice.description}」（成功率 ${(successRate * 100).toFixed(1)}%）`,
      confidence: successRate,
    }
  }

  /**
   * 获取工具使用统计
   */
  getToolStats(toolName?: string): {
    toolName: string
    totalCalls: number
    successCount: number
    failureCount: number
    successRate: number
    avgResultLength: number
  }[] {
    const toolNames = toolName
      ? [toolName]
      : [...new Set(this.records.map(r => r.toolName))]

    return toolNames.map(name => {
      const records = this.records.filter(r => r.toolName === name)
      const successCount = records.filter(r => r.success).length
      const failureCount = records.filter(r => !r.success).length
      const totalResultLen = records
        .filter(r => r.success && r.result)
        .reduce((sum, r) => sum + (r.result?.length ?? 0), 0)
      const successWithResult = records.filter(r => r.success && r.result).length

      return {
        toolName: name,
        totalCalls: records.length,
        successCount,
        failureCount,
        successRate: records.length > 0 ? successCount / records.length : 0,
        avgResultLength: successWithResult > 0 ? Math.round(totalResultLen / successWithResult) : 0,
      }
    })
  }

  /**
   * 获取所有工具使用记录
   */
  getRecords(toolName?: string, limit?: number): ToolUsageRecord[] {
    let records = toolName
      ? this.records.filter(r => r.toolName === toolName)
      : [...this.records]
    records = records.reverse()
    return limit ? records.slice(0, limit) : records
  }

  /**
   * 清空记录
   */
  clear(): void {
    this.records = []
    this.persist()
  }

  /**
   * 分析参数模式 — 使用 SDK EnhancedToolLearner 的 extractPattern 逻辑
   * SDK 优势: 更精准的模式提取（action/method/command 类型识别）
   */
  private analyzePatterns(records: ToolUsageRecord[]): Array<{ pattern: string; description: string }> {
    if (records.length === 0) return []

    // 使用 SDK 的 extractPattern 逻辑：从 JSON 参数中提取 action/method/command
    const patternCounts: Map<string, number> = new Map()
    const argCounts: Record<string, number> = {}

    for (const r of records) {
      // SDK extractPattern 逻辑
      const pattern = this.extractPattern(r.args)
      patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1)

      // 同时统计常见参数关键词
      try {
        const args = JSON.parse(r.args)
        for (const key of Object.keys(args)) {
          argCounts[key] = (argCounts[key] ?? 0) + 1
        }
      } catch {
        // 非 JSON 参数，跳过
      }
    }

    // 按 SDK 模式分组生成最佳实践
    const practices: Array<{ pattern: string; description: string }> = []
    for (const [pattern, count] of patternCounts) {
      practices.push({
        pattern,
        description: `模式「${pattern}」出现 ${count} 次`,
      })
    }

    // 如果有 JSON 参数关键词，也加入
    const sortedKeys = Object.entries(argCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    if (sortedKeys.length > 0 && practices.length === 0) {
      practices.push({
        pattern: `参数包含: ${sortedKeys.map(k => k[0]).join(', ')}`,
        description: `最常见的成功参数组合（出现 ${sortedKeys[0][1]} 次）`,
      })
    }

    return practices.length > 0 ? practices : [{
      pattern: '通用调用',
      description: '成功调用的通用模式',
    }]
  }

  /**
   * SDK EnhancedToolLearner.extractPattern 的对齐实现
   * 从 JSON 参数中提取 action/method/command 作为模式标识
   */
  private extractPattern(args: string): string {
    try {
      const parsed = JSON.parse(args)
      if (parsed.action) return `action:${parsed.action}`
      if (parsed.method) return `method:${parsed.method}`
      if (parsed.command) return `command:${String(parsed.command).split(' ')[0]}`
    } catch { /* ignore JSON parse errors */ }
    return args.slice(0, 50)
  }

  /**
   * [SDK 集成] 生成 few-shot 示例，可注入到 system prompt
   * SDK EnhancedToolLearner.generateFewShotExamples 的 AELA 版本
   */
  generateFewShotExamples(toolName: string, maxExamples = 5, qualityThreshold = 0.7): Array<{
    toolName: string
    input: string
    toolArgs: string
    expectedResult: string
    quality: number
    source: string
  }> {
    const practices = this.getBestPractices(toolName)
    if (practices.length === 0) return []

    const examples: Array<{
      toolName: string
      input: string
      toolArgs: string
      expectedResult: string
      quality: number
      source: string
    }> = []

    for (const practice of practices) {
      if (practice.successRate < qualityThreshold) continue

      for (const ex of practice.examples.slice(0, 2)) {
        examples.push({
          toolName,
          input: `使用 ${toolName} 工具`,
          toolArgs: ex.split('\n')[0]?.replace('参数: ', '') ?? '',
          expectedResult: ex.split('\n')[1]?.replace('结果: ', '') ?? '',
          quality: practice.successRate,
          source: `practice:${practice.pattern}`,
        })
        if (examples.length >= maxExamples) break
      }
      if (examples.length >= maxExamples) break
    }

    return examples
  }

  /**
   * 裁剪记录数量
   */
  private trimRecords(): void {
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-Math.floor(this.maxRecords * 0.8))
    }
  }

  /**
   * 持久化记录到磁盘（防抖：避免每次工具调用都重写整个数组）
   */
  private persistScheduled = false
  private persist(): void {
    if (this.persistScheduled) return
    this.persistScheduled = true
    queueMicrotask(() => {
      this.persistScheduled = false
      this.store.set('records', this.records)
    })
  }

  // ===== [升级] 可视化数据 =====

  /**
   * 生成完整的工具学习可视化数据
   */
  getVisualization(): ToolLearningVisualization {
    const stats = this.getToolStats()
    const toolNames = [...new Set(this.records.map(r => r.toolName))]

    // 每个工具的成功率趋势
    const toolStats = stats.map(s => {
      const toolRecords = this.records
        .filter(r => r.toolName === s.toolName)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .slice(-50) // 最近 50 次
        .map(r => ({ timestamp: r.timestamp, success: r.success }))

      return {
        toolName: s.toolName,
        totalCalls: s.totalCalls,
        successRate: s.successRate,
        trend: toolRecords,
      }
    })

    // 失败模式分析
    const failureModes = this.analyzeFailureModes()

    // 最佳实践汇总
    const bestPractices = toolNames.flatMap(name => {
      const practices = this.getBestPractices(name)
      return practices.map(p => ({
        toolName: p.toolName,
        pattern: p.pattern,
        description: p.description,
        successRate: p.successRate,
        examples: p.examples,
      }))
    })

    // 总体成功率
    const totalSuccess = this.records.filter(r => r.success).length
    const overallSuccessRate = this.records.length > 0 ? totalSuccess / this.records.length : 0

    return {
      toolStats,
      failureModes,
      bestPractices,
      overallSuccessRate,
      totalToolsTracked: toolNames.length,
    }
  }

  /**
   * 分析失败模式
   */
  analyzeFailureModes(): Array<{
    toolName: string
    error: string
    count: number
    lastSeen: string
    suggestedFix: string
  }> {
    const failureRecords = this.records.filter(r => !r.success && r.error)
    const errorPatterns: Map<string, {
      toolName: string
      error: string
      count: number
      lastSeen: string
    }> = new Map()

    for (const r of failureRecords) {
      // 截取错误信息的前 120 字符作为模式
      const pattern = r.error!.slice(0, 120)
      const key = `${r.toolName}::${pattern}`

      if (!errorPatterns.has(key)) {
        errorPatterns.set(key, {
          toolName: r.toolName,
          error: pattern,
          count: 0,
          lastSeen: r.timestamp,
        })
      }
      const ep = errorPatterns.get(key)!
      ep.count++
      if (r.timestamp > ep.lastSeen) {
        ep.lastSeen = r.timestamp
      }
    }

    return Array.from(errorPatterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
      .map(ep => ({
        ...ep,
        suggestedFix: this.suggestFixForError(ep.toolName, ep.error),
      }))
  }

  /**
   * 基于错误信息建议修复方法
   */
  private suggestFixForError(toolName: string, error: string): string {
    const lower = error.toLowerCase()

    if (lower.includes('timeout') || lower.includes('timed out')) {
      return '增加超时时间设置，或检查网络连接是否正常'
    }
    if (lower.includes('permission') || lower.includes('denied') || lower.includes('forbidden')) {
      return '检查权限设置，确保 Agent 有足够的访问权限'
    }
    if (lower.includes('not found') || lower.includes('no such file')) {
      return '检查路径是否存在，或文件是否已被移动/删除'
    }
    if (lower.includes('syntax') || lower.includes('parse')) {
      return '检查输入参数格式是否正确，确保 JSON 合法'
    }
    if (lower.includes('rate limit') || lower.includes('429')) {
      return '请求频率过高，建议增加请求间隔或使用缓存'
    }
    if (lower.includes('connection') || lower.includes('econnrefused')) {
      return '目标服务不可达，检查服务是否启动或地址是否正确'
    }
    if (lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('401')) {
      return '认证失败，检查 API Key 或 Token 是否有效'
    }
    if (lower.includes('validation') || lower.includes('invalid')) {
      return '输入验证失败，检查参数类型和范围是否符合要求'
    }

    return '查看详细错误日志以获取更多信息'
  }

  /**
   * 清空所有记录
   */
  clearAll(): void {
    this.records = []
    this.persist()
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
