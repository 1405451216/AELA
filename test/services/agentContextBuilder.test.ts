/**
 * AgentContextBuilder 单元测试
 *
 * 覆盖: 模型配置获取 / Guardrail 拦截 / Provider 创建 / 技能处理 / MCP 工具收集
 * 使用 mock 替代所有服务依赖，隔离测试 Builder 逻辑
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AgentContextBuilder, AgentContextError } from '../../src/main/services/AgentContextBuilder'
import type { Provider } from '@agentprimordia/sdk'

// ===== Mock 依赖 =====

function createMockDeps(overrides: Record<string, unknown> = {}) {
  const models = new Map<string, any>([
    ['model-1', { id: 'model-1', name: 'Test Model', provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' }],
  ])

  const config = {
    theme: 'dark' as const,
    language: 'zh' as const,
    maxTurns: 5,
    maxMessages: 20,
    promptVariant: 'default' as const,
    includeAgentsMd: false,
    includeClaudeMd: false,
    ...overrides,
  }

  return {
    configStore: {
      getModel: vi.fn((id: string) => models.get(id)),
      getConfig: vi.fn(() => config),
    },
    providerManager: {
      createProvider: vi.fn().mockReturnValue({ name: 'mock-provider' } as unknown as Provider),
    },
    toolManager: {
      setSessionContext: vi.fn(),
      getRootDir: vi.fn(() => '/test/workspace'),
      registerSkillAsTool: vi.fn(),
      getMCPStatus: vi.fn(() => []),
    },
    memoryService: {
      hybridSearchScored: vi.fn(async () => []),
      addEpisode: vi.fn(async () => {}),
    },
    guardrailService: {
      check: vi.fn(() => ({ passed: true, action: 'pass', results: [] })),
    },
    modelRouter: {
      suggest: vi.fn(() => ({ modelName: 'gpt-4o', reason: 'test', strategy: 'balanced', estimatedCost: 0.01 })),
    },
    observability: {
      publish: vi.fn(),
    },
    promptService: {
      renderFewShot: vi.fn(() => ''),
    },
  }
}

describe('AgentContextBuilder', () => {
  let deps: ReturnType<typeof createMockDeps>
  let builder: AgentContextBuilder

  beforeEach(() => {
    deps = createMockDeps()
    builder = new AgentContextBuilder(
      deps.configStore as any,
      deps.providerManager as any,
      deps.observability as any,
      { cacheEnabled: false }
    )
    builder.setToolManager(deps.toolManager as any)
    builder.setMemoryService(deps.memoryService as any)
    builder.setGuardrailService(deps.guardrailService as any)
    builder.setModelRouter(deps.modelRouter as any)
    builder.setPromptService(deps.promptService as any)
  })

  // ===== 模型配置获取 =====

  describe('模型配置验证', () => {
    it('模型不存在时抛出 AgentContextError', async () => {
      await expect(
        builder.build({
          sessionId: 'test-session',
          input: 'test input',
          modelConfigId: 'nonexistent-model',
        })
      ).rejects.toThrow(AgentContextError)
    })

    it('模型存在时正常构建', async () => {
      const ctx = await builder.build({
        sessionId: 'test-session',
        input: 'test input',
        modelConfigId: 'model-1',
      })

      expect(ctx.modelConfig.id).toBe('model-1')
      expect(ctx.sessionId).toBe('test-session')
    })
  })

  // ===== Guardrail 安全检查 =====

  describe('Guardrail 输入检查', () => {
    it('安全护栏拦截时抛出 AgentContextError', async () => {
      deps.guardrailService.check.mockReturnValue({
        passed: false,
        action: 'reject',
        results: [{ message: '检测到注入攻击' }],
      })

      await expect(
        builder.build({
          sessionId: 'test-session',
          input: 'malicious input',
          modelConfigId: 'model-1',
        })
      ).rejects.toThrow('输入被安全护栏拦截')
    })

    it('安全护栏通过时继续执行', async () => {
      deps.guardrailService.check.mockReturnValue({
        passed: true,
        action: 'pass',
        results: [],
      })

      const ctx = await builder.build({
        sessionId: 'test-session',
        input: 'safe input',
        modelConfigId: 'model-1',
      })

      expect(ctx).toBeDefined()
    })
  })

  // ===== Provider 创建 =====

  describe('Provider 创建', () => {
    it('成功创建 Provider', async () => {
      const mockProvider = { name: 'test-provider' }
      deps.providerManager.createProvider.mockReturnValue(mockProvider as unknown as Provider)

      const ctx = await builder.build({
        sessionId: 'test-session',
        input: 'test',
        modelConfigId: 'model-1',
      })

      expect(ctx.provider).toBe(mockProvider)
    })

    it('Provider 创建失败时抛出 AgentContextError', async () => {
      deps.providerManager.createProvider.mockImplementation(() => {
        throw new Error('API Key 无效')
      })

      await expect(
        builder.build({
          sessionId: 'test-session',
          input: 'test',
          modelConfigId: 'model-1',
        })
      ).rejects.toThrow('创建 Provider 失败')
    })
  })

  // ===== 技能处理 =====

  describe('技能处理', () => {
    it('asTool 技能注册到 ToolManager', async () => {
      const skills = [
        { id: 'skill-1', name: 'Test Tool Skill', asTool: true, description: '', content: '' },
      ]

      await builder.build({
        sessionId: 'test-session',
        input: 'test',
        modelConfigId: 'model-1',
        activeSkills: skills as any,
      })

      expect(deps.toolManager.registerSkillAsTool).toHaveBeenCalledWith(skills[0])
    })

    it('非 asTool 技能生成提示文本', async () => {
      const skills = [
        { id: 'skill-2', name: 'Prompt Skill', asTool: false, description: 'A skill', content: 'skill content here' },
      ]

      const ctx = await builder.build({
        sessionId: 'test-session',
        input: 'test',
        modelConfigId: 'model-1',
        activeSkills: skills as any,
      })

      expect(ctx.systemPrompt).toContain('Prompt Skill')
      expect(ctx.systemPrompt).toContain('skill content here')
    })
  })

  // ===== MCP 工具收集 =====

  describe('MCP 工具收集', () => {
    it('收集已连接 MCP 服务器的工具', async () => {
      deps.toolManager.getMCPStatus.mockReturnValue([
        { connected: true, tools: [{ name: 'mcp_search', description: 'Search tool' }] },
        { connected: false, tools: [{ name: 'mcp_other', description: 'Should be excluded' }] },
      ])

      const ctx = await builder.build({
        sessionId: 'test-session',
        input: 'test',
        modelConfigId: 'model-1',
      })

      // MCP 工具信息会出现在系统提示词中
      expect(ctx.systemPrompt).toContain('mcp_search')
      expect(ctx.systemPrompt).not.toContain('mcp_other')
    })
  })

  // ===== 记忆检索 =====

  describe('记忆检索', () => {
    it('检索到记忆时注入系统提示词', async () => {
      deps.memoryService.hybridSearchScored.mockResolvedValue([
        { episode: { id: 'ep-1', role: 'user', content: 'previous question', createdAt: new Date().toISOString() } },
      ] as any)

      const ctx = await builder.build({
        sessionId: 'test-session',
        input: 'related question',
        modelConfigId: 'model-1',
      })

      expect(ctx.systemPrompt).toContain('相关记忆')
      expect(ctx.systemPrompt).toContain('previous question')
    })

    it('无记忆时不注入', async () => {
      deps.memoryService.hybridSearchScored.mockResolvedValue([])

      const ctx = await builder.build({
        sessionId: 'test-session',
        input: 'new question',
        modelConfigId: 'model-1',
      })

      expect(ctx.systemPrompt).not.toContain('相关记忆')
    })
  })

  // ===== 返回结构 =====

  describe('返回结构完整性', () => {
    it('包含所有必要字段', async () => {
      const ctx = await builder.build({
        sessionId: 'sess-123',
        input: 'hello',
        modelConfigId: 'model-1',
        mode: 'code',
        permissionLevel: 'auto_edit',
      })

      expect(ctx).toHaveProperty('modelConfig')
      expect(ctx).toHaveProperty('provider')
      expect(ctx).toHaveProperty('systemPrompt')
      expect(ctx).toHaveProperty('activeSkills')
      expect(ctx.sessionId).toBe('sess-123')
      expect(ctx.permissionLevel).toBe('auto_edit')
    })
  })
})
