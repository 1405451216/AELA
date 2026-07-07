// ===== SDK 深度集成的返回类型 =====
// 所有 SDK*Result / SDK*Stats / SDK*Info 接口
// 这些类型对应 SDKEnhancements、性能、Phase4 模块的 IPC 返回类型

// ===== SDK 错误码（与Go端对齐） =====
export interface SDKErrorCode {
  code: string
  category: string
  description: string
}

/** SDK 版本信息 */
export interface SDKVersionInfo {
  version: string
  errorCodes: Record<string, string>
}

// ===== SDKEnhancements / Perf / Phase4 IPC 返回类型 =====

/** 结构化输出提取结果 */
export interface SDKExtractResult {
  extracted: Record<string, unknown>
  raw: string
  confidence: number
}

/** 多模态融合结果 */
export interface SDKFuseResult {
  fusedContent: string
  modalities: string[]
  confidence: number
}

/** 批量处理结果 */
export interface SDKBatchResult {
  results: Array<{ success: boolean; content: string; error?: string }>
  totalRequests: number
  successCount: number
  failureCount: number
  duration: number
}

/** A/B 测试结果 */
export interface SDKABTestRunResult {
  variantName: string
  content: string
  score: number
  metrics: Record<string, unknown>
}

export interface SDKABTestResults {
  testName: string
  results: SDKABTestRunResult[]
  winner: string | null
}

/** 评估套件运行结果 */
export interface SDKEvalRunResult {
  totalCases: number
  passed: number
  failed: number
  results: Array<{
    task: string
    input: string
    expected: string
    actual: string
    passed: boolean
    score: number
  }>
}

/** 流式管道步骤结果 */
export interface SDKStreamingPipeStepResult {
  stepName: string
  content: string
  success: boolean
  error?: string
  duration: number
}

/** 调度器统计 */
export interface SDKSchedulerStats {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  pendingTasks: number
  avgDuration: number
}

/** 动态编排调度结果 */
export interface SDKDynamicOrchResult {
  taskId: string
  status: 'scheduled' | 'running' | 'completed' | 'failed'
  result?: unknown
  error?: string
}

/** 插件信息 */
export interface SDKPluginInfo {
  name: string
  version: string
  path: string
  loaded: boolean
  tools: string[]
}

/** Worker 线程池统计 */
export interface SDKWorkerPoolStats {
  totalWorkers: number
  idleWorkers: number
  busyWorkers: number
  pendingTasks: number
  completedTasks: number
  failedTasks: number
}

/** Worker 线程池执行结果 */
export interface SDKWorkerPoolExecResult {
  taskId: string
  success: boolean
  result: unknown
  error?: string
  duration: number
}

/** Agent 监控统计 */
export interface SDKAgentMonitorStats {
  totalAgents: number
  activeAgents: number
  idleAgents: number
  totalRuns: number
  totalErrors: number
  avgRunDuration: number
}

/** Agent 监控事件 */
export interface SDKAgentMonitorEvent {
  agentId: string
  agentName: string
  type: string
  timestamp: string
  data: Record<string, unknown>
}

/** 缓存统计 */
export interface SDKCacheStatsEx {
  hits: number
  misses: number
  size: number
  hitRate: number
  totalRequests: number
}

/** 投机执行统计 */
export interface SDKSpeculativeStats {
  totalSpeculations: number
  correctPredictions: number
  incorrectPredictions: number
  accuracy: number
  avgSpeedup: number
}

/** 投机执行切换结果 */
export interface SDKSpeculativeToggleResult {
  enabled: boolean
  message: string
}

/** DAG Builder 运行结果 */
export interface SDKDAGBuilderResult {
  result: unknown
  duration: number
  nodeCount: number
  edgeCount: number
}

/** 弹性组件执行结果 */
export interface SDKResilienceExecResult {
  key: string
  operation: string
  success: boolean
  result: unknown
  error?: string
  retries: number
}

/** 熔断器状态结果 */
export interface SDKBreakerStateResult {
  modelId: string
  state: string
  failureCount: number
  lastFailureTime: string
}

/** 限流配置 */
export interface SDKRateLimitResult {
  rpm: number
  active: boolean
}

/** 结构化数据提取结果 */
export interface SDKExtractDataResult {
  data: Record<string, unknown>
  raw: string
  schema: string
  model: string
}

/** Schema 构建结果 */
export interface SDKBuildSchemaResult {
  name: string
  schema: Record<string, unknown>
  properties: Record<string, unknown>
}

/** 推理引擎结果 */
export interface SDKReasoningResult {
  thought: string
  events: Array<{ type: string; content: string; timestamp: string }>
  model: string
  duration: number
}

/** 推理引擎流式结果 */
export interface SDKReasoningStreamResult {
  thought: unknown
  events: unknown[]
}

/** 记忆压缩 SDK 结果 */
export interface SDKMemoryCompressResult {
  compressed: number
  summary: string
  tags: string[]
  originalCount: number
  compressedCount: number
}

/** 记忆简单摘要结果 */
export interface SDKMemorySummaryResult {
  summary: string
  originalLength: number
  summaryLength: number
  compressionRatio: number
}

/** 记忆衰减结果 */
export interface SDKMemoryDecayResult {
  processed: number
  updated: number
  decayFactor: number
}
