// SDK 类型适配层
//
// 目的：集中解决 AELA 与 @agentprimordia/sdk 之间的类型契约失配问题。
//
// SDK 导出映射（重要）：
//   - `ModelPricing`（公开名） → 内部 `ModelPricing$1` → 字段 {inputPer1K, outputPer1K}
//   - `ModelPricingInfo`（公开名） → 内部 `ModelPricing` → 字段 {model, provider, promptPricePer1M, completionPricePer1M}
//   - `Plan`（公开名） → 内部 `Plan$1` → 字段 {id, goal, steps: PlanStep[], createdAt: Date}
//   - `TaskPlan`（公开名） → 内部 `Plan` → 字段 {goal, subTasks: SubTask[], createdAt: string}
//   - `StreamEvent`（公开名） → 内部 `StreamEvent$1` → 包含 token/tool_call/tool_result/turn_end/done/error
//   - `Sandbox` 是 declare class，可直接做类型使用
//
// 本文件提供：
//   1. SDK 公开类型与 AELA 内部类型之间的转换函数
//   2. 复杂方法签名的适配（解决 abstract 类 / 私有方法 / 参数对象差异）

import type {
  RunMetrics as SDKRunMetrics,
  Response as SDKResponse,
  StreamEvent as SDKStreamEvent,
  ModelPricingInfo as SDKModelPricing,
  Plan as SDKPlan,
  PlanStep as SDKPlanStep,
  VizWorkflow as SDKVizWorkflow,
  MultimodalFusionConfig as SDKMultimodalFusionConfig,
  Provider as SDKProvider,
  MultimodalProvider as SDKMultimodalProvider,
} from '@agentprimordia/sdk'

import type {
  MessageMetrics,
  ModelPricing,
  Plan,
  SubTask,
} from '@shared/types'

// ============================================================
// 1. 统一别名：指向 SDK 当前推荐版本，避免散落 $1 后缀
// ============================================================

/** SDK 推荐的流式事件类型 */
export type SdkStreamEvent = SDKStreamEvent

/** SDK 推荐的执行响应类型 */
export type SdkResponse = SDKResponse

/** SDK 推荐的运行指标类型（与 AELA MessageMetrics 字段名一致） */
export type SdkRunMetrics = SDKRunMetrics

/** SDK 推荐的模型定价（与 AELA ModelPricing 字段一致） */
export type SdkModelPricing = SDKModelPricing

/** SDK 推荐的执行计划（含 Date createdAt + id + steps） */
export type SdkPlan = SDKPlan

/** SDK 推荐的 VizWorkflow 输入 */
export type SdkVizWorkflow = SDKVizWorkflow

/** SDK 推荐的多模态融合配置 */
export type SdkMultimodalFusionConfig = SDKMultimodalFusionConfig

// ============================================================
// 2. 业务类型 <-> SDK 类型 转换函数
// ============================================================

/**
 * AELA MessageMetrics → SDK RunMetrics
 * AELA 的 MessageMetrics 没有 `totalTokens / toolFailures / success` 字段，
 * 调用方需自行补齐可选字段。
 */
export function toSdkRunMetrics(m: MessageMetrics, extra?: {
  totalTokens?: number
  toolFailures?: number
  success?: boolean
}): SdkRunMetrics {
  return {
    totalTurns: m.totalTurns,
    totalTools: m.totalTools,
    duration: m.duration,
    llmLatency: m.llmLatency,
    toolLatency: m.toolLatency,
    totalTokens: extra?.totalTokens,
    toolFailures: extra?.toolFailures,
    success: extra?.success ?? true,
  }
}

/**
 * SDK RunMetrics → AELA MessageMetrics（丢弃可选字段）
 */
export function fromSdkRunMetrics(m: SdkRunMetrics): MessageMetrics {
  return {
    totalTurns: m.totalTurns,
    totalTools: m.totalTools,
    duration: m.duration,
    llmLatency: m.llmLatency,
    toolLatency: m.toolLatency,
  }
}

/**
 * AELA ModelPricing <-> SDK ModelPricing（字段名完全一致，仅做类型守卫）
 */
export function toSdkModelPricing(p: ModelPricing): SdkModelPricing {
  return {
    model: p.model,
    provider: p.provider,
    promptPricePer1M: p.promptPricePer1M,
    completionPricePer1M: p.completionPricePer1M,
  }
}

export function fromSdkModelPricing(p: SdkModelPricing): ModelPricing {
  return {
    model: p.model,
    provider: p.provider,
    promptPricePer1M: p.promptPricePer1M,
    completionPricePer1M: p.completionPricePer1M,
  }
}

/**
 * AELA Plan（subtasks: SubTask[]） → SDK Plan（steps: PlanStep[]）
 *
 * 字段映射：
 *   AELA SubTask { id, description, dependsOn, status, result }
 *   SDK PlanStep { id, description, agent?, dependencies, status, result? }
 */
export function aelaPlanToSdkPlan(p: Plan, id: string = 'plan-' + Date.now()): SdkPlan {
  return {
    id,
    goal: p.goal,
    steps: p.subtasks.map((st) => ({
      id: st.id,
      description: st.description,
      agent: undefined,
      dependencies: st.dependsOn,
      status: st.status === 'running' ? 'in_progress' : st.status,
      result: st.result,
    })),
    createdAt: new Date(p.createdAt),
  }
}

/**
 * SDK Plan → AELA Plan
 */
export function sdkPlanToAelaPlan(p: SdkPlan): Plan {
  return {
    goal: p.goal,
    subtasks: p.steps.map(sdkStepToAelaSubTask),
    createdAt: p.createdAt.toISOString(),
  }
}

