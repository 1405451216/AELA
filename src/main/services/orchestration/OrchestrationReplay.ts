// Orchestration 执行回放 + 性能分析
// 集中管理 run 记录、listRuns、getRun、getPerformanceReport。
// 设计为独立类，封装 electron-store 持久化细节。

import Store from 'electron-store'
import { randomUUID } from 'crypto'
import type {
  OrchestrationConfig,
  OrchestrationStepResult,
  OrchestrationRunRecord,
  OrchestrationPerformanceReport,
} from '@shared/types'

interface OrchestrationStoreSchema {
  runs: OrchestrationRunRecord[]
}

/**
 * OrchestrationReplay 仓储
 *
 * 负责：
 * - 记录每次编排执行的结果
 * - 提供 run 列表查询（按 finishedAt 倒序）
 * - 提供性能分析报告（按 mode 分组 + slowest agents + error patterns）
 */
export class OrchestrationReplay {
  private store: Store<OrchestrationStoreSchema>
  private static readonly MAX_RUNS = 200

  constructor(storeName = 'aela-orchestration-runs') {
    this.store = new Store<OrchestrationStoreSchema>({
      name: storeName,
      defaults: { runs: [] },
    })
  }

  /**
   * 记录一次编排执行结果
   */
  recordRun(
    config: OrchestrationConfig,
    results: OrchestrationStepResult[],
    startTime: number,
    success: boolean,
    error?: string,
  ): OrchestrationRunRecord {
    const record: OrchestrationRunRecord = {
      id: randomUUID(),
      configId: config.id,
      configName: config.name,
      mode: config.mode,
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      success,
      agentCount: config.agents.length,
      results,
      error,
    }

    const runs = this.store.get('runs', [])
    runs.push(record)
    // 保留最近 200 条记录
    if (runs.length > OrchestrationReplay.MAX_RUNS) {
      runs.splice(0, runs.length - OrchestrationReplay.MAX_RUNS)
    }
    this.store.set('runs', runs)
    return record
  }

  /**
   * 列出所有执行记录（按 finishedAt 倒序）
   */
  listRuns(limit?: number): OrchestrationRunRecord[] {
    const runs = this.store.get('runs', [])
    const sorted = [...runs].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    return limit ? sorted.slice(0, limit) : sorted
  }

  /**
   * 获取单条执行记录
   */
  getRun(id: string): OrchestrationRunRecord | undefined {
    return this.store.get('runs', []).find((r) => r.id === id)
  }

  /**
   * 生成性能分析报告
   */
  getPerformanceReport(): OrchestrationPerformanceReport {
    const runs = this.store.get('runs', [])
    const totalRuns = runs.length

    if (totalRuns === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        avgDuration: 0,
        avgAgentCount: 0,
        byMode: this.emptyByMode(),
        slowestAgents: [],
        errorPatterns: [],
      }
    }

    const successCount = runs.filter((r) => r.success).length
    const totalDuration = runs.reduce((sum, r) => sum + r.duration, 0)
    const totalAgents = runs.reduce((sum, r) => sum + r.agentCount, 0)

    // 按模式分组统计
    const modes: OrchestrationConfig['mode'][] = [
      'pipeline',
      'parallel',
      'handoff',
      'pool',
      'streaming_pipeline',
    ]
    const byMode = this.emptyByMode()
    for (const mode of modes) {
      const modeRuns = runs.filter((r) => r.mode === mode)
      const modeSuccess = modeRuns.filter((r) => r.success)
      byMode[mode] = {
        runs: modeRuns.length,
        avgDuration: modeRuns.length > 0 ? modeRuns.reduce((s, r) => s + r.duration, 0) / modeRuns.length : 0,
        successRate: modeRuns.length > 0 ? modeSuccess.length / modeRuns.length : 0,
      }
    }

    // 找出最慢的 Agent
    const slowestAgents = this.computeSlowestAgents(runs)

    // 错误模式分析
    const errorPatterns = this.computeErrorPatterns(runs)

    return {
      totalRuns,
      successRate: successCount / totalRuns,
      avgDuration: totalDuration / totalRuns,
      avgAgentCount: totalAgents / totalRuns,
      byMode,
      slowestAgents,
      errorPatterns,
    }
  }

  private emptyByMode(): OrchestrationPerformanceReport['byMode'] {
    return {
      pipeline: { runs: 0, avgDuration: 0, successRate: 0 },
      parallel: { runs: 0, avgDuration: 0, successRate: 0 },
      handoff: { runs: 0, avgDuration: 0, successRate: 0 },
      pool: { runs: 0, avgDuration: 0, successRate: 0 },
      groupchat: { runs: 0, avgDuration: 0, successRate: 0 },
      debate: { runs: 0, avgDuration: 0, successRate: 0 },
      supervisor: { runs: 0, avgDuration: 0, successRate: 0 },
      streaming_pipeline: { runs: 0, avgDuration: 0, successRate: 0 },
    }
  }

  private computeSlowestAgents(runs: OrchestrationRunRecord[]) {
    const agentDurations: Map<string, { total: number; count: number }> = new Map()
    for (const run of runs) {
      for (const result of run.results) {
        const duration = result.metrics?.duration ?? 0
        if (!agentDurations.has(result.agentName)) {
          agentDurations.set(result.agentName, { total: 0, count: 0 })
        }
        const ad = agentDurations.get(result.agentName)!
        ad.total += duration
        ad.count++
      }
    }
    return Array.from(agentDurations.entries())
      .map(([agentName, { total, count }]) => ({
        agentName,
        avgDuration: count > 0 ? total / count : 0,
        runs: count,
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5)
  }

  private computeErrorPatterns(runs: OrchestrationRunRecord[]) {
    const errorMap: Map<string, number> = new Map()
    for (const run of runs) {
      if (run.error) {
        const pattern = run.error.slice(0, 100)
        errorMap.set(pattern, (errorMap.get(pattern) ?? 0) + 1)
      }
      for (const result of run.results) {
        if (result.error) {
          const pattern = result.error.slice(0, 100)
          errorMap.set(pattern, (errorMap.get(pattern) ?? 0) + 1)
        }
      }
    }
    return Array.from(errorMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }
}
