// DynamicDAG 动态拓扑服务
// 移植自 AP Go 核心层 orchestration/dynamic.go
// 支持: 运行时添加/移除节点 / 条件边路由 / 动态拓扑修改

import { ReActAgent, HookManager, Lifecycle, ToolRegistry } from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type {
  DynamicDAGConfig,
  DynamicDAGNode,
  OrchestrationEvent,
  OrchestrationStepResult,
} from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'
import type { ToolManager } from './ToolManager'
import { randomUUID } from 'crypto'

// ===== 动态节点处理器 =====

type NodeHandler = (input: string, config: Record<string, unknown>) => Promise<string>

interface DynamicNode {
  node: DynamicDAGNode
  handler: NodeHandler
}

// ===== DynamicDAG 服务 =====

export class DynamicDAGService {
  private providerManager: ProviderManager
  private configStore: ConfigStore
  private toolManager: ToolManager | null = null
  private activeLifecycles: Map<string, Lifecycle> = new Map()

  constructor(configStore: ConfigStore, providerManager: ProviderManager, toolManager: ToolManager | null) {
    this.configStore = configStore
    this.providerManager = providerManager
    this.toolManager = toolManager
  }

setToolManager(tm: ToolManager): void {
this.toolManager = tm
}

  /**
   * 运行动态 DAG
   */
  async *run(config: DynamicDAGConfig): AsyncGenerator<OrchestrationEvent> {
    const startTime = Date.now()
    const results: OrchestrationStepResult[] = []
    const runId = config.id || randomUUID()

    // 构建节点映射
    const nodes = new Map<string, DynamicNode>()
    for (const nodeConfig of config.nodes) {
      const handler = this.createHandler(nodeConfig)
      nodes.set(nodeConfig.id, { node: nodeConfig, handler })
    }

    // 构建边映射
    const edges = new Map<string, string[]>()
    for (const edge of config.edges) {
      if (!edges.has(edge.from)) edges.set(edge.from, [])
      edges.get(edge.from)!.push(edge.to)
    }

    // 条件边映射
    const conditionalEdges = new Map<string, Record<string, string>>()
    for (const ce of config.conditionalEdges ?? []) {
      conditionalEdges.set(ce.from, ce.routing)
    }

    // 找到起始节点 (没有入边的节点)
    const hasIncoming = new Set<string>()
    for (const edge of config.edges) {
      hasIncoming.add(edge.to)
    }
    const startNodes = config.nodes.filter(n => !hasIncoming.has(n.id))

    if (startNodes.length === 0) {
      yield { type: 'error', error: 'DynamicDAG 中没有起始节点' }
      return
    }

    // 从起始节点开始执行
    let current = config.input
    const stepIndexMap = new Map<string, number>()
    config.nodes.forEach((n, i) => stepIndexMap.set(n.id, i))

    for (const startNode of startNodes) {
      const result = await this.executeFrom(startNode.id, nodes, edges, conditionalEdges, current, config, results, stepIndexMap)
      if (result.error) {
        yield { type: 'error', error: result.error }
        return
      }
      current = result.output
    }

    // 输出所有 step_done
    for (const result of results) {
      const idx = config.nodes.findIndex(n => n.name === result.agentName)
      yield { type: 'step_done', agentName: result.agentName, stepIndex: idx, result }
    }

    yield {
      type: 'all_done',
      result: {
        configId: runId,
        mode: 'pipeline',
        results,
        duration: Date.now() - startTime,
        success: true,
      },
    }
  }

