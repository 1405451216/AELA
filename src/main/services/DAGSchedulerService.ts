// DAG 依赖图调度服务
// 移植自 AP Go 核心层 orchestration/scheduler.go + plan.go
// 支持: 依赖图拓扑排序 / 并发执行 / 失败重试 / Fail-Fast / 条件分支
// [SDK 集成] 使用 SDK DAGBuilder/DAGWorkflow 提供节点级重试/超时/条件跳过能力

import { ReActAgent, HookManager, Lifecycle, A2ABus, DAGBuilder, type DAGResult, type DAGNodeResult } from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type {
  DAGConfig,
  DAGStep,
  OrchestrationEvent,
  OrchestrationStepResult,
  MessageMetrics,
} from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ToolManager } from './ToolManager'
import type { ConfigStore } from './ConfigStore'
import { ToolRegistry } from '@agentprimordia/sdk'
import { randomUUID } from 'crypto'

// ===== 依赖图 =====

interface StepNode {
  step: DAGStep
  inDegree: number
  outEdges: string[]
  inEdges: string[]
  result?: OrchestrationStepResult
  status: 'pending' | 'running' | 'completed' | 'failed'
}

class DependencyGraph {
  private nodes: Map<string, StepNode> = new Map()

  constructor(steps: DAGStep[], edges: Array<{ from: string; to: string }>) {
    for (const s of steps) {
      this.nodes.set(s.id, {
        step: s,
        inDegree: 0,
        outEdges: [],
        inEdges: [],
        status: 'pending',
      })
    }
    for (const e of edges) {
      const from = this.nodes.get(e.from)
      const to = this.nodes.get(e.to)
      if (from && to) {
        from.outEdges.push(e.to)
        to.inEdges.push(e.from)
        to.inDegree++
      }
    }
  }

  ready(stepId: string): boolean {
    return this.nodes.get(stepId)?.inDegree === 0
  }

  complete(stepId: string): string[] {
    const node = this.nodes.get(stepId)
    if (!node) return []
    const newlyReady: string[] = []
    for (const next of node.outEdges) {
      const nextNode = this.nodes.get(next)
      if (nextNode) {
        nextNode.inDegree--
        if (nextNode.inDegree === 0) {
          newlyReady.push(next)
        }
      }
    }
    return newlyReady
  }

  getNode(stepId: string): StepNode | undefined {
    return this.nodes.get(stepId)
  }

  getAllNodes(): StepNode[] {
    return Array.from(this.nodes.values())
  }

  getInitialReady(): string[] {
    return this.getAllNodes()
      .filter(n => n.inDegree === 0)
      .map(n => n.step.id)
  }

  hasCycle(): boolean {
    // Non-destructive Kahn's algorithm: work on a copy of inDegrees
    // so the original graph is not mutated
    const total = this.nodes.size
    if (total === 0) return false

    const inDegreeCopy = new Map<string, number>()
    for (const [id, node] of this.nodes) {
      inDegreeCopy.set(id, node.inDegree)
    }

    let processed = 0
    const queue: string[] = []
    for (const [id, deg] of inDegreeCopy) {
      if (deg === 0) queue.push(id)
    }

    while (queue.length > 0) {
      const id = queue.shift()!
      processed++
      const node = this.nodes.get(id)
      if (!node) continue
      for (const next of node.outEdges) {
        const newDeg = (inDegreeCopy.get(next) ?? 0) - 1
        inDegreeCopy.set(next, newDeg)
        if (newDeg === 0) queue.push(next)
      }
    }

    return processed < total
  }
}

// ===== DAG 调度器 =====

export class DAGSchedulerService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private toolManager: ToolManager | null
  private a2aBus: A2ABus
  private activeLifecycles: Map<string, Lifecycle> = new Map()

  constructor(
    configStore: ConfigStore,
    providerManager: ProviderManager,
    toolManager: ToolManager | null
  ) {
    this.configStore = configStore
    this.providerManager = providerManager
    this.toolManager = toolManager
    this.a2aBus = new A2ABus()
  }