function sdkStepToAelaSubTask(s: SDKPlanStep): SubTask {
  return {
    id: s.id,
    description: s.description,
    dependsOn: s.dependencies,
    status: s.status === 'in_progress' ? 'running' : s.status,
    result: s.result ?? '',
  }
}

// ============================================================
// 3. 复杂方法签名包装
// ============================================================

/**
 * ComputeWorkerPool 方法名差异
 *
 * SDK 实际 API：
 *   - `stats: WorkerPoolStats` (getter 属性，非方法)
 *   - `run(task): Promise<WorkerResult>` (不是 execute)
 *   - `terminate(): Promise<void>`
 */
export interface WorkerPoolAdapter {
  /** 获取运行时统计 */
  getStats(): { active: number; idle: number; queued: number; total: number }
  /** 提交一个 worker 任务 */
  execute(task: { type: string; payload: Record<string, unknown> }): Promise<{ result: unknown }>
  /** 终止线程池 */
  terminate(): Promise<void>
}

export function wrapWorkerPool(pool: {
  stats: unknown
  run: (t: unknown) => Promise<unknown>
  terminate?: () => Promise<void> | void
} | null): WorkerPoolAdapter | null {
  if (!pool) return null
  return {
    getStats: () => {
      const s = pool.stats as { active?: number; idle?: number; queued?: number; total?: number } | undefined
      return {
        active: s?.active ?? 0,
        idle: s?.idle ?? 0,
        queued: s?.queued ?? 0,
        total: s?.total ?? 0,
      }
    },
    execute: async (task) => {
      const result = await pool.run(task)
      return { result }
    },
    terminate: async () => {
      if (pool.terminate) {
        await pool.terminate()
      }
    },
  }
}

/**
 * AgentMonitor 方法名差异
 *
 * SDK 实际 API：
 *   - `getSnapshot(): DashboardSnapshot`
 *   - `onChange(listener): () => void`
 */
export interface AgentMonitorAdapter {
  getStats(): unknown
  getEvents(_limit?: number): unknown[]
}

export function wrapAgentMonitor(monitor: {
  getSnapshot: () => unknown
}): AgentMonitorAdapter {
  return {
    getStats: () => monitor.getSnapshot(),
    getEvents: () => {
      const snapshot = monitor.getSnapshot() as { events?: unknown[] } | undefined
      return Array.isArray(snapshot?.events) ? snapshot!.events! : []
    },
  }
}

/**
 * VizWorkflow 输入归一化
 *
 * SDK `MermaidGenerator.generate(workflow: VizWorkflow, config?)` 要求结构化对象
 * { nodes: Map<string, VizNode>, transitions: VizTransition[], startNodeID: string }。
 *
 * AELA IPC 历史接收字符串 / 任意对象 — 这里提供宽松归一化。
 */
export interface AelaVizInput {
  nodes?: Array<{ id: string; label?: string; type?: string }>
  edges?: Array<{ from: string; to: string; label?: string }>
  title?: string
  type?: string
}

export function toSdkVizWorkflow(input: AelaVizInput | string): SdkVizWorkflow {
  if (typeof input === 'string') {
    // 字符串兜底：单一节点工作流
    const id = 'node-0'
    const node: { id: string; name: string; type: string } = { id, name: input, type: input }
    return {
      nodes: new Map([[id, node]]),
      transitions: [],
      startNodeID: id,
    }
  }
  const nodes = new Map<string, { id: string; name: string; type: string }>()
  const inputNodes = input.nodes ?? [{ id: 'start', label: input.title ?? 'Start', type: 'start' }]
  for (const n of inputNodes) {
    nodes.set(n.id, { id: n.id, name: n.label ?? n.id, type: n.type ?? 'default' })
  }
  return {
    nodes,
    transitions: (input.edges ?? []).map((e) => ({ from: e.from, to: e.to, condition: e.label })),
    startNodeID: inputNodes[0]?.id ?? 'start',
  }
}

/**
 * MultimodalFusionConfig 完整默认
 *
 * SDK 要求 `text: Provider` 必填；AELA 调用点历史传 `undefined`，现统一兜底。
 */
export function ensureMultimodalFusionConfig(
  cfg: Partial<SdkMultimodalFusionConfig> | undefined,
  fallback: { textProvider: SDKProvider },
): SdkMultimodalFusionConfig {
  return {
    text: fallback.textProvider,
    vision: cfg?.vision,
    audio: cfg?.audio,
    fusion: cfg?.fusion,
    parallel: cfg?.parallel,
    strategy: cfg?.strategy,
    weights: cfg?.weights,
    systemPromptPrefix: cfg?.systemPromptPrefix,
  }
}

/**
 * SDK MultimodalProvider 是 declare class/interface；本地简单类型守卫。
 */
export type AelaMultimodalProvider = SDKMultimodalProvider

// ============================================================
// 4. EvalSuite / PromptABTest 适配
// ============================================================

/**
 * SDK EvalSuite 不支持运行时 addCase —— 所有 case 必须在构造时传入。
 * AELA 通过本地 evalCases[] 队列 + 合并机制绕过。
 */
export interface EvalCaseAdapter {
  task: string
  input: string
  expected: string
}

export function mergeEvalCases(
  baseCases: ReadonlyArray<EvalCaseAdapter>,
  dynamicCases: ReadonlyArray<EvalCaseAdapter>,
): EvalCaseAdapter[] {
  return [...baseCases, ...dynamicCases]
}

/**
 * SDK PromptABTest 没有 select / record / getResult 方法。
 * 调用方应使用 `run(input, agentFactory)`，结果通过返回值获取。
 */
export function isPromptABTestResult(v: unknown): v is { winner: string; winnerScore: number } {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { winner?: unknown }).winner === 'string'
  )
}