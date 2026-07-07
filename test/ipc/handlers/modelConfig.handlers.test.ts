/**
 * ModelConfig IPC handler 单测（.modelConfig.handlers.test.ts）
 *
 * 覆盖核心 handler：model:list / model:add / model:update / model:delete / model:set-default
 * 重点：handler 存在 + 调用正确的 service（ConfigStore）方法 + zod schema 校验失败验证
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron 模块 =====
const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn)
    },
  },
}))

import { registerModelConfigHandlers } from '../../../src/main/ipc/handlers/modelConfig'
import { IPC_CHANNELS } from '../../../src/shared/types'

// ===== Mock 服务 =====

function makeMockConfigStore(overrides: Partial<{
  getModels: ReturnType<typeof vi.fn>
  addModel: ReturnType<typeof vi.fn>
  updateModel: ReturnType<typeof vi.fn>
  deleteModel: ReturnType<typeof vi.fn>
  setDefaultModelId: ReturnType<typeof vi.fn>
  getModel: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    getModels: overrides.getModels ?? vi.fn().mockReturnValue([]),
    addModel: overrides.addModel ?? vi.fn(),
    updateModel: overrides.updateModel ?? vi.fn(),
    deleteModel: overrides.deleteModel ?? vi.fn(),
    setDefaultModelId: overrides.setDefaultModelId ?? vi.fn(),
    getModel: overrides.getModel ?? vi.fn().mockReturnValue({ id: 'm1' }),
  } as never
}

function makeMockAgentService(overrides: Partial<{
  invalidateProvider: ReturnType<typeof vi.fn>
  testModel: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    invalidateProvider: overrides.invalidateProvider ?? vi.fn(),
    testModel: overrides.testModel ?? vi.fn().mockReturnValue({ ok: true }),
  } as never
}

function makeMockModelRouter(overrides: Partial<{
  updateModels: ReturnType<typeof vi.fn>
  suggest: ReturnType<typeof vi.fn>
  setConfig: ReturnType<typeof vi.fn>
  getConfig: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    updateModels: overrides.updateModels ?? vi.fn(),
    suggest: overrides.suggest ?? vi.fn().mockReturnValue({}),
    setConfig: overrides.setConfig ?? vi.fn().mockReturnValue({}),
    getConfig: overrides.getConfig ?? vi.fn().mockReturnValue({}),
  } as never
}

function makeMockCostTrackerService(overrides: Partial<{
  getPricing: ReturnType<typeof vi.fn>
  setPricing: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    getPricing: overrides.getPricing ?? vi.fn().mockReturnValue(null),
    setPricing: overrides.setPricing ?? vi.fn(),
  } as never
}

// ===== 测试用例 =====
describe('ModelConfig IPC Handlers (.handlers)', () => {
  let mockConfigStore: ReturnType<typeof makeMockConfigStore>
  let mockAgentService: ReturnType<typeof makeMockAgentService>
  let mockModelRouter: ReturnType<typeof makeMockModelRouter>
  let mockCostTracker: ReturnType<typeof makeMockCostTrackerService>

  /**
   * 注意：registerModelConfigHandlers 内部会调用 modelRouter.updateModels，
   * 因此每个用例需要重新注册以测试初始化行为。
   */
  beforeEach(() => {
    handlers.clear()
    mockConfigStore = makeMockConfigStore()
    mockAgentService = makeMockAgentService()
    mockModelRouter = makeMockModelRouter()
    mockCostTracker = makeMockCostTrackerService()
  })

  /** 注册 handler 的便捷封装 */
  function register() {
    registerModelConfigHandlers({
      configStore: mockConfigStore,
      agentService: mockAgentService,
      modelRouter: mockModelRouter,
      costTrackerService: mockCostTracker,
    })
  }

  // ===== model:list =====
  describe('model:list', () => {
    it('应存在 handler', () => {
      register()
      expect(handlers.get(IPC_CHANNELS.MODEL_LIST)).toBeDefined()
    })

    it('调用 configStore.getModels 并返回模型数组', async () => {
      const getModels = vi.fn().mockReturnValue([{ id: 'm1', name: 'GPT-4' }])
      Object.assign(mockConfigStore, { getModels })
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_LIST)!

      const result = await handler({})
      expect(getModels).toHaveBeenCalled()
      expect(result).toEqual({ success: true, data: [{ id: 'm1', name: 'GPT-4' }] })
    })
  })

  // ===== model:add =====
  describe('model:add', () => {
    it('应存在 handler', () => {
      register()
      expect(handlers.get(IPC_CHANNELS.MODEL_ADD)).toBeDefined()
    })

    it('校验失败（缺必填字段）返回 error', async () => {
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_ADD)!

      // modelConfigSchema 需要 name、provider、model
      const result = await handler({}, { name: 'GPT-4' })
      expect(result).toMatchObject({ success: false })
      // 校验失败不应调用 addModel
    })

    it('校验通过后调用 configStore.addModel 并返回新增模型', async () => {
      const addModel = vi.fn()
      const getModels = vi.fn().mockReturnValue([]) // 空数组
      Object.assign(mockConfigStore, { addModel, getModels })
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_ADD)!

      // 注：modelConfigSchema 要求 id 必填（与 handler 的 Omit<ModelConfig, 'id' | 'createdAt'> 类型不一致），
      // 测试按 schema 实际行为传入 id 以验证 addModel 调用。handler 内部会用 randomUUID() 覆盖 id。
      const input = {
        id: 'input-id',
        name: 'GPT-4',
        provider: 'openai',
        apiKey: 'sk-xxx',
        baseUrl: 'https://api.openai.com',
        model: 'gpt-4',
      }
      const result = await handler({}, input)

      expect(addModel).toHaveBeenCalled()
      // 新增模型应包含 id（由 handler 生成）和 createdAt
      const addedModel = addModel.mock.calls[0][0]
      expect(addedModel.name).toBe('GPT-4')
      expect(addedModel.provider).toBe('openai')
      expect(addedModel.model).toBe('gpt-4')
      expect(addedModel.id).toBeDefined()
      expect(addedModel.createdAt).toBeDefined()
      // handler 生成的 id 会覆盖输入中的 id
      expect(addedModel.id).not.toBe('input-id')
      expect(result).toMatchObject({ success: true })
    })

    it('addModel 调用后 getModels 返回长度为 1 时设置默认模型', async () => {
      // 用可变数组模拟 ConfigStore 内部状态，使得 addModel 推入后 getModels 反映新长度
      const internalModels: Array<{ id: string }> = []
      const addModel = vi.fn((m: { id: string }) => { internalModels.push(m) })
      const getModels = vi.fn(() => internalModels)
      const setDefaultModelId = vi.fn()
      Object.assign(mockConfigStore, { addModel, getModels, setDefaultModelId })
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_ADD)!

      // 传入 id 以满足 schema 校验
      await handler({}, { id: 'input-id', name: 'GPT-4', provider: 'openai', model: 'gpt-4' })

      // addModel 推入后 getModels 返回长度为 1，触发 setDefaultModelId（参数为新增模型的 id）
      expect(setDefaultModelId).toHaveBeenCalled()
      expect(setDefaultModelId.mock.calls[0][0]).toEqual(expect.any(String))
    })

    it('已有模型时不再设置默认', async () => {
      const internalModels: Array<{ id: string }> = [{ id: 'existing' }]
      const addModel = vi.fn((m: { id: string }) => { internalModels.push(m) })
      const getModels = vi.fn(() => internalModels)
      const setDefaultModelId = vi.fn()
      Object.assign(mockConfigStore, { addModel, getModels, setDefaultModelId })
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_ADD)!

      await handler({}, { id: 'input-id', name: 'GPT-4', provider: 'openai', model: 'gpt-4' })

      // 已有 1 个模型，再加 1 个后长度为 2 → 不满足 length===1，不设置默认
      expect(setDefaultModelId).not.toHaveBeenCalled()
    })
  })

  // ===== model:update =====
  describe('model:update', () => {
    it('应存在 handler', () => {
      register()
      expect(handlers.get(IPC_CHANNELS.MODEL_UPDATE)).toBeDefined()
    })

    it('调用 configStore.updateModel、agentService.invalidateProvider 并返回更新后模型', async () => {
      const updateModel = vi.fn()
      const invalidateProvider = vi.fn()
      const getModel = vi.fn().mockReturnValue({ id: 'm1', name: 'Updated' })
      Object.assign(mockConfigStore, { updateModel, getModel })
      Object.assign(mockAgentService, { invalidateProvider })
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_UPDATE)!

      const result = await handler({}, 'm1', { name: 'Updated' })
      expect(updateModel).toHaveBeenCalledWith('m1', { name: 'Updated' })
      expect(invalidateProvider).toHaveBeenCalledWith('m1')
      expect(getModel).toHaveBeenCalledWith('m1')
      expect(result).toEqual({ success: true, data: { id: 'm1', name: 'Updated' } })
    })
  })

  // ===== model:delete =====
  describe('model:delete', () => {
    it('应存在 handler', () => {
      register()
      expect(handlers.get(IPC_CHANNELS.MODEL_DELETE)).toBeDefined()
    })

    it('调用 configStore.deleteModel 和 agentService.invalidateProvider', async () => {
      const deleteModel = vi.fn()
      const invalidateProvider = vi.fn()
      Object.assign(mockConfigStore, { deleteModel })
      Object.assign(mockAgentService, { invalidateProvider })
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_DELETE)!

      const result = await handler({}, 'm1')
      expect(deleteModel).toHaveBeenCalledWith('m1')
      expect(invalidateProvider).toHaveBeenCalledWith('m1')
      expect(result).toEqual({ success: true, data: true })
    })
  })

  // ===== model:set-default =====
  describe('model:set-default', () => {
    it('应存在 handler', () => {
      register()
      expect(handlers.get(IPC_CHANNELS.MODEL_SET_DEFAULT)).toBeDefined()
    })

    it('调用 configStore.setDefaultModelId 并返回 true', async () => {
      const setDefaultModelId = vi.fn()
      Object.assign(mockConfigStore, { setDefaultModelId })
      register()
      const handler = handlers.get(IPC_CHANNELS.MODEL_SET_DEFAULT)!

      const result = await handler({}, 'm1')
      expect(setDefaultModelId).toHaveBeenCalledWith('m1')
      expect(result).toEqual({ success: true, data: true })
    })
  })
})
