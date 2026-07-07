/**
 * SDKEnhancements IPC handler 单测
 *
 * 覆盖：SDK_EXTRACT_STRUCTURED / SDK_BUILD_SCHEMA / SDK_VIZ_MERMAID /
 *       SDK_WORKER_POOL_STATS / SDK_AGENT_MONITOR_STATS / SDK_PLUGIN_LOAD
 * 重点：service 方法透传 + VizWorkflow 归一化 + WorkerPoolAdapter 包装
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolve } from 'node:path'

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn)
    },
  },
}))

vi.mock('../../../src/main/utils/ipcHelpers', () => ({
  wrap: async (fn: () => Promise<unknown>) => {
    try {
      const data = await fn()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  },
}))

import { registerSDKEnhancementsHandlers } from '../../../src/main/ipc/handlers/sdkEnhancements'
import { IPC_CHANNELS } from '../../../src/shared/types'

function makeMockSDKService(overrides: Partial<{
  extractStructuredOutput: ReturnType<typeof vi.fn>
  buildSchema: ReturnType<typeof vi.fn>
  getMermaidGenerator: ReturnType<typeof vi.fn>
  getWorkerPool: ReturnType<typeof vi.fn>
  getAgentMonitor: ReturnType<typeof vi.fn>
  getPluginLoader: ReturnType<typeof vi.fn>
  getABTestResults: ReturnType<typeof vi.fn>
  clearEvalCases: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    extractStructuredOutput: overrides.extractStructuredOutput ?? vi.fn().mockReturnValue({ extracted: true }),
    buildSchema: overrides.buildSchema ?? vi.fn().mockReturnValue({ type: 'object', properties: { foo: { type: 'string' } } }),
    getMermaidGenerator: overrides.getMermaidGenerator ?? vi.fn().mockReturnValue({
      generate: vi.fn().mockReturnValue('graph TD; A-->B;'),
    }),
    getWorkerPool: overrides.getWorkerPool ?? vi.fn().mockReturnValue(null),
    getAgentMonitor: overrides.getAgentMonitor ?? vi.fn().mockReturnValue({
      getSnapshot: vi.fn().mockReturnValue({ status: 'idle', agents: 0 }),
    }),
    getPluginLoader: overrides.getPluginLoader ?? vi.fn().mockReturnValue({
      load: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockReturnValue([]),
      unload: vi.fn().mockReturnValue(true),
    }),
    getABTestResults: overrides.getABTestResults ?? vi.fn().mockReturnValue([]),
    clearEvalCases: overrides.clearEvalCases ?? vi.fn(),
  } as never
}

function makeMockRAG() {
  return {
    setConfig: vi.fn(),
    getConfig: vi.fn().mockReturnValue({}),
    getRAGStoreStats: vi.fn().mockReturnValue({ totalDocuments: 0 }),
    getFusionConfig: vi.fn().mockReturnValue({ fusionMode: 'rrf' }),
  } as never
}

function makeMockAgent() {
  return {
    getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0, size: 0, hitRate: 0 }),
    clearCache: vi.fn(),
    setCacheEnabled: vi.fn(),
    isCacheEnabled: vi.fn().mockReturnValue(true),
    getSpeculativeStats: vi.fn().mockReturnValue([]),
    resetSpeculative: vi.fn(),
    setSpeculativeEnabled: vi.fn(),
    getSpeculativeConfig: vi.fn().mockReturnValue({ enabled: true, minHitRate: 0.3, maxSpecDepth: 2, speculationTimeoutMs: 10000 }),
  } as never
}

function makeMockProviderManager() {
  return { batchProcess: vi.fn().mockResolvedValue([]) } as never
}

function makeMockConfigStore() {
  return { getModel: vi.fn().mockReturnValue(null) } as never
}

describe('SDKEnhancements IPC handlers', () => {
  let sdkSvc: ReturnType<typeof makeMockSDKService>
  let ragSvc: ReturnType<typeof makeMockRAG>
  let agentSvc: ReturnType<typeof makeMockAgent>
  let pm: ReturnType<typeof makeMockProviderManager>
  let cs: ReturnType<typeof makeMockConfigStore>

  beforeEach(() => {
    handlers.clear()
    sdkSvc = makeMockSDKService()
    ragSvc = makeMockRAG()
    agentSvc = makeMockAgent()
    pm = makeMockProviderManager()
    cs = makeMockConfigStore()
    registerSDKEnhancementsHandlers({
      sdkEnhancementsService: sdkSvc,
      ragService: ragSvc,
      agentService: agentSvc,
      providerManager: pm,
      configStore: cs,
    })
  })

  // ===== SDK_EXTRACT_STRUCTURED =====
  describe('SDK_EXTRACT_STRUCTURED', () => {
    it('extracts JSON from text', async () => {
      const extractStructuredOutput = vi.fn().mockReturnValue({ foo: 'bar' })
      Object.assign(sdkSvc, { extractStructuredOutput })
      const handler = handlers.get(IPC_CHANNELS.SDK_EXTRACT_STRUCTURED)!

      const result = await handler({}, '{"foo":"bar"}', { strict: true })

      expect(extractStructuredOutput).toHaveBeenCalledWith('{"foo":"bar"}', { strict: true })
      expect(result).toEqual({ success: true, data: { foo: 'bar' } })
    })

    it('returns null for non-JSON text', async () => {
      const extractStructuredOutput = vi.fn().mockReturnValue(null)
      Object.assign(sdkSvc, { extractStructuredOutput })
      const handler = handlers.get(IPC_CHANNELS.SDK_EXTRACT_STRUCTURED)!

      const result = await handler({}, 'plain text', undefined)
      expect(result).toEqual({ success: true, data: null })
    })
  })

  // ===== SDK_BUILD_SCHEMA — moved to sdkPhase4.test.ts =====
  // (this handler is registered in registerSDKPhase4Handlers, not in sdkEnhancements)

  // ===== SDK_VIZ_MERMAID =====
  describe('SDK_VIZ_MERMAID', () => {
    it('generates mermaid string from VizWorkflow', async () => {
      const generate = vi.fn().mockReturnValue('graph TD; A-->B;')
      const getMermaidGenerator = vi.fn().mockReturnValue({ generate })
      Object.assign(sdkSvc, { getMermaidGenerator })
      const handler = handlers.get(IPC_CHANNELS.SDK_VIZ_MERMAID)!

      const vizInput = {
        nodes: [{ id: 'A', label: 'Start' }, { id: 'B', label: 'End' }],
        edges: [{ from: 'A', to: 'B' }],
      }
      const result = await handler({}, vizInput)

      expect(generate).toHaveBeenCalled()
      expect(result).toEqual({ success: true, data: 'graph TD; A-->B;' })
    })
  })

  // ===== SDK_WORKER_POOL_STATS =====
  describe('SDK_WORKER_POOL_STATS', () => {
    it('returns unavailable when pool is null', async () => {
      const getWorkerPool = vi.fn().mockReturnValue(null)
      Object.assign(sdkSvc, { getWorkerPool })
      const handler = handlers.get(IPC_CHANNELS.SDK_WORKER_POOL_STATS)!

      const result = await handler({})
      expect(result).toMatchObject({ success: true, data: { available: false } })
    })

    it('returns available stats when pool present', async () => {
      const getWorkerPool = vi.fn().mockReturnValue({
        stats: { active: 2, idle: 4, queued: 1, total: 7 },
      })
      Object.assign(sdkSvc, { getWorkerPool })
      const handler = handlers.get(IPC_CHANNELS.SDK_WORKER_POOL_STATS)!

      const result = await handler({})
      expect(result).toMatchObject({
        success: true,
        data: { available: true, active: 2, idle: 4, queued: 1, total: 7 },
      })
    })
  })

  // ===== SDK_AGENT_MONITOR_STATS =====
  describe('SDK_AGENT_MONITOR_STATS', () => {
    it('returns snapshot from AgentMonitor', async () => {
      const getAgentMonitor = vi.fn().mockReturnValue({
        getSnapshot: vi.fn().mockReturnValue({ status: 'running', agents: 3 }),
      })
      Object.assign(sdkSvc, { getAgentMonitor })
      const handler = handlers.get(IPC_CHANNELS.SDK_AGENT_MONITOR_STATS)!

      const result = await handler({})
      expect(result).toEqual({ success: true, data: { status: 'running', agents: 3 } })
    })
  })

  // ===== SDK_PLUGIN_LOAD =====
  describe('SDK_PLUGIN_LOAD', () => {
    it('loads a plugin and returns path', async () => {
      const load = vi.fn().mockResolvedValue(true)
      const getPluginLoader = vi.fn().mockReturnValue({ load })
      Object.assign(sdkSvc, { getPluginLoader })
      const handler = handlers.get(IPC_CHANNELS.SDK_PLUGIN_LOAD)!

      // 使用 plugins/ 目录下的有效路径
      const validPath = resolve(process.cwd(), 'plugins/my-plugin.js')
      const result = await handler({}, validPath)
      expect(load).toHaveBeenCalledWith(validPath)
      expect(result).toEqual({ success: true, data: { path: validPath, loaded: true } })
    })

    it('rejects paths outside plugins dir', async () => {
      const load = vi.fn().mockResolvedValue(true)
      const getPluginLoader = vi.fn().mockReturnValue({ load })
      Object.assign(sdkSvc, { getPluginLoader })
      const handler = handlers.get(IPC_CHANNELS.SDK_PLUGIN_LOAD)!

      const result = await handler({}, '/etc/evil.js')
      expect(load).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
    })
  })

  // ===== AGENT_CACHE_STATS / CLEAR / TOGGLE =====
  describe('AGENT_CACHE IPC', () => {
    it('AGENT_CACHE_STATS returns agentService.getCacheStats', async () => {
      const getCacheStats = vi.fn().mockReturnValue({ hits: 10, misses: 2, size: 100, hitRate: 0.83 })
      Object.assign(agentSvc, { getCacheStats })
      const handler = handlers.get(IPC_CHANNELS.AGENT_CACHE_STATS)!

      const result = await handler({})
      expect(result).toEqual({ success: true, data: { hits: 10, misses: 2, size: 100, hitRate: 0.83 } })
    })

    it('AGENT_CACHE_CLEAR calls clearCache and returns true', async () => {
      const clearCache = vi.fn()
      Object.assign(agentSvc, { clearCache })
      const handler = handlers.get(IPC_CHANNELS.AGENT_CACHE_CLEAR)!

      const result = await handler({})
      expect(clearCache).toHaveBeenCalled()
      expect(result).toEqual({ success: true, data: true })
    })

    it('AGENT_CACHE_TOGGLE calls setCacheEnabled', async () => {
      const setCacheEnabled = vi.fn()
      const isCacheEnabled = vi.fn().mockReturnValue(false)
      Object.assign(agentSvc, { setCacheEnabled, isCacheEnabled })
      const handler = handlers.get(IPC_CHANNELS.AGENT_CACHE_TOGGLE)!

      const result = await handler({}, false)
      expect(setCacheEnabled).toHaveBeenCalledWith(false)
      expect(result).toEqual({ success: true, data: false })
    })
  })
})
