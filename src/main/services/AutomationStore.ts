// 自动化任务持久化服务
// 使用 electron-store 存储任务定义和执行历史

import Store from 'electron-store'
import { randomUUID } from 'crypto'
import type { AutomationTask, AutomationRunRecord } from '@shared/types'

interface AutomationStoreSchema {
  tasks: AutomationTask[]
  runs: AutomationRunRecord[]
}

export class AutomationStore {
  private store: Store<AutomationStoreSchema>

  constructor() {
    this.store = new Store<AutomationStoreSchema>({
      name: 'aela-automation',
      defaults: {
        tasks: [],
        runs: []
      }
    })
  }

  // ===== 任务 CRUD =====
  listTasks(): AutomationTask[] {
    return this.store.get('tasks', []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getTask(id: string): AutomationTask | undefined {
    return this.store.get('tasks', []).find(t => t.id === id)
  }

  createTask(params: {
    name: string
    description?: string
    prompt: string
    trigger?: AutomationTask['trigger']
  }): AutomationTask {
    const now = new Date().toISOString()
    const task: AutomationTask = {
      id: randomUUID(),
      name: params.name,
      description: params.description || '',
      prompt: params.prompt,
      trigger: params.trigger || { type: 'manual' },
      status: 'idle',
      lastRunAt: null,
      lastRunDuration: null,
      lastError: null,
      runCount: 0,
      createdAt: now,
      updatedAt: now
    }

    const tasks = this.store.get('tasks', [])
    tasks.push(task)
    this.store.set('tasks', tasks)
    return task
  }

  updateTask(id: string, partial: Partial<AutomationTask>): AutomationTask | undefined {
    const tasks = this.store.get('tasks', [])
    const idx = tasks.findIndex(t => t.id === id)
    if (idx < 0) return undefined
    tasks[idx] = {
      ...tasks[idx],
      ...partial,
      id: tasks[idx].id,
      updatedAt: new Date().toISOString()
    }
    this.store.set('tasks', tasks)
    return tasks[idx]
  }

  deleteTask(id: string): boolean {
    const tasks = this.store.get('tasks', []).filter(t => t.id !== id)
    this.store.set('tasks', tasks)
    // 清理关联执行历史
    const runs = this.store.get('runs', []).filter(r => r.taskId !== id)
    this.store.set('runs', runs)
    return true
  }

  // ===== 执行历史 =====
  recordRun(record: AutomationRunRecord): void {
    const runs = this.store.get('runs', [])
    runs.push(record)
    // 仅保留最近 200 条
    if (runs.length > 200) {
      runs.splice(0, runs.length - 200)
    }
    this.store.set('runs', runs)
  }

  getRuns(taskId: string, limit: number = 20): AutomationRunRecord[] {
    const runs = this.store.get('runs', [])
    return runs
      .filter(r => r.taskId === taskId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
  }
}