setToolManager(tm: ToolManager): void {
this.toolManager = tm
}

  getA2ABus(): A2ABus {
    return this.a2aBus
  }

  /**
   * 运行 DAG 编排
   */
  async *run(config: DAGConfig): AsyncGenerator<OrchestrationEvent> {
    const startTime = Date.now()
    const results: OrchestrationStepResult[] = []
    const runId = config.id || randomUUID()
    const maxConcurrent = config.maxConcurrency ?? 5
    const failFast = config.failFast ?? false

    // 构建依赖图
    const graph = new DependencyGraph(config.steps, config.edges)

    // 检查环路
    if (graph.hasCycle()) {
      yield { type: 'error', error: 'DAG 中存在环, 无法执行' }
      return
    }

    // 就绪队列
    const readyQueue: string[] = graph.getInitialReady()
    let running = 0
    let failed = false
    const stepOutputs: Map<string, string> = new Map()
    stepOutputs.set('__initial__', config.input)

    // 事件驱动: 每次循环创建一个新的 deferred Promise
    // 当任意 step 完成时 resolve，避免忙轮询
    let stepDoneResolve: (() => void) | null = null
    const createDeferred = (): Promise<void> => {
      return new Promise<void>((resolve) => {
        stepDoneResolve = resolve
      })
    }

    // 执行循环
    while ((readyQueue.length > 0 || running > 0) && !failed) {
      // 启动就绪的 step (不超过并发限制)
      while (readyQueue.length > 0 && running < maxConcurrent && !failed) {
        const stepId = readyQueue.shift()!
        const node = graph.getNode(stepId)!
        node.status = 'running'
        running++

        const stepIndex = config.steps.findIndex(s => s.id === stepId)
        yield { type: 'step_start', agentName: node.step.name, stepIndex }

        // 异步执行 step — 用 async IIFE 正确捕获错误
        ;(async () => {
          try {
            const { content, metrics, error } = await this.executeStep(node.step, stepOutputs, config)
            const stepResult: OrchestrationStepResult = {
              agentName: node.step.name,
              content,
              metrics,
              skipped: false,
              error,
            }
            node.result = stepResult
            node.status = error ? 'failed' : 'completed'
            results.push(stepResult)

            if (!error) {
              stepOutputs.set(stepId, content)
              // 通知下游
              const newlyReady = graph.complete(stepId)
              readyQueue.push(...newlyReady)
            } else if (failFast) {
              failed = true
            }
          } catch (err: unknown) {
            // 正确捕获 executeStep 抛出的异常
            const stepResult: OrchestrationStepResult = {
              agentName: node.step.name,
              content: '',
              skipped: false,
              error: err instanceof Error ? err.message : String(err),
            }
            node.result = stepResult
            node.status = 'failed'
            results.push(stepResult)
            if (failFast) failed = true
          } finally {
            running--
            // 唤醒等待中的主循环
            const resolveFn = stepDoneResolve as ((() => void) | null)
            stepDoneResolve = null
            if (resolveFn) resolveFn()
          }
        })()
      }

      // 事件驱动等待: 仅在有 running 步骤时等待，step 完成后会 resolve
      if (running > 0 && !failed) {
        await createDeferred()
      }
    }

    // 产出结果
    for (const result of results) {
      const idx = config.steps.findIndex(s => s.name === result.agentName)
      yield { type: 'step_done', agentName: result.agentName, stepIndex: idx, result }
    }

    yield {
      type: 'all_done',
      result: {
        configId: runId,
        mode: 'pipeline', // DAG 模式复用 pipeline 类型
        results,
        duration: Date.now() - startTime,
        success: !failed,
        error: failed ? 'DAG 执行失败' : undefined,
      },
    }
  }

  /**
   * 执行单个 step
   */
  private async executeStep(
    step: DAGStep,
    outputs: Map<string, string>,
    config: DAGConfig
  ): Promise<{ content: string; metrics?: MessageMetrics; error?: string }> {
    const modelConfig = this.configStore.getModel(step.modelConfigId)
    if (!modelConfig) {
      return { content: '', error: `未找到模型配置: ${step.modelConfigId}` }
    }

    const provider: Provider = this.providerManager.createProvider(modelConfig)
    const appConfig = this.configStore.getConfig()
    const hooks = new HookManager()
    const lifecycle = new Lifecycle()
    const toolkit = this.toolManager?.getRegistry() ?? new ToolRegistry()

    this.activeLifecycles.set(step.id, lifecycle)

    // 注册到 A2A Bus
    this.a2aBus.register(step.id, async (msg) => {
      return { ...msg, type: 'response', content: 'ack' }
    })

    const agent = new ReActAgent({
      name: step.name,
      model: provider,
      toolkit,
      maxTurns: step.maxTurns ?? appConfig.maxTurns,
      maxMessages: appConfig.maxMessages,
      systemPrompt: step.systemPrompt,
      hooks,
      lifecycle,
    })

    // 确定输入: 优先 step 自带 input, 否则拼接上游输出
    let input = step.input || config.input
    if (!step.input) {
      // 拼接所有上游 step 的输出
      const stepNode = config.edges.filter(e => e.to === step.id)
      if (stepNode.length > 0) {
        const upstreamOutputs = stepNode
          .map(e => outputs.get(e.from))
          .filter(Boolean)
        if (upstreamOutputs.length > 0) {
          input = `上游输出:\n${upstreamOutputs.map((o, i) => `[${i + 1}] ${o}`).join('\n\n')}\n\n任务: ${config.input}`
        }
      }
    }

    try {
      let content = ''
      let metrics: MessageMetrics | undefined

      for await (const event of agent.streamEvents(input)) {
        if (event.type === 'token') {
          content += event.content
        } else if (event.type === 'done') {
          metrics = event.response.metrics as MessageMetrics
        }
      }

      return { content, metrics }
    } catch (err: unknown) {
      return { content: '', error: err instanceof Error ? err.message : String(err) }
    } finally {
      this.a2aBus.unregister(step.id)
      this.activeLifecycles.delete(step.id)
    }
  }

  /**
   * 停止 DAG 执行（业务方法）
   * 无参数调用时为生命周期停止方法：无操作
   */
  stop(runId?: string): void {
    if (!runId) return // 生命周期方法：无操作
    for (const [, lc] of this.activeLifecycles) {
      lc.stop()
    }
    this.activeLifecycles.clear()
  }

  // ===== [SDK 集成] DAGBuilder 模式 =====
  // SDK DAGBuilder 提供节点级重试、超时、条件跳过等高级特性
  // 适用于不需要流式事件的场景，返回完整的 DAGResult

  /**
   * 使用 SDK DAGBuilder 构建 DAG 工作流
   * 将 AELA DAGConfig 转换为 SDK DAGBuilder 格式
   */
  buildDAG(config: DAGConfig): DAGBuilder {
    const builder = new DAGBuilder(config.id || `dag-${Date.now()}`)

    for (const step of config.steps) {
      builder.nodeWithConfig(step.id, async (input: string) => {
        const outputs = new Map<string, string>()
        outputs.set('__initial__', input)
        const { content, error } = await this.executeStep(step, outputs, config)
        if (error) throw new Error(error)
        return content
      }, {
        retryCount: step.retryCount ?? 0,
        timeoutMs: step.timeoutMs,
        // condition: SDK DAGBuilder 期望 (input: string) => boolean 函数，
        // DAGStep.condition 存储的是字符串表达式，需要表达式求值器转换。
        // 当前阶段暂不传递 condition，待实现安全表达式求值后启用。
        condition: undefined,
      })
    }

    for (const edge of config.edges) {
      builder.edge(edge.from, edge.to)
    }

    return builder
  }

  /**
   * 使用 SDK DAGWorkflow 执行 DAG（非流式，支持节点级重试/超时/条件跳过）
   * 返回 SDK DAGResult，包含每个节点的执行状态和耗时
   */
  async runWithBuilder(config: DAGConfig): Promise<DAGResult> {
    const builder = this.buildDAG(config)
    const workflow = builder.build()
    return workflow.run(config.input)
  }

  /**
   * 将 SDK DAGResult 转换为 AELA OrchestrationEvent 流
   * 兼容现有的流式消费接口
   */
  *resultToEvents(result: DAGResult, startTime: number): Generator<OrchestrationEvent> {
    for (const [nodeId, nodeResult] of Object.entries(result.nodeResults)) {
      const nr = nodeResult as DAGNodeResult
      yield {
        type: 'step_done',
        agentName: nodeId,
        stepIndex: 0,
        result: {
          agentName: nodeId,
          content: nr.output,
          skipped: nr.status === 'skipped',
          error: nr.error,
        },
      }
    }
    yield {
      type: 'all_done',
      result: {
        configId: '',
        mode: 'pipeline',
        results: Object.entries(result.nodeResults).map(([id, nr]) => ({
          agentName: id,
          content: (nr as DAGNodeResult).output,
          skipped: (nr as DAGNodeResult).status === 'skipped',
          error: (nr as DAGNodeResult).error,
        })),
        duration: Date.now() - startTime,
        success: result.success,
        error: result.success ? undefined : 'DAG 执行失败',
      },
    }
  }
}
