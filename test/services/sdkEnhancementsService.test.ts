/**
 * SDKEnhancementsService 单元测试
 *
 * 覆盖: A/B测试管理 / 评估套件 / 动态编排 / 插件加载 / Worker线程池 / 可视化工具 / Agent监控
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SDKEnhancementsService } from '../../src/main/services/SDKEnhancementsService'

// Mock SDK模块 - 使用class定义确保可以被new构造
vi.mock('@agentprimordia/sdk', () => {
  class MockStructuredOutputExtractor {
    opts: any
    constructor(opts: any) { this.opts = opts }
    extract = vi.fn().mockResolvedValue({ result: 'test' })
    extractInto = vi.fn().mockResolvedValue({ result: 'test' })
  }

  class MockMultimodalFusion {
    config: any
    constructor(config: any) { this.config = config }
    process = vi.fn().mockResolvedValue({ fused: true })
  }

  class MockBatchRequestProcessor {
    provider: any
    constructor(provider: any) { this.provider = provider }
    process = vi.fn().mockResolvedValue([])
  }

  class MockPromptABTest {
    config: any
    constructor(config: any) { this.config = config }
    run = vi.fn().mockResolvedValue({
      results: [],
      winner: 'default',
      winnerScore: 0.8,
      confidence: 0.9,
      recommendedPrompt: '',
      summary: 'Test summary',
    })
    runBatch = vi.fn().mockResolvedValue([])
  }

  class MockEvalSuite {
    config: any
    constructor(config: any) { this.config = config }
    run = vi.fn().mockResolvedValue({
      total: 0,
      passed: 0,
      failed: 0,
      passRate: 0,
      results: [],
    })
  }

  class MockStreamingPipeline {
    steps: any
    constructor(steps: any) { this.steps = steps }
    run = vi.fn().mockResolvedValue([])
    stream = vi.fn().mockResolvedValue([])
  }

  class MockDynamicOrchestrator {
    route = vi.fn().mockResolvedValue({ routed: true })
  }

  class MockScheduler {
    getStats = vi.fn().mockReturnValue({ tasks: 0, pending: 0 })
  }

  class MockAgentPluginLoader {
    load = vi.fn().mockResolvedValue(true)
    unload = vi.fn().mockResolvedValue(true)
    list = vi.fn().mockReturnValue([])
  }

  class MockComputeWorkerPool {
    run = vi.fn().mockResolvedValue({ done: true })
    terminate = vi.fn()
    stats = { active: 0, idle: 4 }
  }

  class MockMermaidGenerator {
    generate = vi.fn().mockReturnValue('graph TD; A-->B;')
  }

  class MockDOTGenerator {
    generate = vi.fn().mockReturnValue('digraph { A -> B }')
  }

  class MockWorkflowVisualizer {
    visualize = vi.fn().mockReturnValue({ nodes: [], edges: [] })
  }

  class MockAgentMonitor {
    getSnapshot = vi.fn().mockReturnValue({ status: 'idle' })
  }

  return {
    StructuredOutputExtractor: MockStructuredOutputExtractor,
    MultimodalFusion: MockMultimodalFusion,
    BatchRequestProcessor: MockBatchRequestProcessor,
    PromptABTest: MockPromptABTest,
    EvalSuite: MockEvalSuite,
    StreamingPipeline: MockStreamingPipeline,
    DynamicOrchestrator: MockDynamicOrchestrator,
    Scheduler: MockScheduler,
    AgentPluginLoader: MockAgentPluginLoader,
    ComputeWorkerPool: MockComputeWorkerPool,
    isWorkerThreadsAvailable: vi.fn().mockReturnValue(true),
    MermaidGenerator: MockMermaidGenerator,
    DOTGenerator: MockDOTGenerator,
    WorkflowVisualizer: MockWorkflowVisualizer,
    AgentMonitor: MockAgentMonitor,
    schemaFromStruct: vi.fn().mockReturnValue({ type: 'object', properties: {} }),
    SentimentSchema: { name: 'sentiment', schema: {} },
    ClassificationSchema: { name: 'classification', schema: {} },
    SummarySchema: { name: 'summary', schema: {} },
    NERSchema: { name: 'ner', schema: {} },
  }
})

describe('SDKEnhancementsService', () => {
  let service: SDKEnhancementsService

  beforeEach(() => {
    service = new SDKEnhancementsService()
  })

  describe('A/B测试管理', () => {
    const mockABTestConfig = {
      variants: [
        { name: 'concise', systemPrompt: '你是一个简洁助手' },
        { name: 'detailed', systemPrompt: '你是一个详细助手' },
      ],
      evaluator: {
        type: 'keyword' as const,
        keywords: ['准确', '完整'],
      },
    }

    it('应该创建A/B测试', () => {
      const test = service.createABTest('test-prompt', mockABTestConfig as any)
      expect(test).toBeDefined()
    })

    it('应该获取已创建的A/B测试', () => {
      service.createABTest('test-prompt', mockABTestConfig as any)
      const retrieved = service.getABTest('test-prompt')
      expect(retrieved).toBeDefined()
    })

    it('应该返回undefined当测试不存在', () => {
      const result = service.getABTest('non-existent')
      expect(result).toBeUndefined()
    })

    it('应该运行A/B测试并保存结果', async () => {
      service.createABTest('test-prompt', mockABTestConfig as any)
      const mockAgentFactory = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({
          content: 'test response',
          metrics: { totalTurns: 1, totalTools: 0, duration: 100, llmLatency: 50, toolLatency: 0 },
        }),
      })

      const result = await service.runABTest('test-prompt', '测试输入', mockAgentFactory as any)
      expect(result).toBeDefined()
    })

    it('应该获取A/B测试历史结果', async () => {
      service.createABTest('test-prompt', mockABTestConfig as any)
      const mockAgentFactory = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({
          content: 'test response',
          metrics: { totalTurns: 1, totalTools: 0, duration: 100, llmLatency: 50, toolLatency: 0 },
        }),
      })

      await service.runABTest('test-prompt', '测试输入1', mockAgentFactory as any)
      await service.runABTest('test-prompt', '测试输入2', mockAgentFactory as any)

      const results = service.getABTestResults('test-prompt')
      expect(results).toHaveLength(2)
    })

    it('运行不存在的测试应该抛出错误', async () => {
      await expect(
        service.runABTest('non-existent', 'input', vi.fn() as any)
      ).rejects.toThrow('A/B 测试 "non-existent" 不存在')
    })
  })

  describe('评估套件管理', () => {
    const mockEvalConfig = {
      evaluator: {
        evaluate: vi.fn().mockResolvedValue({ score: 1, passed: true, criteria: [] }),
      },
      cases: [
        { task: '测试任务1', input: '输入1', expected: '期望1' },
        { task: '测试任务2', input: '输入2', expected: '期望2' },
      ],
    }

    it('应该设置评估套件配置', () => {
      service.setEvalSuiteConfig(mockEvalConfig as any)
      const suite = service.getEvalSuite()
      expect(suite).toBeDefined()
    })

    it('应该动态添加评估案例', () => {
      service.setEvalSuiteConfig(mockEvalConfig as any)
      service.addEvalCase('新任务', '新输入', '新期望')
      const suite = service.getEvalSuite()
      expect(suite).toBeDefined()
    })

    it('应该清除动态评估案例', () => {
      service.setEvalSuiteConfig(mockEvalConfig as any)
      service.addEvalCase('新任务', '新输入', '新期望')
      service.clearEvalCases()
      const suite = service.getEvalSuite()
      expect(suite).toBeDefined()
    })

    it('未设置配置时应该抛出错误', () => {
      expect(() => service.getEvalSuite()).toThrow('评估套件配置未设置')
    })
  })

  describe('流式管道', () => {
    it('应该创建流式管道', () => {
      const steps = [{ name: 'step1', type: 'transform' }]
      const pipeline = service.createStreamingPipeline('test-pipeline', steps as any)
      expect(pipeline).toBeDefined()
    })

    it('应该获取已创建的管道', () => {
      const steps = [{ name: 'step1', type: 'transform' }]
      service.createStreamingPipeline('test-pipeline', steps as any)
      const pipeline = service.getStreamingPipeline('test-pipeline')
      expect(pipeline).toBeDefined()
    })

    it('应该返回undefined当管道不存在', () => {
      const result = service.getStreamingPipeline('non-existent')
      expect(result).toBeUndefined()
    })
  })

  describe('动态编排器', () => {
    it('应该获取动态编排器实例', () => {
      const orchestrator = service.getDynamicOrchestrator()
      expect(orchestrator).toBeDefined()
    })

    it('应该返回相同的编排器实例（单例）', () => {
      const orchestrator1 = service.getDynamicOrchestrator()
      const orchestrator2 = service.getDynamicOrchestrator()
      expect(orchestrator1).toBe(orchestrator2)
    })

    it('应该获取调度器实例', () => {
      const scheduler = service.getScheduler()
      expect(scheduler).toBeDefined()
    })
  })

  describe('插件加载器', () => {
    it('应该获取插件加载器实例', () => {
      const loader = service.getPluginLoader()
      expect(loader).toBeDefined()
    })

    it('应该返回相同的加载器实例（单例）', () => {
      const loader1 = service.getPluginLoader()
      const loader2 = service.getPluginLoader()
      expect(loader1).toBe(loader2)
    })
  })

  describe('Worker线程池', () => {
    it('应该获取Worker线程池实例', () => {
      const pool = service.getWorkerPool()
      expect(pool).toBeDefined()
    })

    it('应该返回相同的线程池实例（单例）', () => {
      const pool1 = service.getWorkerPool()
      const pool2 = service.getWorkerPool()
      expect(pool1).toBe(pool2)
    })
  })

  describe('可视化工具', () => {
    it('应该获取Mermaid生成器实例', () => {
      const gen = service.getMermaidGenerator()
      expect(gen).toBeDefined()
    })

    it('应该获取DOT生成器实例', () => {
      const gen = service.getDOTGenerator()
      expect(gen).toBeDefined()
    })

    it('应该获取工作流可视化器实例', () => {
      const viz = service.getWorkflowVisualizer()
      expect(viz).toBeDefined()
    })
  })

  describe('Agent监控', () => {
    it('应该获取Agent监控器实例', () => {
      const monitor = service.getAgentMonitor()
      expect(monitor).toBeDefined()
    })

    it('应该返回相同的监控器实例（单例）', () => {
      const monitor1 = service.getAgentMonitor()
      const monitor2 = service.getAgentMonitor()
      expect(monitor1).toBe(monitor2)
    })
  })

  describe('生命周期管理', () => {
    it('应该正常停止服务', () => {
      // 初始化Worker线程池
      service.getWorkerPool()
      expect(() => service.stop()).not.toThrow()
    })
  })
})
