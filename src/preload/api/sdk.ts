// SDK 增强功能 API（sdkEnhancements, perf）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  SDKExtractResult,
  SDKFuseResult,
  SDKBatchResult,
  SDKABTestRunResult,
  SDKABTestResults,
  SDKEvalRunResult,
  SDKStreamingPipeStepResult,
  SDKSchedulerStats,
  SDKDynamicOrchResult,
  SDKPluginInfo,
  SDKWorkerPoolStats,
  SDKWorkerPoolExecResult,
  SDKAgentMonitorStats,
  SDKAgentMonitorEvent,
  SDKCacheStatsEx,
  SDKSpeculativeStats,
  SDKSpeculativeToggleResult,
} from '@shared/types'

export const sdkEnhancementsApi = {
  // 1. 结构化输出提取
  extractStructured: (text: string, config?: Record<string, unknown>): Promise<SDKExtractResult> =>
    invoke(IPC_CHANNELS.SDK_EXTRACT_STRUCTURED, text, config),
  // 2. 多模态融合
  fuseMultimodal: (inputs: unknown[], config?: Record<string, unknown>): Promise<SDKFuseResult> =>
    invoke(IPC_CHANNELS.SDK_FUSE_MULTIMODAL, inputs, config),
  // 3. 批量请求处理
  batchProcess: (modelConfigId: string, requests: unknown[], maxConcurrent?: number): Promise<SDKBatchResult> =>
    invoke(IPC_CHANNELS.SDK_BATCH_PROCESS, modelConfigId, requests, maxConcurrent),
  // 4. Prompt A/B 测试
  abTest: {
    create: (name: string, config: { variants: { name: string; systemPrompt: string }[]; evaluator: { type: string; keywords?: string[] } }): Promise<{ name: string; variantCount: number }> =>
      invoke(IPC_CHANNELS.SDK_ABTEST_CREATE, name, config),
    run: (name: string, input: string, modelConfigId: string): Promise<SDKABTestRunResult> =>
      invoke(IPC_CHANNELS.SDK_ABTEST_RUN, name, input, modelConfigId),
    results: (name: string): Promise<SDKABTestResults> =>
      invoke(IPC_CHANNELS.SDK_ABTEST_RESULTS, name),
  },
  // 5. 评估套件
  eval: {
    addCase: (task: string, input: string, expected: string): Promise<boolean> =>
      invoke(IPC_CHANNELS.SDK_EVAL_ADD_CASE, task, input, expected),
    clearCases: (): Promise<boolean> =>
      invoke(IPC_CHANNELS.SDK_EVAL_CLEAR_CASES),
    run: (): Promise<SDKEvalRunResult> =>
      invoke(IPC_CHANNELS.SDK_EVAL_RUN),
  },
  // 6. 流式管道
  streamingPipeline: {
    create: (name: string, steps: unknown[]): Promise<{ name: string; stepCount: number }> =>
      invoke(IPC_CHANNELS.SDK_STREAMING_PIPE_CREATE, name, steps),
    run: (name: string, input: string): Promise<SDKStreamingPipeStepResult[]> => invoke(IPC_CHANNELS.SDK_STREAMING_PIPE_RUN, name, input),
  },
  // 7. 动态编排 + 调度器
  dynamicOrch: {
    schedule: (task: unknown): Promise<SDKDynamicOrchResult> => invoke(IPC_CHANNELS.SDK_DYNAMIC_ORCH_SCHEDULE, task),
    schedulerStats: (): Promise<SDKSchedulerStats> => invoke(IPC_CHANNELS.SDK_SCHEDULER_STATS),
  },
  // 8. 插件热加载
  plugin: {
    load: (pluginPath: string): Promise<{ path: string; loaded: boolean }> => invoke(IPC_CHANNELS.SDK_PLUGIN_LOAD, pluginPath),
    list: (): Promise<SDKPluginInfo[]> => invoke(IPC_CHANNELS.SDK_PLUGIN_LIST),
    unload: (pluginName: string): Promise<boolean> => invoke(IPC_CHANNELS.SDK_PLUGIN_UNLOAD, pluginName),
  },
  // 9. Worker 线程池
  workerPool: {
    stats: (): Promise<SDKWorkerPoolStats> => invoke(IPC_CHANNELS.SDK_WORKER_POOL_STATS),
    execute: (task: unknown): Promise<SDKWorkerPoolExecResult> => invoke(IPC_CHANNELS.SDK_WORKER_POOL_EXEC, task),
  },
  // 10. 可视化工具
  viz: {
    mermaid: (type: string, data: unknown): Promise<string> => invoke(IPC_CHANNELS.SDK_VIZ_MERMAID, type, data),
    dot: (type: string, data: unknown): Promise<string> => invoke(IPC_CHANNELS.SDK_VIZ_DOT, type, data),
  },
  // 11. Agent 监控
  agentMonitor: {
    stats: (): Promise<SDKAgentMonitorStats> => invoke(IPC_CHANNELS.SDK_AGENT_MONITOR_STATS),
    events: (limit?: number): Promise<SDKAgentMonitorEvent[]> => invoke(IPC_CHANNELS.SDK_AGENT_MONITOR_EVENTS, limit),
  },
  // 12. 缓存统计
  cache: {
    stats: (): Promise<SDKCacheStatsEx> => invoke(IPC_CHANNELS.SDK_CACHE_STATS),
    clear: (): Promise<boolean> => invoke(IPC_CHANNELS.SDK_CACHE_CLEAR),
  },
  // SDK 信息与错误码
  getInfo: (): Promise<{ version: string; errorCodes: Record<string, string> }> =>
    invoke(IPC_CHANNELS.SDK_GET_INFO),
}

export const perfApi = {
  speculative: {
    stats: (): Promise<SDKSpeculativeStats[]> => invoke(IPC_CHANNELS.AGENT_SPECULATIVE_STATS),
    reset: (): Promise<boolean> => invoke(IPC_CHANNELS.AGENT_SPECULATIVE_RESET),
    toggle: (enabled: boolean): Promise<SDKSpeculativeToggleResult> => invoke(IPC_CHANNELS.AGENT_SPECULATIVE_TOGGLE, enabled),
  },
  cache: {
    stats: (): Promise<SDKCacheStatsEx> => invoke(IPC_CHANNELS.AGENT_CACHE_STATS),
    clear: (): Promise<boolean> => invoke(IPC_CHANNELS.AGENT_CACHE_CLEAR),
    toggle: (enabled: boolean): Promise<boolean> => invoke(IPC_CHANNELS.AGENT_CACHE_TOGGLE, enabled),
  },
}
