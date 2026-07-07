// SDK Phase 4 高价值模块 API
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  SDKDAGBuilderResult,
  SDKResilienceExecResult,
  SDKBreakerStateResult,
  SDKRateLimitResult,
  SDKBatchResult,
  SDKExtractDataResult,
  SDKBuildSchemaResult,
  SDKReasoningResult,
  SDKReasoningStreamResult,
  SDKMemoryCompressResult,
  SDKMemorySummaryResult,
  SDKMemoryDecayResult,
} from '@shared/types'

export const sdkPhase4Api = {
  // DAG Builder
  dagBuilder: {
    run: (config: unknown): Promise<SDKDAGBuilderResult> =>
      invoke(IPC_CHANNELS.DAG_BUILDER_RUN, config),
  },
  // 弹性组件
  resilience: {
    execute: (key: string, operation: string, data?: unknown, timeoutMs?: number): Promise<SDKResilienceExecResult> =>
      invoke(IPC_CHANNELS.RESILIENCE_SDK_EXECUTE, key, operation, data, timeoutMs),
    breakerState: (key?: string): Promise<SDKBreakerStateResult> =>
      invoke(IPC_CHANNELS.RESILIENCE_SDK_BREAKER_STATE, key),
    resetBreaker: (key?: string): Promise<boolean> =>
      invoke(IPC_CHANNELS.RESILIENCE_SDK_RESET_BREAKER, key),
  },
  // 限流批处理
  provider: {
    setRateLimit: (rpm: number): Promise<SDKRateLimitResult> =>
      invoke(IPC_CHANNELS.PROVIDER_RATE_LIMIT_SET, rpm),
    getRateLimit: (): Promise<SDKRateLimitResult> =>
      invoke(IPC_CHANNELS.PROVIDER_RATE_LIMIT_GET),
    batchProcess: (modelConfigId: string, requests: unknown[], maxConcurrent?: number): Promise<SDKBatchResult> =>
      invoke(IPC_CHANNELS.PROVIDER_BATCH_PROCESS, modelConfigId, requests, maxConcurrent),
  },
  // 结构化数据提取
  extractData: (modelConfigId: string, input: string, schema: unknown, model?: string): Promise<SDKExtractDataResult> =>
    invoke(IPC_CHANNELS.SDK_EXTRACT_DATA, modelConfigId, input, schema, model),
  extractWithSchema: (modelConfigId: string, input: string, schema: unknown, model?: string, maxRetries?: number): Promise<SDKExtractDataResult> =>
    invoke(IPC_CHANNELS.SDK_EXTRACT_WITH_SCHEMA, modelConfigId, input, schema, model, maxRetries),
  buildSchema: (name: string, properties: Record<string, unknown>): Promise<SDKBuildSchemaResult> =>
    invoke(IPC_CHANNELS.SDK_BUILD_SCHEMA, name, properties),
  getSchemas: (): Promise<Record<string, SDKBuildSchemaResult>> => invoke(IPC_CHANNELS.SDK_GET_SCHEMAS),
  // 推理引擎
  reasoning: {
    reason: (modelConfigId: string, messages: unknown[], opts?: unknown): Promise<SDKReasoningResult> =>
      invoke(IPC_CHANNELS.REASONING_REASON, modelConfigId, messages, opts),
    reasonStream: (modelConfigId: string, messages: unknown[], opts?: unknown): Promise<SDKReasoningStreamResult> =>
      invoke(IPC_CHANNELS.REASONING_REASON_STREAM, modelConfigId, messages, opts),
    quickReason: (modelConfigId: string, messages: unknown[], opts?: unknown): Promise<SDKReasoningResult> =>
      invoke(IPC_CHANNELS.REASONING_QUICK_REASON, modelConfigId, messages, opts),
  },
  // 记忆压缩
  memory: {
    compressSDK: (modelConfigId: string, config?: unknown): Promise<SDKMemoryCompressResult> =>
      invoke(IPC_CHANNELS.MEMORY_COMPRESS_SDK, modelConfigId, config),
    simpleSummary: (content: string): Promise<SDKMemorySummaryResult> =>
      invoke(IPC_CHANNELS.MEMORY_SIMPLE_SUMMARY, content),
    decay: (decayFactor?: number): Promise<SDKMemoryDecayResult> =>
      invoke(IPC_CHANNELS.MEMORY_DECAY, decayFactor),
  },
  // 安全扩展
  security: {
    checkShellMeta: (cmd: string): Promise<{ found: boolean; char?: string }> =>
      invoke(IPC_CHANNELS.SECURITY_CHECK_SHELL_META, cmd),
    checkPathTraversal: (path: string): Promise<{ safe: boolean; reason?: string }> =>
      invoke(IPC_CHANNELS.SECURITY_CHECK_PATH_TRAVERSAL, path),
    resolvePathSafe: (rootDir: string, filePath: string): Promise<{ safe: boolean; resolved?: string; reason?: string }> =>
      invoke(IPC_CHANNELS.SECURITY_RESOLVE_PATH_SAFE, rootDir, filePath),
    sanitizeInput: (input: string): Promise<{ safe: boolean; sanitized: string; issues: string[] }> =>
      invoke(IPC_CHANNELS.SECURITY_SANITIZE_INPUT, input),
    checkCommandGuard: (command: string): Promise<{ allowed: boolean; reason?: string }> =>
      invoke(IPC_CHANNELS.SECURITY_CHECK_COMMAND_GUARD, command),
  },
}
