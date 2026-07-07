import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { MicroAgent } from '../../src/main/services/MicroAgent'
import type { ProviderManager } from '../../src/main/services/ProviderManager'
import type { ToolManager } from '../../src/main/services/ToolManager'
import { MockProvider } from '@agentprimordia/sdk'

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}))

const mockReadFile = vi.mocked(readFile)

function createMockProvider(response: string) {
  return new MockProvider({ response })
}

function createProviderManager(mockResponse: string): ProviderManager {
  const pm = {
    createProvider: vi.fn().mockReturnValue(createMockProvider(mockResponse)),
    testConnection: vi.fn(),
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
    setResilienceConfig: vi.fn(),
    getResilienceConfig: vi.fn().mockReturnValue(null),
    getProviderBreakerStates: vi.fn().mockReturnValue({}),
    resetProviderBreaker: vi.fn(),
    setRateLimit: vi.fn(),
    getRateLimiter: vi.fn().mockReturnValue(null),
    getRateLimitRPM: vi.fn().mockReturnValue(0),
    getBatchProcessor: vi.fn(),
    batchProcess: vi.fn(),
    invalidateBatchProcessors: vi.fn(),
  }
  return pm as unknown as ProviderManager
}

function createToolManager(): ToolManager {
  const tm = {
    listTools: vi.fn().mockReturnValue([]),
    getRegistry: vi.fn().mockReturnValue({ list: vi.fn().mockReturnValue([]) }),
    getRootDir: vi.fn().mockReturnValue('/workspace'),
  }
  return tm as unknown as ToolManager
}

describe('MicroAgent', () => {
  let providerManager: ProviderManager
  let toolManager: ToolManager
  let agent: MicroAgent

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应返回修复 diff', async () => {
    const originalContent = 'function hello() { return "world" }'
    mockReadFile.mockResolvedValue(originalContent)

    const fixedContent = 'function hello(): string { return "world" }'
    const mockResp = JSON.stringify({ filePath: 'test.ts', fixedContent, description: '添加返回类型' })
    providerManager = createProviderManager(mockResp)
    toolManager = createToolManager()

    agent = new MicroAgent(providerManager, toolManager)
    const result = await agent.run('test.ts', '缺少返回类型注解')

    expect(result).not.toBeNull()
    expect(result!.filePath).toBe('test.ts')
    expect(result!.originalContent).toBe(originalContent)
    expect(result!.fixedContent).toBe(fixedContent)
    expect(result!.description).toBe('添加返回类型')
  })

  it('超时 5s 应终止', async () => {
    const originalContent = 'const x = 1'
    mockReadFile.mockResolvedValue(originalContent)

    const slowProvider = new MockProvider({ response: '{}', delay: 6000 })

    providerManager = {
      createProvider: vi.fn().mockReturnValue(slowProvider),
    } as unknown as ProviderManager
    toolManager = createToolManager()

    agent = new MicroAgent(providerManager, toolManager)

    await expect(agent.run('test.ts', 'test')).rejects.toThrow(/timeout|超时/i)
  })

  it('无问题应返回 null', async () => {
    const originalContent = 'const x: number = 1'
    mockReadFile.mockResolvedValue(originalContent)

    const mockResp = JSON.stringify({ noFixNeeded: true })
    providerManager = createProviderManager(mockResp)
    toolManager = createToolManager()

    agent = new MicroAgent(providerManager, toolManager)
    const result = await agent.run('test.ts', '已修复，无问题')

    expect(result).toBeNull()
  })
})
