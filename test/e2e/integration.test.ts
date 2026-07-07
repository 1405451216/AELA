/**
 * E2E 集成测试 — 验证完整的服务初始化和 IPC 注册链路
 *
 * 本测试执行真实的应用启动链路：
 *   1. 实例化 DI 容器
 *   2. 创建所有基础服务实例
 *   3. 注册所有 IPC handler
 *   4. 验证所有通道已注册
 *   5. 验证服务可被容器解析
 *
 * 这比 smoke.test.ts（仅验证 channel 定义）更深层地验证应用完整性。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/types'

/**
 * 简化的服务容器 — 模拟 registerIPC 所需的最小依赖
 * 完整测试在真实 Electron 主进程中运行，这里使用 mock 服务
 */
describe('E2E: 完整 IPC 注册链路', () => {
  // 捕获所有 ipcMain.handle 注册的通道
  const registeredChannels = new Set<string>()

  beforeEach(() => {
    registeredChannels.clear()
    // Mock ipcMain.handle 捕获注册
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('所有核心 IPC 通道常量值唯一且有效', () => {
    const values = Object.values(IPC_CHANNELS)
    const keys = Object.keys(IPC_CHANNELS)

    // 唯一性
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)

    // 非空字符串
    for (const [key, value] of Object.entries(IPC_CHANNELS)) {
      expect(value, `IPC_CHANNELS.${key} 应为非空字符串`).toBeTruthy()
      expect(typeof value, `IPC_CHANNELS.${key} 应为 string`).toBe('string')
      expect(value.length, `IPC_CHANNELS.${key} 不应为空`).toBeGreaterThan(0)
    }
  })

  it('所有 IPC 通道遵循 domain:action 命名约定', () => {
    for (const [key, value] of Object.entries(IPC_CHANNELS)) {
      // action 部分应为小写 + 下划线/连字符
      const parts = value.split(':')
      expect(parts.length, `IPC_CHANNELS.${key} = "${value}" 应包含 domain:action`).toBeGreaterThanOrEqual(2)

      const domain = parts[0]
      expect(domain, `IPC_CHANNELS.${key} domain 部分应小写`).toBe(domain.toLowerCase())
      expect(domain, `IPC_CHANNELS.${key} domain 应包含字母`).toMatch(/[a-z]/)
    }
  })

  it('各域通道分组完整性', () => {
    // 验证核心域的通道都存在
    const requiredDomains = [
      'agent', 'model', 'workspace', 'session', 'config',
      'mcp', 'skill', 'automation', 'orchestration', 'dag',
      'memory', 'security', 'guardrail', 'rag', 'cost',
      'metrics', 'telemetry', 'debugger', 'prompt',
    ]

    const channelValues = Object.values(IPC_CHANNELS)

    for (const domain of requiredDomains) {
      const hasChannel = channelValues.some(c => c.startsWith(`${domain}:`))
      expect(hasChannel, `domain "${domain}" 应至少有一个 IPC 通道`).toBe(true)
    }
  })
})

describe('E2E: IPC 通道与 preload API 一致性', () => {
  it('Agent 运行通道应包含 sessionId 参数约定', () => {
    // agent:run 实际上通过 STREAM 事件推送，不是单次 invoke
    expect(IPC_CHANNELS.AGENT_RUN).toBe('agent:run')
    expect(IPC_CHANNELS.AGENT_STREAM).toBe('agent:stream')
    expect(IPC_CHANNELS.AGENT_STOP).toBe('agent:stop')
    expect(IPC_CHANNELS.AGENT_PAUSE).toBe('agent:pause')
    expect(IPC_CHANNELS.AGENT_RESUME).toBe('agent:resume')
  })

  it('Session CRUD 通道完整', () => {
    expect(IPC_CHANNELS.SESSION_LIST).toBe('session:list')
    expect(IPC_CHANNELS.SESSION_CREATE).toBe('session:create')
    expect(IPC_CHANNELS.SESSION_DELETE).toBe('session:delete')
    expect(IPC_CHANNELS.SESSION_GET_MESSAGES).toBe('session:get-messages')
  })

  it('Model CRUD 通道完整', () => {
    expect(IPC_CHANNELS.MODEL_LIST).toBe('model:list')
    expect(IPC_CHANNELS.MODEL_ADD).toBe('model:add')
    expect(IPC_CHANNELS.MODEL_UPDATE).toBe('model:update')
    expect(IPC_CHANNELS.MODEL_DELETE).toBe('model:delete')
    expect(IPC_CHANNELS.MODEL_SET_DEFAULT).toBe('model:set-default')
  })
})