  /**
   * 从指定节点递归执行
   */
  private async executeFrom(
    nodeId: string,
    nodes: Map<string, DynamicNode>,
    edges: Map<string, string[]>,
    conditionalEdges: Map<string, Record<string, string>>,
    input: string,
    config: DynamicDAGConfig,
    results: OrchestrationStepResult[],
    stepIndexMap: Map<string, number>
  ): Promise<{ output: string; error?: string }> {
    const dynamicNode = nodes.get(nodeId)
    if (!dynamicNode) {
      return { output: '', error: `节点 ${nodeId} 不存在` }
    }

    const _stepIndex = stepIndexMap.get(nodeId) ?? 0
    // placeholder — no-op

    const _startTime = Date.now()
    try {
      const output = await dynamicNode.handler(input, dynamicNode.node.config)

      const stepResult: OrchestrationStepResult = {
        agentName: dynamicNode.node.name,
        content: output,
        skipped: false,
      }
      results.push(stepResult)

      // 检查条件路由
      const routing = conditionalEdges.get(nodeId)
      if (routing) {
        const routeKey = output.trim()
        if (routing[routeKey]) {
          return this.executeFrom(routing[routeKey], nodes, edges, conditionalEdges, output, config, results, stepIndexMap)
        }
        // 也尝试 lowercase
        if (routing[routeKey.toLowerCase()]) {
          return this.executeFrom(routing[routeKey.toLowerCase()], nodes, edges, conditionalEdges, output, config, results, stepIndexMap)
        }
      }

      // 普通边
      const nexts = edges.get(nodeId) ?? []
      let currentOutput = output
      for (const nextId of nexts) {
        const result = await this.executeFrom(nextId, nodes, edges, conditionalEdges, currentOutput, config, results, stepIndexMap)
        if (result.error) return result
        currentOutput = result.output
      }

      return { output: currentOutput }
    } catch (err: unknown) {
      return { output: '', error: `节点 ${nodeId} 执行失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  /**
   * 为节点创建处理器
   */
  private createHandler(node: DynamicDAGNode): NodeHandler {
    if (node.handlerType === 'agent') {
      return this.createAgentHandler(node)
    } else if (node.handlerType === 'transform') {
      return this.createTransformHandler(node)
    } else if (node.handlerType === 'condition') {
      return this.createConditionHandler(node)
    }
    return async (input: string) => input
  }

  /**
   * Agent 节点处理器
   */
  private createAgentHandler(node: DynamicDAGNode): NodeHandler {
    return async (input: string, config: Record<string, unknown>) => {
      const modelConfigId = config.modelConfigId as string
      const systemPrompt = (config.systemPrompt as string) || node.name
      const maxTurns = config.maxTurns as number | undefined

      const modelConfig = this.configStore.getModel(modelConfigId)
      if (!modelConfig) {
        throw new Error(`未找到模型配置: ${modelConfigId}`)
      }

      const provider: Provider = this.providerManager.createProvider(modelConfig)
      const appConfig = this.configStore.getConfig()
      const hooks = new HookManager()
      const lifecycle = new Lifecycle()
      const toolkit = this.toolManager?.getRegistry() ?? new ToolRegistry()

      const agent = new ReActAgent({
        name: node.name,
        model: provider,
        toolkit,
        maxTurns: maxTurns ?? appConfig.maxTurns,
        maxMessages: appConfig.maxMessages,
        systemPrompt,
        hooks,
        lifecycle,
      })

      this.activeLifecycles.set(node.id, lifecycle)

      let content = ''
      try {
        for await (const event of agent.streamEvents(input)) {
          if (event.type === 'token') {
            content += event.content
          }
        }
        return content
      } finally {
        this.activeLifecycles.delete(node.id)
      }
    }
  }

  /**
   * Transform 节点处理器 (简单文本变换)
   */
  private createTransformHandler(_node: DynamicDAGNode): NodeHandler {
    return async (input: string, config: Record<string, unknown>) => {
      const transform = config.transform as string | undefined
      const template = config.template as string | undefined

      if (template) {
        return template.replace(/\{\{input\}\}/g, input)
      }
      if (transform === 'uppercase') return input.toUpperCase()
      if (transform === 'lowercase') return input.toLowerCase()
      if (transform === 'trim') return input.trim()
      if (transform === 'json_parse') {
        try {
          return JSON.stringify(JSON.parse(input), null, 2)
        } catch {
          return input
        }
      }
      return input
    }
  }

  /**
   * Condition 节点处理器 (返回条件值用于路由)
   */
  private createConditionHandler(_node: DynamicDAGNode): NodeHandler {
    return async (input: string, config: Record<string, unknown>) => {
      const condition = config.condition as string | undefined
      const contains = config.contains as string | undefined

      if (contains) {
        return input.includes(contains) ? 'true' : 'false'
      }
      if (condition === 'empty') {
        return input.trim().length === 0 ? 'true' : 'false'
      }
      if (condition === 'nonempty') {
        return input.trim().length > 0 ? 'true' : 'false'
      }
      // 默认: 返回输入作为路由键
      return input.trim()
    }
  }

  /**
   * 停止执行（业务方法）
   * 无参数调用时为生命周期停止方法：无操作
   */
  stop(runId?: string): void {
    if (!runId) return // 生命周期方法：无操作
    for (const [, lc] of this.activeLifecycles) {
      lc.stop()
    }
    this.activeLifecycles.clear()
  }
}
