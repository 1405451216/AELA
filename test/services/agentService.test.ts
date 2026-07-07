/**
 * AgentService 单元测试
 *
 * 覆盖: 构造函数注入 / wireDependencies / 生命周期控制 / Provider 管理 / 错误处理 / runStream 边界
 * 使用 mock 替代 electron-store 依赖的 ConfigStore / SessionStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private data: Record<string, any>
      constructor(opts: any) {
        this.data = opts?.defaults ?? {}
      }
      get(key: string, defaultValue?: any) {
        return this.data[key] ?? defaultValue
      }
      set(key: string, value: any) {
        this.data[key] = value
      }
    }
  }
})

function createMockConfigStore(overrides: Record<string, unknown> = {}) {
  const models = new Map<string, any>()
  const config = {
    theme: 'dark' as const,
    language: 'zh' as const,
    defaultModelId: null as string | null,
    defaultSystemPrompt: 'test prompt',
    maxTurns: 5,
    maxMessages: 20,
    fontSize: 14,
    sendOnEnter: true,
    globalMemory: '',
    customRules: '',
    includeAgentsMd: false,
    includeClaudeMd: false,
    promptVariant: 'default' as const,
    slashCommands: [],
    ...overrides,
  }

  return {
    getConfig: vi.fn(() => config),
    setConfig: vi.fn((partial: any) => ({ ...config, ...partial })),
    getModel: vi.fn((id: string) => models.get(id) || undefined),
    addModel: vi.fn((m: any) => { models.set(m.id, m); return m }),
    updateModel: vi.fn((id: string, partial: any) => {
      const m = models.get(id)
      if (m) { models.set(id, { ...m, ...partial }); return models.get(id) }
      return undefined
    }),
    deleteModel: vi.fn((id: string) => models.delete(id)),
    setDefaultModelId: vi.fn((id: string) => { config.defaultModelId = id; return true }),
    getWorkspaces: vi.fn(() => []),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    getMCPServers: vi.fn(() => []),
    getMCPServer: vi.fn(() => undefined),
    addMCPServer: vi.fn(),
    updateMCPServer: vi.fn(),
    deleteMCPServer: vi.fn(),
  }
}

function createMockSessionStore() {
  const sessions = new Map<string, any>()
  const messages = new Map<string, any[]>()

  return {
    createSession: vi.fn((params: any) => {
      const session = {
        id: params.id || 'test-session-id',
        title: params.title || 'Test',
        workspaceId: params.workspaceId || null,
        modelConfigId: params.modelConfigId || null,
        systemPrompt: params.systemPrompt || '',
        activeSkillIds: params.activeSkillIds || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      sessions.set(session.id, session)
      messages.set(session.id, [])
      return session
    }),
    getSession: vi.fn((id: string) => sessions.get(id) || null),
    listSessions: vi.fn(() => Array.from(sessions.values())),
    deleteSession: vi.fn((id: string) => sessions.delete(id)),
    updateSession: vi.fn((id: string, partial: any) => {
      const s = sessions.get(id)
      if (s) { sessions.set(id, { ...s, ...partial }); return sessions.get(id) }
      return null
    }),
    updateActiveSkillIds: vi.fn((id: string, skillIds: string[]) => {
      const s = sessions.get(id)
      if (s) { s.activeSkillIds = skillIds; return s }
      return null
    }),
    getMessages: vi.fn((sessionId: string) => messages.get(sessionId) || []),
    addMessage: vi.fn((msg: any) => {
      const msgs = messages.get(msg.sessionId) || []
      msgs.push(msg)
      messages.set(msg.sessionId, msgs)
    }),
  }
}

function createMockDeps() {
  return {
    memoryService: { addEpisode: vi.fn(), search: vi.fn(), list: vi.fn() } as any,
    costTracker: { record: vi.fn(), summary: vi.fn(() => ({ totalCostUSD: 0 })) } as any,
    contextWindow: { compress: vi.fn(), estimateTokenCount: vi.fn(() => 100), estimateTokens: vi.fn(() => 100), measure: vi.fn(() => ({ budget: 1000, usage: 0.5 })) } as any,
    hitlService: { shouldInterrupt: vi.fn(() => false), requestInterrupt: vi.fn() } as any,
    auditService: { logToolCall: vi.fn() } as any,
    toolLearningService: { recordSuccess: vi.fn(), recordFailure: vi.fn() } as any,
    promptService: { hasFewShot: vi.fn(() => false), createFewShot: vi.fn(() => { const o: any = {}; o.addExample = vi.fn(function(this: any) { return this }); return o }), renderFewShot: vi.fn(() => '') } as any,
    hookConfigService: { getRules: vi.fn(() => []) } as any,
    guardrailService: { check: vi.fn() } as any,
    securityService: { isAllowed: vi.fn(() => true) } as any,
    modelRouter: { suggest: vi.fn() } as any,
  }
}

import { ObservabilityService } from '../../src/main/services/ObservabilityService'
import { AgentService } from '../../src/main/services/AgentService'

describe('AgentService', () => {
  let tempDir: string
  let configStore: ReturnType<typeof createMockConfigStore>
  let sessionStore: ReturnType<typeof createMockSessionStore>
  let observability: ObservabilityService
  let agentService: AgentService

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aela-as-'))
    configStore = createMockConfigStore()
    sessionStore = createMockSessionStore()
    observability = new ObservabilityService()
  })

  afterEach(async () => {
    agentService?.close()
    await rm(tempDir, { recursive: true, force: true })
  })

  // ===== 构造与初始化 =====

  describe('构造与初始化', () => {
    it('应正确创建实例（无 deps）', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      expect(agentService).toBeDefined()
    })

    it('应正确创建实例（带 deps）', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability, createMockDeps())
      expect(agentService).toBeDefined()
    })

    it('初始时 toolManager 应为 null', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      expect(agentService.getToolManager()).toBeNull()
    })

    it('应返回 providerManager 实例', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      expect(agentService.getProviderManager()).toBeDefined()
    })

    it('应返回 observability 实例', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      expect(agentService.getObservability()).toBe(observability)
    })
  })

  // ===== 依赖注入 =====

  describe('依赖注入', () => {
    it('构造函数注入后 getCostTracker 应返回实例', () => {
      const deps = createMockDeps()
      agentService = new AgentService(configStore as any, sessionStore as any, observability, deps)
      expect(agentService.getCostTracker()).toBe(deps.costTracker)
    })

    it('构造函数注入后 getContextWindow 应返回实例', () => {
      const deps = createMockDeps()
      agentService = new AgentService(configStore as any, sessionStore as any, observability, deps)
      expect(agentService.getContextWindow()).toBe(deps.contextWindow)
    })

    it('构造函数注入后 getHITLService 应返回实例', () => {
      const deps = createMockDeps()
      agentService = new AgentService(configStore as any, sessionStore as any, observability, deps)
      expect(agentService.getHITLService()).toBe(deps.hitlService)
    })

    it('wireDependencies 应覆盖构造函数注入', () => {
      const deps1 = createMockDeps()
      const deps2 = createMockDeps()
      agentService = new AgentService(configStore as any, sessionStore as any, observability, deps1)
      agentService.wireDependencies(deps2)
      expect(agentService.getCostTracker()).toBe(deps2.costTracker)
    })

    it('无 deps 构造时 getCostTracker 应为 null', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      expect(agentService.getCostTracker()).toBeNull()
    })
  })

  // ===== 工作区设置 =====

  describe('工作区设置', () => {
    beforeEach(() => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
    })

    it('setWorkspace 应创建 ToolManager', () => {
      agentService.setWorkspace(tempDir)
      const tm = agentService.getToolManager()
      expect(tm).not.toBeNull()
      expect(tm!.getRootDir()).toBe(tempDir)
    })

    it('setWorkspace 多次调用应更新 ToolManager 的 rootDir', () => {
      agentService.setWorkspace(tempDir)
      const tm1 = agentService.getToolManager()
      expect(tm1!.getRootDir()).toBe(tempDir)

      const newDir = join(tempDir, 'sub')
      agentService.setWorkspace(newDir)
      const tm2 = agentService.getToolManager()
      expect(tm2!.getRootDir()).toBe(newDir)
    })
  })

  // ===== Shell 确认回调 =====

  describe('Shell 确认回调', () => {
    beforeEach(() => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
    })

    it('setShellConfirmCallback 不应抛出异常（无 ToolManager 时）', () => {
      expect(() => agentService.setShellConfirmCallback(async () => ({ approved: true }))).not.toThrow()
    })

    it('setShellConfirmCallback 有 ToolManager 时应传递回调', () => {
      agentService.setWorkspace(tempDir)
      expect(() => agentService.setShellConfirmCallback(async () => ({ approved: true }))).not.toThrow()
    })
  })

  // ===== 生命周期控制 =====

  describe('生命周期控制', () => {
    beforeEach(() => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
    })

    it('stop 未运行的会话不应抛出异常', () => {
      expect(() => agentService.stop('nonexistent-session')).not.toThrow()
    })

    it('pause 未运行的会话不应抛出异常', () => {
      expect(() => agentService.pause('nonexistent-session')).not.toThrow()
    })

    it('resume 未运行的会话不应抛出异常', () => {
      expect(() => agentService.resume('nonexistent-session')).not.toThrow()
    })

    it('getStatus 未运行的会话应返回 idle', () => {
      expect(agentService.getStatus('nonexistent-session')).toBe('idle')
    })
  })

  // ===== Provider 管理 =====

  describe('Provider 管理', () => {
    beforeEach(() => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
    })

    it('invalidateProvider 不应抛出异常', () => {
      expect(() => agentService.invalidateProvider('some-model-id')).not.toThrow()
    })

    it('testModel 应委托给 providerManager', async () => {
      const result = await agentService.testModel({
        id: 'test',
        name: 'Test Model',
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test',
        baseURL: 'https://api.openai.com/v1',
        createdAt: new Date().toISOString(),
      } as any)
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  // ===== runStream 错误处理 =====

  describe('runStream 错误处理', () => {
    beforeEach(() => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
    })

    it('模型配置不存在时应 yield error 事件', async () => {
      configStore.getModel.mockReturnValue(undefined)

      const events: any[] = []
      for await (const event of agentService.runStream({
        sessionId: 'test-session',
        input: 'hello',
        modelConfigId: 'nonexistent',
      })) {
        events.push(event)
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent!.error.message).toContain('未找到模型配置')
    })

    it('模型配置存在但 Provider 创建失败时应 yield error 事件', async () => {
      configStore.getModel.mockReturnValue({
        id: 'bad-model',
        name: 'Bad',
        provider: 'invalid-provider',
        model: 'nonexistent-model',
        apiKey: '',
        baseURL: '',
        createdAt: new Date().toISOString(),
      })

      const events: any[] = []
      for await (const event of agentService.runStream({
        sessionId: 'test-session',
        input: 'hello',
        modelConfigId: 'bad-model',
      })) {
        events.push(event)
        if (events.length > 5) break
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
    })

    it('ToolManager 未初始化时应 yield error 事件', async () => {
      configStore.getModel.mockReturnValue({
        id: 'test-model',
        name: 'Test',
        provider: 'ollama',
        model: 'llama3',
        apiKey: '',
        baseURL: 'http://localhost:11434',
        createdAt: new Date().toISOString(),
      })

      const events: any[] = []
      for await (const event of agentService.runStream({
        sessionId: 'test-session-no-tm',
        input: 'hello',
        modelConfigId: 'test-model',
      })) {
        events.push(event)
        if (events.length > 5) break
      }

      const errorEvent = events.find(e => e.type === 'error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent!.error.message).toContain('ToolManager')
    })
  })

  // ===== close =====

  describe('close', () => {
    it('close 不应抛出异常（无活跃 Agent 时）', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      expect(() => agentService.close()).not.toThrow()
    })

    it('close 有 ToolManager 时应清理资源', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      agentService.setWorkspace(tempDir)
      expect(() => agentService.close()).not.toThrow()
    })
  })

  // ===== Observability 集成 =====

  describe('Observability 集成', () => {
    beforeEach(() => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
    })

    it('getObservability 应返回注入的 ObservabilityService', () => {
      expect(agentService.getObservability()).toBe(observability)
    })

    it('ObservabilityService 的 metricsCollector 应可用', () => {
      const mc = observability.getMetricsCollector()
      expect(mc).toBeDefined()
    })

    it('ObservabilityService 的 bus 应可用', () => {
      const bus = observability.getBus()
      expect(bus).toBeDefined()
    })
  })

  // ===== AgentContextBuilder 集成 =====

  describe('AgentContextBuilder 集成', () => {
    it('contextBuilder 应在构造时创建', () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      const internalBuilder = (agentService as any).contextBuilder
      expect(internalBuilder).toBeDefined()
    })

    it('wireDependencies 应同步注入到 contextBuilder', () => {
      const deps = createMockDeps()
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      agentService.wireDependencies(deps)

      const internalBuilder = (agentService as any).contextBuilder
      expect(internalBuilder._memoryService).toBe(deps.memoryService)
      expect(internalBuilder._guardrailService).toBe(deps.guardrailService)
      expect(internalBuilder._modelRouter).toBe(deps.modelRouter)
    })

    it('构造函数注入应同步设置 contextBuilder 依赖', () => {
      const deps = createMockDeps()
      agentService = new AgentService(configStore as any, sessionStore as any, observability, deps)

      const internalBuilder = (agentService as any).contextBuilder
      expect(internalBuilder._memoryService).toBe(deps.memoryService)
      expect(internalBuilder._guardrailService).toBe(deps.guardrailService)
      expect(internalBuilder._modelRouter).toBe(deps.modelRouter)
    })

    it('Guardrail 拦截时应通过 contextBuilder 抛出错误', async () => {
      configStore.getModel.mockReturnValue({
        id: 'test-model',
        name: 'Test',
        provider: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-valid-key-for-test',
        baseURL: 'https://api.openai.com/v1',
        createdAt: new Date().toISOString(),
      })

      const deps = createMockDeps()
      deps.guardrailService.check = vi.fn().mockReturnValue({
        passed: false,
        action: 'reject',
        results: [{ message: '检测到注入攻击' }],
      })

      agentService = new AgentService(configStore as any, sessionStore as any, observability, deps)

      const events: any[] = []
      for await (const event of agentService.runStream({
        sessionId: 'test-session',
        input: 'malicious input',
        modelConfigId: 'test-model',
      })) {
        events.push(event)
        if (events.length > 3) break
      }

      const errorEvent = events.find((e: any) => e.type === 'error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent.error.message).toContain('安全护栏拦截')
    })
  })

  // ===== 并发保护 =====

  describe('并发保护', () => {
    it('同一会话并发 runStream 应被拒绝', async () => {
      agentService = new AgentService(configStore as any, sessionStore as any, observability)
      agentService.setWorkspace(tempDir)

      configStore.getModel.mockReturnValue({
        id: 'test-model',
        name: 'Test',
        provider: 'ollama',
        model: 'llama3',
        apiKey: '',
        baseURL: 'http://localhost:11434',
        createdAt: new Date().toISOString(),
      })

      // 第一次 runStream 会因为 ToolManager 未初始化而立即返回 error
      // 但我们需要测试 sessionManager 的并发保护
      // 直接测试 sessionManager 的行为
      const sessionId = 'concurrent-test'
      const events1: any[] = []
      const gen1 = agentService.runStream({
        sessionId,
        input: 'hello',
        modelConfigId: 'test-model',
      })

      // 消费第一个事件（注册占位）
      const first = await gen1.next()
      events1.push(first.value)

      // 同一会话第二次 runStream 应该被拒绝
      const events2: any[] = []
      for await (const event of agentService.runStream({
        sessionId,
        input: 'hello again',
        modelConfigId: 'test-model',
      })) {
        events2.push(event)
      }

      expect(events2.some(e => e.type === 'error')).toBe(true)
      const errorMsg = events2.find(e => e.type === 'error')?.error?.message
      expect(errorMsg).toContain('已有 Agent 正在运行')

      // 清理
      await gen1.return?.(undefined)
    })
  })
})
