// SDK 增强能力服务
// [Phase 2] 集成 SDK 独有能力到 AELA
// 提供: 结构化输出 / 多模态融合 / 批量请求 / Prompt A/B 测试 / 评估套件 /
//        流式管道 / 动态编排 / 插件热加载 / Worker 线程池 / 可视化工具 / Agent 监控

import {
  // 结构化输出
  type StructuredOutputConfig,
  // [SDK 集成] 结构化数据提取 (LLM-powered, prompt 引导)
  StructuredExtractor,
  // [增强] 结构化输出提取 (LLM-powered, JSON Schema 引导 + 错误反馈重试)
  StructuredOutputExtractor,
  schemaFromStruct,
  SentimentSchema,
  ClassificationSchema,
  SummarySchema,
  NERSchema,
  type SchemaDef,
  // 多模态融合
  MultimodalFusion,
  type MultimodalInput,
  type FusionResult,
  type MultimodalFusionConfig,
  // 批量请求
  BatchRequestProcessor,
  // Prompt A/B 测试 + 评估
  PromptABTest,
  type ABTestConfig,
  type ABTestResult,
  EvalSuite,
  type EvalSuiteConfig,
  type EvalCase,
  // 流式管道
  StreamingPipeline,
  type StreamingPipelineStep,
  // 动态编排
  DynamicOrchestrator,
  Scheduler,
  // 插件热加载
  AgentPluginLoader,
  // Worker 线程池
  ComputeWorkerPool,
  isWorkerThreadsAvailable,
  // 可视化
  MermaidGenerator,
  DOTGenerator,
  WorkflowVisualizer,
  // Agent 监控
  AgentMonitor,
  // 类型
  type Provider,
} from '@agentprimordia/sdk'

export class SDKEnhancementsService {
  // ===== 结构化输出 =====
  // StructuredOutputExtractor 需要 Provider + model，使用 extractStructuredData 方法代替
  // 此方法保留为简单 JSON 提取（非 LLM），供无 Provider 场景使用

