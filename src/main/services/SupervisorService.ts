// Supervisor 监督者模式
// 移植自 AP Go 核心层 orchestration/supervisor.go
// 支持: Worker 池管理 / 任务分配策略(轮询/负载均衡/技能匹配) / 优先级队列 / 并发控制

import type {
  SupervisorWorker,
  SupervisorTask,
  SupervisorTaskResult,
  SupervisorStats,
  AssignmentStrategy,
  SupervisorSession,
  WorkerAgent,
  WorkerRole,
  ConflictResolution,
  MultiAgentTask,
} from '@shared/types'
import type { TaskBoard } from './TaskBoard'
import type { AgentBus } from './AgentBus'
import type { Provider } from '@agentprimordia/sdk'
import { ReActAgent, HookManager, Lifecycle, ToolRegistry } from '@agentprimordia/sdk'
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'
import type { ToolManager } from './ToolManager'
import { randomUUID } from 'crypto'

// ===== 内部 Worker 状态 =====

interface WorkerState {
  id: string
  name: string
  skills: string[]
  maxConcurrency: number
  activeTasks: number
  totalCompleted: number
  totalFailed: number
  available: boolean
  modelConfigId: string
  systemPrompt: string

  // 运行时
  skillSet: Set<string>
}

// ===== 任务分配策略 =====

interface AssignmentStrategyInterface {
  name: string
  select(task: SupervisorTask, workers: WorkerState[]): WorkerState | null
}

class RoundRobinStrategy implements AssignmentStrategyInterface {
  name = 'round_robin'
  private index = 0

  select(_task: SupervisorTask, workers: WorkerState[]): WorkerState | null {
    const available = workers.filter(w => w.available && w.activeTasks < w.maxConcurrency)
    if (available.length === 0) return null
    const idx = this.index % available.length
    this.index++
    return available[idx]
  }
}

class LoadBalancedStrategy implements AssignmentStrategyInterface {
  name = 'load_balanced'

  select(_task: SupervisorTask, workers: WorkerState[]): WorkerState | null {
    const available = workers.filter(w => w.available && w.activeTasks < w.maxConcurrency)
    if (available.length === 0) return null
    let best = available[0]
    for (const w of available) {
      if (w.activeTasks < best.activeTasks) best = w
    }
    return best
  }
}

class SkillBasedStrategy implements AssignmentStrategyInterface {
  name = 'skill_based'

  select(task: SupervisorTask, workers: WorkerState[]): WorkerState | null {
    const available = workers.filter(w => w.available && w.activeTasks < w.maxConcurrency)
    if (available.length === 0) return null

    if (!task.requiredSkills || task.requiredSkills.length === 0) {
      // 无技能要求, 回退到负载均衡
      let best = available[0]
      for (const w of available) {
        if (w.activeTasks < best.activeTasks) best = w
      }
      return best
    }

    // 匹配技能
    const scored = available.map(w => {
      let score = 0
      for (const skill of task.requiredSkills!) {
        if (w.skillSet.has(skill.toLowerCase())) score++
      }
      return { worker: w, score }
    })

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.worker.activeTasks - b.worker.activeTasks
    })

    return scored[0].score > 0 ? scored[0].worker : null
  }
}

// ===== Supervisor 服务 =====

export class SupervisorService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private toolManager: ToolManager | null = null

  private workers: Map<string, WorkerState> = new Map()
  private taskQueue: Array<{ task: SupervisorTask; resolve: (result: SupervisorTaskResult) => void; reject: (err: Error) => void }> = []
  private strategy: AssignmentStrategyInterface
  private strategyType: AssignmentStrategy = 'load_balanced'
  private running = false
  private processing = false
  private sessions: Map<string, SupervisorSession> = new Map()
  private taskBoard: TaskBoard | null = null
  private agentBus: AgentBus | null = null
  private readonly maxWorkersPerSession = 5
  private readonly workerTaskTimeoutMs = 30000

  constructor(configStore: ConfigStore, providerManager: ProviderManager, toolManager: ToolManager | null) {
    this.configStore = configStore
    this.providerManager = providerManager
    this.toolManager = toolManager
    this.strategy = new LoadBalancedStrategy()
  }

  setTaskBoard(tb: TaskBoard): void {
    this.taskBoard = tb
  }

  setAgentBus(bus: AgentBus): void {
    this.agentBus = bus
  }

