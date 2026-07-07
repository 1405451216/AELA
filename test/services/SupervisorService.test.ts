import { describe, it, expect, beforeEach } from 'vitest'
import { SupervisorService } from '../../src/main/services/SupervisorService'
import { TaskBoard } from '../../src/main/services/TaskBoard'
import { AgentBus } from '../../src/main/services/AgentBus'
import type { WorkerAgent, ConfigStore, ProviderManager } from '@shared/types'

describe('SupervisorService - Session & Delegation', () => {
  let supervisor: SupervisorService
  let taskBoard: TaskBoard
  let agentBus: AgentBus

  const mockConfigStore = {
    getModel: () => null,
    getConfig: () => ({ maxTurns: 10, maxMessages: 100, defaultSystemPrompt: 'test' }),
  } as unknown as ConfigStore

  const mockProviderManager = {
    createProvider: () => ({}),
  } as unknown as ProviderManager

  beforeEach(() => {
    supervisor = new SupervisorService(mockConfigStore, mockProviderManager, null)
    taskBoard = new TaskBoard()
    agentBus = new AgentBus()
    supervisor.setTaskBoard(taskBoard)
    supervisor.setAgentBus(agentBus)
  })

  const makeWorkers = (count: number): WorkerAgent[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `worker-${i}`,
      name: `Worker ${i}`,
      role: (['coder', 'reviewer', 'tester', 'researcher'] as const)[i % 4],
      skills: [],
      available: true,
    }))
  }

  describe('startSession', () => {
    it('创建 Session 并返回完整结构', () => {
      const workers = makeWorkers(2)
      const session = supervisor.startSession('实现认证模块', workers)

      expect(session.id).toBeTruthy()
      expect(session.goal).toBe('实现认证模块')
      expect(session.workers).toHaveLength(2)
      expect(session.status).toBe('planning')
      expect(session.tasks).toHaveLength(1)
    })

    it('注册 Workers 到 AgentBus', () => {
      const workers = makeWorkers(2)
      supervisor.startSession('test', workers)

      expect(agentBus.getRegisteredAgents()).toContain(workers[0].id)
      expect(agentBus.getRegisteredAgents()).toContain(workers[1].id)
    })

    it('创建根任务到 TaskBoard', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('实现功能', workers)

      expect(session.tasks).toHaveLength(1)
      expect(session.tasks[0].description).toBe('实现功能')
    })

    it('空 Workers 抛出错误', () => {
      expect(() => supervisor.startSession('test', [])).toThrow('至少需要 1 个 Worker')
    })

    it('超过 5 个 Worker 抛出错误', () => {
      const workers = makeWorkers(6)
      expect(() => supervisor.startSession('test', workers)).toThrow('每个会话最多 5 个')
    })

    it('支持预算配置', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers, {
        maxTokens: 50000,
        maxDurationMs: 60000,
      })

      expect(session.budget).toBeDefined()
      expect(session.budget!.maxTokens).toBe(50000)
      expect(session.budget!.maxDurationMs).toBe(60000)
    })
  })

  describe('getSession', () => {
    it('获取存在的 Session', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers)

      const retrieved = supervisor.getSession(session.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(session.id)
    })

    it('不存在的 Session 返回 null', () => {
      expect(supervisor.getSession('nonexistent')).toBeNull()
    })
  })

  describe('stopSession', () => {
    it('停止并删除 Session', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers)

      expect(supervisor.stopSession(session.id)).toBe(true)
      expect(supervisor.getSession(session.id)).toBeNull()
    })

    it('注销 Workers', () => {
      const workers = makeWorkers(2)
      const session = supervisor.startSession('test', workers)

      supervisor.stopSession(session.id)
      expect(agentBus.getRegisteredAgents()).not.toContain(workers[0].id)
      expect(agentBus.getRegisteredAgents()).not.toContain(workers[1].id)
    })

    it('不存在的 Session 返回 false', () => {
      expect(supervisor.stopSession('nonexistent')).toBe(false)
    })
  })

  describe('delegate', () => {
    it('委派任务给 Workers', () => {
      const workers = makeWorkers(3)
      const session = supervisor.startSession('test', workers)

      const results = supervisor.delegate('实现功能', workers, session.id)
      expect(results).toHaveLength(3)
      expect(results[0].taskId).toBeTruthy()
      expect(results[0].assignedTo).toBeTruthy()
    })

    it('创建任务到 TaskBoard', () => {
      const workers = makeWorkers(2)
      const session = supervisor.startSession('test', workers)

      supervisor.delegate('子任务', workers, session.id)
      const tasks = taskBoard.getTasks()
      expect(tasks.length).toBeGreaterThan(1)
    })

    it('发送消息到 AgentBus', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers)

      supervisor.delegate('任务', workers, session.id)
      const messages = agentBus.getMessages(workers[0].id)
      expect(messages).toHaveLength(1)
      expect(messages[0].type).toBe('request')
    })

    it('无可用 Worker 抛出错误', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers)

      expect(() =>
        supervisor.delegate('任务', [{ ...workers[0], available: false }], session.id)
      ).toThrow('没有可用的 Worker')
    })

    it('不存在的 Session 抛出错误', () => {
      const workers = makeWorkers(1)
      expect(() => supervisor.delegate('任务', workers, 'nonexistent')).toThrow('会话不存在')
    })
  })

  describe('collect', () => {
    it('聚合 Worker 输出', () => {
      const workers = makeWorkers(2)
      const session = supervisor.startSession('test', workers)
      supervisor.delegate('任务', workers, session.id)

      const tasks = taskBoard.getTasks()
      const taskIds = tasks.filter(t => t.description === '任务').map(t => t.id)

      const result = supervisor.collect([
        { taskId: taskIds[0], workerId: workers[0].id, output: '输出 A', tokensUsed: 100 },
        { taskId: taskIds[1], workerId: workers[1].id, output: '输出 B', tokensUsed: 150 },
      ])

      expect(result.aggregated).toContain('输出 A')
      expect(result.aggregated).toContain('输出 B')
      expect(result.totalTokens).toBe(250)
    })

    it('更新 TaskBoard 任务状态', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers)
      supervisor.delegate('任务', workers, session.id)

      const tasks = taskBoard.getTasks()
      const taskId = tasks.find(t => t.description === '任务')!.id

      supervisor.collect([{ taskId, workerId: workers[0].id, output: 'done', tokensUsed: 50 }])

      const updatedTask = taskBoard.getTask(taskId)
      expect(updatedTask!.status).toBe('completed')
      expect(updatedTask!.progress).toBe(100)
    })

    it('更新预算使用', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers, {
        maxTokens: 1000,
        maxDurationMs: 60000,
      })
      supervisor.delegate('任务', workers, session.id)

      const tasks = taskBoard.getTasks()
      const taskId = tasks.find(t => t.description === '任务')!.id

      supervisor.collect([{ taskId, workerId: workers[0].id, output: 'done', tokensUsed: 500 }])

      const updated = supervisor.getSession(session.id)
      expect(updated!.budget!.usedTokens).toBe(500)
    })
  })

  describe('resolveConflict', () => {
    it('majority 策略返回第一个选项', () => {
      const result = supervisor.resolveConflict('task-1', ['方案 A', '方案 B', '方案 C'], 'majority')
      expect(result).toBe('方案 A')
    })

    it('supervisor_pick 策略返回选中选项', () => {
      const result = supervisor.resolveConflict('task-1', ['方案 A', '方案 B', '方案 C'], 'supervisor_pick', 1)
      expect(result).toBe('方案 B')
    })

    it('supervisor_pick 无效索引抛出错误', () => {
      expect(() => supervisor.resolveConflict('task-1', ['A', 'B'], 'supervisor_pick', 5)).toThrow('有效的 selectedOption')
    })

    it('merge 策略合并所有选项', () => {
      const result = supervisor.resolveConflict('task-1', ['方案 A', '方案 B'], 'merge')
      expect(result).toContain('方案 A')
      expect(result).toContain('方案 B')
    })

    it('retry 策略返回重试标记', () => {
      const result = supervisor.resolveConflict('task-1', ['A'], 'retry')
      expect(result).toBe('__retry__:task-1')
    })

    it('空选项抛出错误', () => {
      expect(() => supervisor.resolveConflict('task-1', [], 'majority')).toThrow('至少一个选项')
    })
  })

  describe('checkBudget', () => {
    it('返回预算状态', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers, {
        maxTokens: 1000,
        maxDurationMs: 60000,
      })

      const budget = supervisor.checkBudget(session.id)
      expect(budget).not.toBeNull()
      expect(budget!.withinBudget).toBe(true)
      expect(budget!.tokensMax).toBe(1000)
    })

    it('无预算的 Session 返回 null', () => {
      const workers = makeWorkers(1)
      const session = supervisor.startSession('test', workers)
      expect(supervisor.checkBudget(session.id)).toBeNull()
    })
  })

  describe('listSessions', () => {
    it('返回所有 Session', () => {
      supervisor.startSession('goal-1', makeWorkers(1))
      supervisor.startSession('goal-2', makeWorkers(1))

      expect(supervisor.listSessions()).toHaveLength(2)
    })
  })

  describe('stop', () => {
    it('不抛错', () => {
      expect(() => supervisor.stop()).not.toThrow()
    })
  })
})