  /**
   * 从文本中提取 JSON 结构化数据（非 LLM，简单解析）
   * 如需 LLM 驱动的提取，请使用 extractStructuredData 方法
   */
  extractStructuredOutput(text: string, _config?: Partial<StructuredOutputConfig>): unknown {
    // 尝试从文本中提取 JSON
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        return null
      }
    }
    return null
  }

  // ===== 多模态融合 =====
  private fusion: MultimodalFusion | null = null

  /**
   * 多模态输入融合 — 将文本、图片、音频等多模态输入融合为统一表示
   * 注意: SDK MultimodalFusion 需要 MultimodalFusionConfig（含 text Provider）
   * @param input 多模态输入（文本/图片/音频）
   * @param config 融合配置（必须包含 text Provider）
   */
  async fuseMultimodal(input: MultimodalInput, config: MultimodalFusionConfig): Promise<FusionResult> {
    if (!this.fusion) {
      this.fusion = new MultimodalFusion(config)
    }
    return this.fusion.process(input)
  }

  // ===== 批量请求处理 =====
  private batchProcessor: BatchRequestProcessor | null = null

  /**
   * 批量处理 LLM 请求 — 合并多个请求减少 API 调用次数
   * SDK BatchRequestProcessor 需要 Provider 实例
   * @param provider LLM Provider 实例
   */
  getBatchProcessor(provider: Provider): BatchRequestProcessor {
    if (!this.batchProcessor) {
      this.batchProcessor = new BatchRequestProcessor(provider)
    }
    return this.batchProcessor
  }

  // ===== Prompt A/B 测试 =====
  private abTests: Map<string, PromptABTest> = new Map()
  /** A/B 测试运行历史记录 */
  private abTestResults: Map<string, ABTestResult[]> = new Map()

  /**
   * 创建 Prompt A/B 测试
   * SDK PromptABTest 需要 ABTestConfig（含 variants + evaluator）
   */
  createABTest(name: string, config: ABTestConfig): PromptABTest {
    const test = new PromptABTest(config)
    this.abTests.set(name, test)
    return test
  }

  /**
   * 获取 A/B 测试
   */
  getABTest(name: string): PromptABTest | undefined {
    return this.abTests.get(name)
  }

  /**
   * 运行 A/B 测试并记录结果
   * @param name 测试名称
   * @param input 测试输入
   * @param agentFactory Agent 工厂函数
   */
  async runABTest(
    name: string,
    input: string,
    agentFactory: (variant: { name: string; systemPrompt: string }) => { run: (input: string) => Promise<{ content: string; metrics: { totalTurns: number; totalTools: number; duration: number; llmLatency: number; toolLatency: number } }> },
  ): Promise<ABTestResult> {
    const test = this.abTests.get(name)
    if (!test) throw new Error(`A/B 测试 "${name}" 不存在`)
    const result = await test.run(input, agentFactory)
    // 保存结果历史
    const history = this.abTestResults.get(name) ?? []
    history.push(result)
    this.abTestResults.set(name, history)
    return result
  }

  /**
   * 获取 A/B 测试历史结果
   */
  getABTestResults(name: string): ABTestResult[] {
    return this.abTestResults.get(name) ?? []
  }

  // ===== 评估套件 =====
  // SDK EvalSuite 需要 EvalSuiteConfig（含 evaluator + cases）
  private evalSuiteConfig: EvalSuiteConfig | null = null
  /** 动态评估案例列表（支持运行时添加） */
  private evalCases: EvalCase[] = []

  /**
   * 设置评估套件配置
   */
  setEvalSuiteConfig(config: EvalSuiteConfig): void {
    this.evalSuiteConfig = config
  }

  /**
   * 动态添加评估案例
   */
  addEvalCase(task: string, input: string, expected: string): void {
    this.evalCases.push({ task, input, expected })
  }

  /**
   * 获取评估套件 — 用于评估 Agent 输出质量
   * 如果存在动态添加的案例，自动合并到配置中
   */
  getEvalSuite(): EvalSuite {
    if (!this.evalSuiteConfig) {
      throw new Error('评估套件配置未设置，请先调用 setEvalSuiteConfig')
    }
    // 合并动态添加的案例
    const cases = this.evalCases.length > 0
      ? [...this.evalSuiteConfig.cases, ...this.evalCases]
      : this.evalSuiteConfig.cases
    return new EvalSuite({ ...this.evalSuiteConfig, cases })
  }

  /**
   * 清除动态评估案例
   */
  clearEvalCases(): void {
    this.evalCases = []
  }

  // ===== 流式管道 =====
  private streamingPipelines: Map<string, StreamingPipeline> = new Map()

  /**
   * 创建流式处理管道 — 多步骤流式处理
   */
  createStreamingPipeline(name: string, steps: StreamingPipelineStep[]): StreamingPipeline {
    const pipeline = new StreamingPipeline(steps)
    this.streamingPipelines.set(name, pipeline)
    return pipeline
  }

  /**
   * 获取流式管道
   */
  getStreamingPipeline(name: string): StreamingPipeline | undefined {
    return this.streamingPipelines.get(name)
  }

  // ===== 动态编排 =====
  private dynamicOrchestrator: DynamicOrchestrator | null = null
  private scheduler: Scheduler | null = null

  /**
   * 获取动态编排器 — 运行时动态编排多 Agent 协作
   */
  getDynamicOrchestrator(): DynamicOrchestrator {
    if (!this.dynamicOrchestrator) {
      this.dynamicOrchestrator = new DynamicOrchestrator()
    }
    return this.dynamicOrchestrator
  }

  /**
   * 获取调度器 — 任务调度和资源管理
   */
  getScheduler(): Scheduler {
    if (!this.scheduler) {
      this.scheduler = new Scheduler()
    }
    return this.scheduler
  }

  // ===== 插件热加载 =====
  private pluginLoader: AgentPluginLoader | null = null

  /**
   * 获取插件加载器 — 热加载 Agent 插件
   */
  getPluginLoader(): AgentPluginLoader {
    if (!this.pluginLoader) {
      this.pluginLoader = new AgentPluginLoader()
    }
    return this.pluginLoader
  }

  // ===== Worker 线程池 =====
  private workerPool: ComputeWorkerPool | null = null

  /**
   * 获取 Worker 线程池 — CPU 密集型任务并行计算
   */
  getWorkerPool(): ComputeWorkerPool | null {
    if (!isWorkerThreadsAvailable()) {
      console.warn('[SDKEnhancementsService] Worker threads 不可用，跳过初始化')
      return null
    }
    if (!this.workerPool) {
      this.workerPool = new ComputeWorkerPool()
    }
    return this.workerPool
  }

  // ===== 可视化工具 =====
  private mermaidGen: MermaidGenerator | null = null
  private dotGen: DOTGenerator | null = null
  private workflowViz: WorkflowVisualizer | null = null

  /**
   * 获取 Mermaid 生成器 — 生成 Mermaid 流程图
   */
  getMermaidGenerator(): MermaidGenerator {
    if (!this.mermaidGen) {
      this.mermaidGen = new MermaidGenerator()
    }
    return this.mermaidGen
  }

  /**
   * 获取 DOT 生成器 — 生成 Graphviz DOT 图
   */
  getDOTGenerator(): DOTGenerator {
    if (!this.dotGen) {
      this.dotGen = new DOTGenerator()
    }
    return this.dotGen
  }

  /**
   * 获取工作流可视化器 — 可视化编辑工作流
   */
  getWorkflowVisualizer(): WorkflowVisualizer {
    if (!this.workflowViz) {
      this.workflowViz = new WorkflowVisualizer()
    }
    return this.workflowViz
  }

  // ===== Agent 监控 =====
  private agentMonitor: AgentMonitor | null = null

  /**
   * 获取 Agent 监控器 — 实时监控 Agent 运行状态
   */
  getAgentMonitor(): AgentMonitor {
    if (!this.agentMonitor) {
      this.agentMonitor = new AgentMonitor()
    }
    return this.agentMonitor
  }

  // ===== 生命周期 =====

  /** 生命周期停止方法 */
  stop(): void {
    this.workerPool?.terminate()
    // AgentMonitor 没有 stop 方法，无需清理
  }

  // ===== [SDK 集成] 结构化数据提取 =====
  // SDK StructuredExtractor 使用 LLM 从文本中提取结构化数据
  // 支持自定义 JSON Schema + 预定义 Schema（情感分析/分类/摘要/NER）

  /** 结构化提取器缓存（按 Provider 实例隔离） */
  private structuredExtractors: Map<string, StructuredExtractor> = new Map()

  /**
   * 使用 SDK StructuredExtractor 从文本中提取结构化数据
   * @param provider LLM Provider 实例
   * @param input 待提取的文本
   * @param schema JSON Schema 定义（可用 schemaFromStruct 构建或使用预定义 Schema）
   * @param model 模型名称（可选）
   */
  async extractStructuredData<T = unknown>(
    provider: Provider,
    input: string,
    schema: SchemaDef,
    model?: string,
  ): Promise<T> {
    const key = model ?? 'default'
    if (!this.structuredExtractors.has(key)) {
      this.structuredExtractors.set(key, new StructuredExtractor({
        provider,
        model,
        temperature: 0,
        maxRetries: 3,
      }))
    }
    return this.structuredExtractors.get(key)!.extract<T>(input, schema)
  }

  /**
   * 构建自定义 JSON Schema
   * @param name Schema 名称
   * @param properties 属性定义
   */
  buildSchema(
    name: string,
    properties: Record<string, { type: string; description?: string; enum?: string[] }>,
  ): SchemaDef {
    return schemaFromStruct(name, properties)
  }

  /** 获取预定义 Schema — 情感分析 */
  getSentimentSchema(): SchemaDef { return SentimentSchema }
  /** 获取预定义 Schema — 文本分类 */
  getClassificationSchema(): SchemaDef { return ClassificationSchema }
  /** 获取预定义 Schema — 摘要提取 */
  getSummarySchema(): SchemaDef { return SummarySchema }
  /** 获取预定义 Schema — 命名实体识别 (NER) */
  getNERSchema(): SchemaDef { return NERSchema }

  // ===== [增强] StructuredOutputExtractor — JSON Schema 引导 + 错误反馈重试 =====
  // 比 StructuredExtractor 更先进：
  // 1. 使用 responseFormat: { type: 'json_schema', jsonSchema: schema } 原生引导 LLM 输出
  // 2. 当 LLM 输出不符合 Schema 时，自动将错误反馈给 LLM 重试
  // 3. 支持 extractInto<T>() 强类型返回

  /** StructuredOutputExtractor 缓存（按 provider+model 隔离） */
  private schemaGuidedExtractors: Map<string, StructuredOutputExtractor> = new Map()

  /**
   * 使用 SDK StructuredOutputExtractor 进行 Schema 引导的结构化提取
   *
   * 比 extractStructuredData 更准确：
   * - 原生 responseFormat 引导 LLM 输出 JSON（OpenAI/Claude/Gemini 等均支持）
   * - 错误反馈重试：JSON 解析失败时自动将错误信息发回 LLM 修正
   *
   * @param provider LLM Provider 实例
   * @param input 待提取的文本
   * @param schema JSON Schema 定义
   * @param model 模型名称
   * @param maxRetries 最大重试次数（默认 2）
   */
  async extractWithSchema<T = unknown>(
    provider: Provider,
    input: string,
    schema: SchemaDef,
    model: string,
    maxRetries?: number,
  ): Promise<T> {
    const key = `${model}:${maxRetries ?? 2}`
    if (!this.schemaGuidedExtractors.has(key)) {
      this.schemaGuidedExtractors.set(key, new StructuredOutputExtractor(
        provider,
        model,
        { maxRetries: maxRetries ?? 2, validate: true },
      ))
    }
    return this.schemaGuidedExtractors.get(key)!.extract<T>(input, schema)
  }

  /**
   * 使用 SDK StructuredOutputExtractor 进行 Schema 引导的结构化提取（强类型版本）
   * 与 extractWithSchema 功能相同，但使用 extractInto<T>() 方法提供更强的类型安全
   */
  async extractInto<T = unknown>(
    provider: Provider,
    input: string,
    schema: SchemaDef,
    model: string,
    maxRetries?: number,
  ): Promise<T> {
    const key = `${model}:${maxRetries ?? 2}:into`
    if (!this.schemaGuidedExtractors.has(key)) {
      this.schemaGuidedExtractors.set(key, new StructuredOutputExtractor(
        provider,
        model,
        { maxRetries: maxRetries ?? 2, validate: true },
      ))
    }
    return this.schemaGuidedExtractors.get(key)!.extractInto<T>(input, schema)
  }
}
