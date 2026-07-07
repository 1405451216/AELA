import { describe, it, expect, beforeEach } from 'vitest'
import { TaskBoard } from '../../src/main/services/TaskBoard'
import type { MultiAgentTaskStatus as TaskStatus } from '@shared/types'

describe('TaskBoard', () => {
  let board: TaskBoard

  beforeEach(() => {
    board = new TaskBoard()
  })

  describe('createTask', () => {
    it('创建任务并返回完整结构', () => {
      const task = board.createTask('实现登录功能')

      expect(task.id).toBeTruthy()
      expect(task.description).toBe('实现登录功能')
      expect(task.status).toBe('pending')
      expect(task.progress).toBe(0)
      expect(task.dependencies).toEqual([])
      expect(task.createdAt).toBeTruthy()
      expect(task.updatedAt).toBeTruthy()
    })

    it('支持分配 Agent', () => {
      const task = board.createTask('审查代码', 'reviewer-1')
      expect(task.assignedAgent).toBe('reviewer-1')
    })

    it('支持依赖关系', () => {
      const dep = board.createTask('基础设置')
      const task = board.createTask('实现功能', undefined, [dep.id])
      expect(task.dependencies).toEqual([dep.id])
    })

    it('依赖不存在时抛出错误', () => {
      expect(() => board.createTask('test', undefined, ['nonexistent'])).toThrow('依赖任务不存在')
    })
  })

  describe('updateTask', () => {
    it('更新任务状态', async () => {
      const task = board.createTask('test')
      await new Promise(r => setTimeout(r, 5))
      const updated = board.updateTask(task.id, { status: 'in_progress', progress: 50 })

      expect(updated).not.toBeNull()
      expect(updated!.status).toBe('in_progress')
      expect(updated!.progress).toBe(50)
      expect(updated!.updatedAt).not.toBe(task.updatedAt)
    })

    it('更新结果', () => {
      const task = board.createTask('test')
      const updated = board.updateTask(task.id, { result: '完成输出' })
      expect(updated!.result).toBe('完成输出')
    })

    it('进度值限制在 0-100', () => {
      const task = board.createTask('test')
      const updated = board.updateTask(task.id, { progress: 150 })
      expect(updated!.progress).toBe(100)

      const updated2 = board.updateTask(task.id, { progress: -10 })
      expect(updated2!.progress).toBe(0)
    })

    it('不存在的任务返回 null', () => {
      const result = board.updateTask('nonexistent', { status: 'completed' })
      expect(result).toBeNull()
    })
  })

  describe('getTasks', () => {
    it('返回所有任务', () => {
      board.createTask('task1')
      board.createTask('task2')
      board.createTask('task3')

      expect(board.getTasks()).toHaveLength(3)
    })

    it('按状态筛选', () => {
      const t1 = board.createTask('task1')
      const t2 = board.createTask('task2')
      board.updateTask(t1.id, { status: 'completed' })
      board.updateTask(t2.id, { status: 'in_progress' })

      const completed = board.getTasks({ status: 'completed' })
      expect(completed).toHaveLength(1)
      expect(completed[0].id).toBe(t1.id)
    })

    it('按 Agent 筛选', () => {
      board.createTask('task1', 'agent-a')
      board.createTask('task2', 'agent-b')
      board.createTask('task3', 'agent-a')

      const agentATasks = board.getTasks({ agentId: 'agent-a' })
      expect(agentATasks).toHaveLength(2)
    })
  })

  describe('deleteTask', () => {
    it('删除无依赖的任务', () => {
      const task = board.createTask('test')
      expect(board.deleteTask(task.id)).toBe(true)
      expect(board.getTask(task.id)).toBeNull()
    })

    it('有依赖时拒绝删除', () => {
      const dep = board.createTask('dependency')
      board.createTask('task', undefined, [dep.id])

      expect(board.deleteTask(dep.id)).toBe(false)
      expect(board.getTask(dep.id)).not.toBeNull()
    })
  })

  describe('dependency management', () => {
    it('检查依赖是否满足', () => {
      const dep = board.createTask('dependency')
      const task = board.createTask('task', undefined, [dep.id])

      expect(board.checkDependenciesSatisfied(task.id)).toBe(false)

      board.updateTask(dep.id, { status: 'completed' })
      expect(board.checkDependenciesSatisfied(task.id)).toBe(true)
    })

    it('获取就绪任务', () => {
      const dep = board.createTask('dependency')
      board.createTask('task1', undefined, [dep.id])
      board.createTask('task2')

      const ready = board.getReadyTasks()
      expect(ready).toHaveLength(2)

      board.updateTask(dep.id, { status: 'completed' })
      const readyAfter = board.getReadyTasks()
      expect(readyAfter).toHaveLength(2)
    })

    it('获取依赖者列表', () => {
      const dep = board.createTask('dependency')
      board.createTask('task1', undefined, [dep.id])
      board.createTask('task2', undefined, [dep.id])

      const dependents = board.getDependents(dep.id)
      expect(dependents).toHaveLength(2)
    })
  })

  describe('DAG validation', () => {
    it('无环图验证通过', () => {
      const t1 = board.createTask('step1')
      const t2 = board.createTask('step2', undefined, [t1.id])
      board.createTask('step3', undefined, [t2.id])

      const result = board.validateDAG()
      expect(result.valid).toBe(true)
      expect(result.cycles).toEqual([])
    })

    it('检测循环依赖', () => {
      const t1 = board.createTask('step1')
      const t2 = board.createTask('step2', undefined, [t1.id])
      const internalMap = (board as unknown as { dependencyGraph: Map<string, Set<string>> }).dependencyGraph
      internalMap.get(t1.id)!.add(t2.id)

      const result = board.validateDAG()
      expect(result.valid).toBe(false)
      expect(result.cycles.length).toBeGreaterThan(0)
    })
  })

  describe('getStats', () => {
    it('返回统计信息', () => {
      const t1 = board.createTask('task1')
      const t2 = board.createTask('task2')
      board.updateTask(t1.id, { status: 'completed', progress: 100 })
      board.updateTask(t2.id, { status: 'in_progress', progress: 50 })

      const stats = board.getStats()
      expect(stats.total).toBe(2)
      expect(stats.byStatus.completed).toBe(1)
      expect(stats.byStatus.in_progress).toBe(1)
      expect(stats.avgProgress).toBe(75)
    })
  })

  describe('getDependencyChain', () => {
    it('返回拓扑排序的依赖链', () => {
      const t1 = board.createTask('step1')
      const t2 = board.createTask('step2', undefined, [t1.id])
      const t3 = board.createTask('step3', undefined, [t2.id])

      const chain = board.getDependencyChain(t3.id)
      expect(chain.indexOf(t1.id)).toBeLessThan(chain.indexOf(t2.id))
      expect(chain.indexOf(t2.id)).toBeLessThan(chain.indexOf(t3.id))
    })
  })

  describe('clear', () => {
    it('清空所有任务', () => {
      board.createTask('task1')
      board.createTask('task2')
      board.clear()
      expect(board.getTasks()).toHaveLength(0)
    })
  })

  describe('stop', () => {
    it('不抛错', () => {
      board.createTask('task1')
      expect(() => board.stop()).not.toThrow()
      expect(board.getTasks()).toHaveLength(0)
    })
  })
})
