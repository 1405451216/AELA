// 任务规划服务
// [重构] 使用 SDK 原生 LLMPlanner + PlanExecutor
// 保持 AELA 公共 API 不变，内部委托给 SDK 实现
// SDK 优势: 标准化 Planner 接口、temperature=0、内置 PlanExecutor 执行器

import { LLMPlanner, type SubTask as SDKSubTask, type TaskPlan as SDKPlan, type TaskStatus as SDKTaskStatus } from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type { SubTask, Plan, TaskStatus } from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'

const DEFAULT_MODEL_CONFIG_ID = 'default'

// ===== SDK SubTask → AELA SubTask 转换 =====

function toAELASubTask(s: SDKSubTask): SubTask {
  return {
    id: s.id,
    description: s.description,
    dependsOn: s.dependsOn,
    status: s.status as TaskStatus,
    result: s.result ?? '',
  }
}

// ===== AELA SubTask → SDK SubTask 转换 =====

function toSDKSubTask(s: SubTask): SDKSubTask {
  return {
    id: s.id,
    description: s.description,
    dependsOn: s.dependsOn,
    status: s.status as SDKTaskStatus,
    result: s.result,
  }
}

// ===== AELA Plan → SDK Plan 转换 =====

function _toSDKPlan(p: Plan): SDKPlan {
  return {
    goal: p.goal,
    subTasks: p.subtasks.map(toSDKSubTask),
    createdAt: p.createdAt,
  }
}

// ===== SDK Plan → AELA Plan 转换 =====

function toAELAPlan(p: SDKPlan): Plan {
  return {
    goal: p.goal,
    subtasks: p.subTasks.map(toAELASubTask),
    createdAt: p.createdAt,
  }
}

export class PlanningService {
  private providerManager: ProviderManager
  private configStore: ConfigStore

  constructor(configStore: ConfigStore, providerManager: ProviderManager) {
    this.configStore = configStore
    this.providerManager = providerManager
  }

  /**
   * 获取 Provider（优先使用指定 modelConfigId，否则使用默认模型）
   */
  private getProvider(modelConfigId?: string): Provider {
    const id = modelConfigId || this.configStore.getDefaultModelId() || DEFAULT_MODEL_CONFIG_ID
    const config = this.configStore.getModel(id)
    if (!config) throw new Error(`未找到模型配置: ${id}`)
    return this.providerManager.createProvider(config)
  }

  /**
   * 将复杂任务分解为子任务列表 — 委托给 SDK LLMPlanner.decompose
   */
  async decompose(task: string, modelConfigId?: string): Promise<SubTask[]> {
    const provider = this.getProvider(modelConfigId)
    const planner = new LLMPlanner(provider)

    const sdkSubtasks = await planner.decompose(task)
    return sdkSubtasks.map(toAELASubTask)
  }

  /**
   * 生成执行计划（包含依赖关系）— 委托给 SDK LLMPlanner.generatePlan
   */
  async generatePlan(task: string, modelConfigId?: string): Promise<Plan> {
    const provider = this.getProvider(modelConfigId)
    const planner = new LLMPlanner(provider)

    const sdkPlan = await planner.generatePlan(task)
    return toAELAPlan(sdkPlan)
  }

  /**
   * 获取可执行的子任务（依赖已完成的）
   */
  getExecutableTasks(plan: Plan): SubTask[] {
    return plan.subtasks.filter(t => {
      if (t.status !== 'pending') return false
      // 检查所有依赖是否已完成
      return t.dependsOn.every(depId => {
        const dep = plan.subtasks.find(s => s.id === depId)
        return dep && dep.status === 'completed'
      })
    })
  }

  /**
   * 更新子任务状态
   */
  updateTaskStatus(plan: Plan, taskId: string, status: TaskStatus, result?: string): Plan {
    const updated = { ...plan, subtasks: [...plan.subtasks] }
    const idx = updated.subtasks.findIndex(t => t.id === taskId)
    if (idx >= 0) {
      updated.subtasks[idx] = {
        ...updated.subtasks[idx],
        status,
        result: result ?? updated.subtasks[idx].result,
      }
    }
    return updated
  }

  /**
   * 检查计划是否全部完成
   */
  isPlanComplete(plan: Plan): boolean {
    return plan.subtasks.every(t => t.status === 'completed' || t.status === 'failed')
  }

  /**
   * 获取计划进度
   */
  getProgress(plan: Plan): { total: number; completed: number; failed: number; pending: number; running: number } {
    let completed = 0, failed = 0, pending = 0, running = 0
    for (const t of plan.subtasks) {
      switch (t.status) {
        case 'completed': completed++; break
        case 'failed': failed++; break
        case 'pending': pending++; break
        case 'running': running++; break
      }
    }
    return { total: plan.subtasks.length, completed, failed, pending, running }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
