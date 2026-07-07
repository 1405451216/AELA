// AgentPerformanceOptimizer — Agent 性能优化器
// 从 AgentService 提取：投机执行 + 请求缓存 + 自省调优
// 职责：管理 SpeculativeExecutor 实例池、FingerprintCache、AgentSelfTuner
//
// 架构：AgentService 委托此类处理性能优化相关逻辑

import {
  AgentSelfTuner,
  SpeculativeExecutor,
  FingerprintCache,
  type LLMCache,
  type CacheStats,
  type SpeculationStats,
  type SpeculativeExecConfig,
  type RunMetrics,
} from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type { ToolRegistry } from '@agentprimordia/sdk'

export class AgentPerformanceOptimizer {
  // 自省调优器 — 收集运行指标，自动优化 maxTurns / parallelToolExecution
  private selfTuner = new AgentSelfTuner({ parallelToolExecution: true })
  // 请求缓存 — LLM 响应指纹缓存
  private llmCache: LLMCache = new FingerprintCache(500)
  private cacheEnabled = true
  // 投机执行配置
  private speculativeEnabled = true
  private speculativeConfig: SpeculativeExecConfig = {
    enabled: true,
    minHitRate: 0.3,
    maxSpecDepth: 2,
    speculationTimeoutMs: 10000,
  }
  // 每会话投机执行器实例
  private activeSpeculativeExecutors = new Map<string, SpeculativeExecutor>()

  /**
   * 为指定会话创建投机执行器
   */
  createSpeculativeExecutor(
    sessionId: string,
    provider: Provider,
    toolRegistry: ToolRegistry,
  ): SpeculativeExecutor | null {
    if (!this.speculativeEnabled) return null

    const specExec = new SpeculativeExecutor(
      provider,
      toolRegistry,
      this.speculativeConfig,
    )
    this.activeSpeculativeExecutors.set(sessionId, specExec)
    return specExec
  }

  /**
   * 清理指定会话的投机执行器
   */
  cleanupSession(sessionId: string): void {
    this.activeSpeculativeExecutors.delete(sessionId)
  }

  /**
   * 记录运行指标到 SelfTuner
   */
  recordRun(metrics: RunMetrics): void {
    this.selfTuner.recordRun(metrics)
  }

  /**
   * 获取 LLM 缓存（供 AgentContextBuilder 创建 CachedProvider 时使用）
   */
  getLLMCache(): LLMCache {
    return this.llmCache
  }

  isCacheEnabled(): boolean {
    return this.cacheEnabled
  }

  // ===== API 方法（供 IPC handler 调用） =====

  getSelfTunerStats() {
    return this.selfTuner.getStats()
  }

  getTuningSuggestion() {
    return this.selfTuner.getSuggestion()
  }

  getSpeculativeStats(): SpeculationStats[] {
    const stats: SpeculationStats[] = []
    for (const [, specExec] of this.activeSpeculativeExecutors) {
      stats.push(specExec.getStats())
    }
    return stats
  }

  resetSpeculative(): void {
    for (const [, specExec] of this.activeSpeculativeExecutors) {
      specExec.reset()
    }
  }

  setSpeculativeEnabled(enabled: boolean): void {
    this.speculativeEnabled = enabled
    this.speculativeConfig = { ...this.speculativeConfig, enabled }
  }

  getSpeculativeConfig(): SpeculativeExecConfig & { enabled: boolean } {
    return { ...this.speculativeConfig, enabled: this.speculativeEnabled }
  }

  getCacheStats(): CacheStats {
    return this.llmCache.stats()
  }

  clearCache(): void {
    this.llmCache.clear()
  }

  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled
  }
}
