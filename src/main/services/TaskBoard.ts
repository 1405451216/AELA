import type { MultiAgentTask as Task, MultiAgentTaskStatus as TaskStatus, MultiAgentTaskFilter as TaskFilter } from '@shared/types'
import { randomUUID } from 'crypto'

export class TaskBoard {
  private tasks: Map<string, Task> = new Map()
  private dependencyGraph: Map<string, Set<string>> = new Map()

  createTask(
    description: string,
    assignedAgent?: string,
    dependencies: string[] = []
  ): Task {
    if (dependencies.length > 0) {
      this.validateDependencies(dependencies)
    }

    const now = new Date().toISOString()
    const task: Task = {
      id: randomUUID(),
      description,
      assignedAgent,
      status: 'pending',
      progress: 0,
      dependencies: [...dependencies],
      createdAt: now,
      updatedAt: now,
    }

    this.tasks.set(task.id, task)
    this.dependencyGraph.set(task.id, new Set(dependencies))

    return { ...task }
  }

  updateTask(taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Task | null {
    const task = this.tasks.get(taskId)
    if (!task) return null

    const updated: Task = {
      ...task,
      ...updates,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: new Date().toISOString(),
    }

    if (updates.status === 'in_progress' && task.status === 'pending') {
      updated.assignedAgent = updates.assignedAgent ?? task.assignedAgent
    }

    if (updates.progress !== undefined) {
      updated.progress = Math.max(0, Math.min(100, updates.progress))
    }

    this.tasks.set(taskId, updated)
    return { ...updated }
  }

  getTask(taskId: string): Task | null {
    const task = this.tasks.get(taskId)
    return task ? { ...task } : null
  }

  getTasks(filter?: TaskFilter): Task[] {
    let result = Array.from(this.tasks.values())

    if (filter?.agentId) {
      result = result.filter(t => t.assignedAgent === filter.agentId)
    }
    if (filter?.status) {
      result = result.filter(t => t.status === filter.status)
    }

    return result.map(t => ({ ...t }))
  }

  deleteTask(taskId: string): boolean {
    if (!this.tasks.has(taskId)) return false

    for (const [id, deps] of this.dependencyGraph) {
      if (deps.has(taskId) && id !== taskId) {
        return false
      }
    }

    this.tasks.delete(taskId)
    this.dependencyGraph.delete(taskId)

    for (const [, deps] of this.dependencyGraph) {
      deps.delete(taskId)
    }

    return true
  }

  getDependents(taskId: string): string[] {
    const dependents: string[] = []
    for (const [id, deps] of this.dependencyGraph) {
      if (deps.has(taskId)) {
        dependents.push(id)
      }
    }
    return dependents
  }

  checkDependenciesSatisfied(taskId: string): boolean {
    const deps = this.dependencyGraph.get(taskId)
    if (!deps || deps.size === 0) return true

    for (const depId of deps) {
      const depTask = this.tasks.get(depId)
      if (!depTask || depTask.status !== 'completed') {
        return false
      }
    }
    return true
  }

  getReadyTasks(): Task[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status === 'pending' && this.checkDependenciesSatisfied(t.id))
      .map(t => ({ ...t }))
  }

  validateDAG(): { valid: boolean; cycles: string[][] } {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId)
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(nodeId))
        }
        return false
      }

      if (visited.has(nodeId)) return true

      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)

      const deps = this.dependencyGraph.get(nodeId)
      if (deps) {
        for (const depId of deps) {
          if (!dfs(depId, [...path])) {
            return false
          }
        }
      }

      recursionStack.delete(nodeId)
      return true
    }

    let valid = true
    for (const taskId of this.tasks.keys()) {
      if (!visited.has(taskId)) {
        if (!dfs(taskId, [])) {
          valid = false
        }
      }
    }

    return { valid, cycles }
  }

  getDependencyChain(taskId: string): string[] {
    const chain: string[] = []
    const visited = new Set<string>()

    const traverse = (id: string): void => {
      if (visited.has(id)) return
      visited.add(id)
      const deps = this.dependencyGraph.get(id)
      if (deps) {
        for (const depId of deps) {
          traverse(depId)
        }
      }
      chain.push(id)
    }

    traverse(taskId)
    return chain
  }

  getStats(): { total: number; byStatus: Record<string, number>; avgProgress: number } {
    const all = Array.from(this.tasks.values())
    const byStatus: Record<string, number> = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    }

    let totalProgress = 0
    for (const task of all) {
      byStatus[task.status] = (byStatus[task.status] || 0) + 1
      totalProgress += task.progress
    }

    return {
      total: all.length,
      byStatus,
      avgProgress: all.length > 0 ? totalProgress / all.length : 0,
    }
  }

  clear(): void {
    this.tasks.clear()
    this.dependencyGraph.clear()
  }

  stop(): void {
    this.clear()
  }

  private validateDependencies(dependencies: string[]): void {
    for (const depId of dependencies) {
      if (!this.tasks.has(depId)) {
        throw new Error(`依赖任务不存在: ${depId}`)
      }
    }

    for (const depId of dependencies) {
      const existingTask = this.tasks.get(depId)!
      if (existingTask.dependencies.includes(depId)) {
        throw new Error(`循环依赖检测: ${depId}`)
      }
    }
  }
}