setToolManager(tm: ToolManager): void {
this.toolManager = tm
}

  setStrategy(type: AssignmentStrategy): void {
    this.strategyType = type
    switch (type) {
      case 'round_robin':
        this.strategy = new RoundRobinStrategy()
        break
      case 'load_balanced':
        this.strategy = new LoadBalancedStrategy()
        break
      case 'skill_based':
        this.strategy = new SkillBasedStrategy()
        break
    }
  }

  getStrategy(): AssignmentStrategy {
    return this.strategyType
  }

  /**
   * 添加 Worker
   */
  addWorker(worker: {
    id?: string
    name: string
    skills?: string[]
    maxConcurrency?: number
    modelConfigId: string
    systemPrompt?: string
  }): SupervisorWorker {
    const id = worker.id || randomUUID()
    const skills = worker.skills ?? []
    const state: WorkerState = {
      id,
      name: worker.name,
      skills,
      maxConcurrency: worker.maxConcurrency ?? 5,
      activeTasks: 0,
      totalCompleted: 0,
      totalFailed: 0,
      available: true,
      modelConfigId: worker.modelConfigId,
      systemPrompt: worker.systemPrompt ?? '',
      skillSet: new Set(skills.map(s => s.toLowerCase())),
    }
    this.workers.set(id, state)
    return this.toWorkerInfo(state)
  }

  /**
   * 移除 Worker
   */
  removeWorker(id: string): boolean {
    const worker = this.workers.get(id)
    if (!worker) return false
    worker.available = false
    this.workers.delete(id)
    return true
  }

  /**
   * 列出所有 Worker
   */
  listWorkers(): SupervisorWorker[] {
    return Array.from(this.workers.values()).map(w => this.toWorkerInfo(w))
  }

  /**
   * 提交任务 (异步, 返回 Promise)
   */
  async submitTask(task: Omit<SupervisorTask, 'id'>): Promise<SupervisorTaskResult> {
    const fullTask: SupervisorTask = {
      ...task,
      id: randomUUID(),
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({ task: fullTask, resolve, reject })
      // 按优先级排序 (高优先级在前)
      this.taskQueue.sort((a, b) => b.task.priority - a.task.priority)
      this.processQueue()
    })
  }

  /**
   * 获取统计信息
   */
  getStats(): SupervisorStats {
    const workers = Array.from(this.workers.values())
    return {
      totalWorkers: workers.length,
      availableWorkers: workers.filter(w => w.available).length,
      activeTasks: workers.reduce((sum, w) => sum + w.activeTasks, 0),
      totalCompleted: workers.reduce((sum, w) => sum + w.totalCompleted, 0),
      totalFailed: workers.reduce((sum, w) => sum + w.totalFailed, 0),
      queueLength: this.taskQueue.length,
    }
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.taskQueue.length > 0) {
      const workers = Array.from(this.workers.values())
      const item = this.taskQueue[0]

      const worker = this.strategy.select(item.task, workers)
      if (!worker) {
        // 没有可用 worker, 等待
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }

      this.taskQueue.shift()
      worker.activeTasks++

      // 异步执行任务
      this.executeTask(worker, item.task)
        .then(result => {
          item.resolve(result)
          if (result.status === 'completed') {
            worker.totalCompleted++
          } else {
            worker.totalFailed++
          }
        })
        .catch(err => {
          item.reject(err)
          worker.totalFailed++
        })
        .finally(() => {
          worker.activeTasks--
        })
    }

    this.processing = false
  }

  /**
   * 在 Worker 上执行任务
   */
  private async executeTask(worker: WorkerState, task: SupervisorTask): Promise<SupervisorTaskResult> {
    const startTime = Date.now()
    const modelConfig = this.configStore.getModel(worker.modelConfigId)
    if (!modelConfig) {
      return {
        workerId: worker.id,
        taskId: task.id,
        status: 'failed',
        error: `未找到模型配置: ${worker.modelConfigId}`,
        duration: Date.now() - startTime,
      }
    }

    const provider: Provider = this.providerManager.createProvider(modelConfig)
    const appConfig = this.configStore.getConfig()
    const hooks = new HookManager()
    const lifecycle = new Lifecycle()
    const toolkit = this.toolManager?.getRegistry() ?? new ToolRegistry()

    const agent = new ReActAgent({
      name: worker.name,
      model: provider,
      toolkit,
      maxTurns: appConfig.maxTurns,
      maxMessages: appConfig.maxMessages,
      systemPrompt: worker.systemPrompt || appConfig.defaultSystemPrompt,
      hooks,
      lifecycle,
    })

    // 构造输入
    const input = task.payload.input as string || task.payload.prompt as string || JSON.stringify(task.payload)

    try {
      let content = ''
      for await (const event of agent.streamEvents(input)) {
        if (event.type === 'token') {
          content += event.content
        }
      }

      return {
        workerId: worker.id,
        taskId: task.id,
        status: 'completed',
        output: { content },
        duration: Date.now() - startTime,
      }
    } catch (err: unknown) {
      return {
        workerId: worker.id,
        taskId: task.id,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - startTime,
      }
    }
  }

  private toWorkerInfo(w: WorkerState): SupervisorWorker {
    return {
      id: w.id,
      name: w.name,
      skills: w.skills,
      maxConcurrency: w.maxConcurrency,
      activeTasks: w.activeTasks,
      totalCompleted: w.totalCompleted,
      totalFailed: w.totalFailed,
      available: w.available,
    }
  }

  startSession(goal: string, workers: WorkerAgent[], budget?: { maxTokens: number; maxDurationMs: number }): SupervisorSession {
    if (workers.length === 0) {
      throw new Error('至少需要 1 个 Worker Agent')
    }
    if (workers.length > this.maxWorkersPerSession) {
      throw new Error(`每个会话最多 ${this.maxWorkersPerSession} 个 Worker Agent`)
    }

    const session: SupervisorSession = {
      id: randomUUID(),
      goal,
      workers: workers.map(w => ({ ...w })),
      tasks: [],
      status: 'planning',
      budget: budget ? {
        maxTokens: budget.maxTokens,
        usedTokens: 0,
        maxDurationMs: budget.maxDurationMs,
        startedAt: new Date().toISOString(),
      } : undefined,
    }

    this.sessions.set(session.id, session)

    if (this.agentBus) {
      for (const worker of workers) {
        this.agentBus.registerAgent(worker.id, worker.role)
      }
    }

    if (this.taskBoard) {
      const rootTask = this.taskBoard.createTask(goal) as unknown as MultiAgentTask
      session.tasks.push(rootTask)
    }

    return { ...session, workers: session.workers.map(w => ({ ...w })), tasks: [...session.tasks] }
  }

  getSession(sessionId: string): SupervisorSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    let tasks = session.tasks
    if (this.taskBoard) {
      tasks = this.taskBoard.getTasks()
    }

    return {
      ...session,
      workers: session.workers.map(w => ({ ...w })),
      tasks,
    }
  }

  listSessions(): SupervisorSession[] {
    return Array.from(this.sessions.values()).map(s => ({
      ...s,
      workers: s.workers.map(w => ({ ...w })),
      tasks: s.tasks.map(t => ({ ...t })),
    }))
  }

  stopSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    if (session.budget) {
      const elapsed = Date.now() - new Date(session.budget.startedAt).getTime()
      if (elapsed > session.budget.maxDurationMs) {
        session.status = 'completed'
      }
    }

    session.status = 'completed'

    if (this.agentBus) {
      for (const worker of session.workers) {
        this.agentBus.unregisterAgent(worker.id)
      }
    }

    return this.sessions.delete(sessionId)
  }

  delegate(taskDescription: string, workerAgents: WorkerAgent[], sessionId?: string): { taskId: string; assignedTo: string }[] {
    if (this.workerTaskTimeoutMs <= 0) {
      throw new Error('Worker 任务超时配置无效')
    }

    const results: { taskId: string; assignedTo: string }[] = []

    if (this.taskBoard && sessionId) {
      const session = this.sessions.get(sessionId)
      if (!session) throw new Error(`会话不存在: ${sessionId}`)
      session.status = 'executing'
    }

    const availableWorkers = this.workers.size > 0
      ? Array.from(this.workers.values()).filter(w => w.available && w.activeTasks < w.maxConcurrency)
      : workerAgents.filter(w => w.available)

    if (availableWorkers.length === 0) {
      throw new Error('没有可用的 Worker')
    }

    for (let i = 0; i < workerAgents.length; i++) {
      const worker = workerAgents[i]
      const assignedWorker = availableWorkers[i % availableWorkers.length]

      let taskId: string
      if (this.taskBoard) {
        const task = this.taskBoard.createTask(taskDescription, assignedWorker.id)
        taskId = task.id
      } else {
        taskId = randomUUID()
      }

      results.push({ taskId, assignedTo: assignedWorker.id })

      if (this.agentBus) {
        if (!this.agentBus.getRegisteredAgents().includes('supervisor')) {
          this.agentBus.registerAgent('supervisor')
        }
        this.agentBus.sendMessage(
          'supervisor',
          worker.id,
          { taskId, description: taskDescription, timeout: this.workerTaskTimeoutMs },
          'request'
        )
      }

      const workerState = this.workers.get(assignedWorker.id)
      if (workerState) {
        workerState.activeTasks++
      }
    }

    return results
  }

  collect(results: Array<{ taskId: string; workerId: string; output: string; tokensUsed: number }>): { aggregated: string; totalTokens: number } {
    if (this.taskBoard) {
      for (const r of results) {
        this.taskBoard.updateTask(r.taskId, {
          status: 'completed',
          progress: 100,
          result: r.output,
          assignedAgent: r.workerId,
        })
      }
    }

    for (const session of this.sessions.values()) {
      if (session.budget) {
        session.budget.usedTokens += results.reduce((sum, r) => sum + r.tokensUsed, 0)
        if (session.budget.usedTokens > session.budget.maxTokens) {
          session.status = 'reviewing'
        }
      }
    }

    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0)
    const aggregated = results.map(r => {
      const worker = this.workers.get(r.workerId)
      const workerName = worker?.name ?? r.workerId
      return `[${workerName}]\n${r.output}`
    }).join('\n\n---\n\n')

    for (const session of this.sessions.values()) {
      if (session.status === 'executing') {
        const allCompleted = session.tasks.every(t => t.status === 'completed' || t.status === 'failed')
        if (allCompleted && session.tasks.length > 0) {
          session.status = 'reviewing'
        }
      }
    }

    return { aggregated, totalTokens }
  }

  resolveConflict(taskId: string, options: string[], strategy: ConflictResolution['strategy'] = 'majority', selectedOption?: number): string {
    if (options.length === 0) {
      throw new Error('冲突解决需要至少一个选项')
    }

    let result: string

    switch (strategy) {
      case 'majority':
        result = options[0]
        break

      case 'supervisor_pick':
        if (selectedOption === undefined || selectedOption < 0 || selectedOption >= options.length) {
          throw new Error('supervisor_pick 需要有效的 selectedOption')
        }
        result = options[selectedOption]
        break

      case 'merge':
        result = options.map((opt, i) => `方案 ${i + 1}:\n${opt}`).join('\n\n')
        break

      case 'retry':
        result = `__retry__:${taskId}`
        break

      default:
        result = options[0]
    }

    if (this.taskBoard) {
      this.taskBoard.updateTask(taskId, {
        status: 'in_progress',
        result: `已解决冲突 (${strategy}): ${result.slice(0, 100)}`,
      })
    }

    return result
  }

  checkBudget(sessionId: string): { withinBudget: boolean; tokensUsed: number; tokensMax: number; timeRemainingMs: number } | null {
    const session = this.sessions.get(sessionId)
    if (!session || !session.budget) return null

    const elapsed = Date.now() - new Date(session.budget.startedAt).getTime()
    const timeRemaining = Math.max(0, session.budget.maxDurationMs - elapsed)

    return {
      withinBudget: session.budget.usedTokens < session.budget.maxTokens,
      tokensUsed: session.budget.usedTokens,
      tokensMax: session.budget.maxTokens,
      timeRemainingMs: timeRemaining,
    }
  }

  getWorkerCount(): number {
    return this.workers.size
  }

  /** 生命周期停止方法：无操作 */
  stop(): void {
    for (const [, worker] of this.workers) {
      worker.available = false
    }
    this.running = false
  }
}
