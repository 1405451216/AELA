// 全局类型声明 - window.aela API
// 定义渲染进程中可用的 IPC API 接口

import type {
  ModelConfig,
  Workspace,
  Session,
  ChatMessage,
  MCPServerConfig,
  MCPServerStatus,
  MCPResourceInfo,
  AppConfig,
  FileTreeNode,
  StreamEvent,
  ShellConfirmRequest,
  ShellConfirmResponse,
  Skill,
  SkillScanResult,
  AutomationTask,
  AutomationRunRecord,
  OrchestrationConfig,
  OrchestrationEvent,
  MetricsSnapshot,
  MemoryEpisode,
  MemoryStats,
  MemoryCompressConfig,
  MemoryCompressResult,
  SandboxConfig,
  AccessLevel,
  GuardrailReport,
  GuardrailRuleConfig,
  GuardrailCheckPoint,
  DAGConfig,
  CollaborationConfig,
  DynamicDAGConfig,
  AssignmentStrategy,
  RAGSearchResult,
  TelemetryConfig,
  TelemetrySpanInfo,
  TelemetryExportResult,
  SupervisorWorker,
  SupervisorStats,
  SupervisorTaskResult,
  TraceSpan,
  SessionTrace,
  BuiltinToolInfo,
  ToolCacheStats,
  CostSummary,
  CostRecord,
  BudgetConfig,
  ModelPricing,
  ContextWindowConfig,
  AuditEvent,
  AuditQueryFilter,
  AuditConfig,
  ComplianceReport,
  PromptRegistryEntry,
  PromptVariantInfo,
  FewShotExample,
  Plan,
  ReflectionResult,
  CritiqueResult,
  ToolUsageRecord,
  BestPractice,
  ToolLearningSuggestion,
  HITLConfig,
  HITLInterruptPoint,
  HITLInterruptRequest,
  HITLResponse,
  MultimodalMessage,
  MemoryFTSResult,
  MemoryFTSStats,
  OrchestrationTemplate,
  OrchestrationRunRecord,
  OrchestrationPerformanceReport,
  MetricsTrend,
  CostAnalysisReport,
  AnomalyAlert,
  FewShotExampleWithWeight,
  FewShotWeightConfig,
  ToolLearningVisualization,
  SecurityPreset,
  SecurityPresetLevel,
  SessionSearchResult,
  SessionExportOptions,
  SessionExportResult,
  SessionContextInfo,
  TerminalTabInfo,
  TerminalCommandHistoryEntry,
  AdaptiveLearningProfile,
  AdaptiveHint,
  LearningProgress,
  ScreenshotAnalysis,
  ScreenshotAnalysisRequest,
  ResilienceConfig,
  ResilienceStats,
  FileChangeRecord,
  FileDiffLine,
  HookRule,
  HookEventPoint,
  HookExecutionResult,
  HookConfigSummary,
  MultiFileEdit,
  MultiFileEditResult,
  TestGenAnalysis,
  TestGenResult,
  WikiDocument,
  CustomAgentConfig,
  RouteSuggestion,
  ModelRouteConfig,
  CodeReviewResult,
  SubAgentRunConfig,
  SubAgentRunResult,
  SubAgentRunStatus,
  SubAgentPreset,
  ImageToCodeRequest,
  ImageToCodeResult,
  CodeFramework,
  ImageAnalysis,
  SyncConfig,
  SyncState,
  SyncConflict,
} from '@shared/types'

export interface AELAApi {
  model: {
    list: () => Promise<ModelConfig[]>
    add: (model: Omit<ModelConfig, 'id' | 'createdAt'>) => Promise<ModelConfig>
    update: (id: string, partial: Partial<ModelConfig>) => Promise<ModelConfig | undefined>
    delete: (id: string) => Promise<boolean>
    setDefault: (id: string) => Promise<boolean>
    test: (config: ModelConfig) => Promise<{ success: boolean; message: string }>
  }
  workspace: {
    list: () => Promise<Workspace[]>
    add: () => Promise<Workspace | null>
    remove: (id: string) => Promise<boolean>
    open: (path: string) => Promise<boolean>
    readFile: (filePath: string) => Promise<string>
    fileTree: (rootPath: string) => Promise<FileTreeNode>
    search: (rootPath: string, query: string, options?: { extension?: string }) => Promise<Array<{ path: string; line: number; content: string }>>
  }
  session: {
    list: (workspaceId?: string) => Promise<Session[]>
    create: (params: { title?: string; workspaceId?: string; modelConfigId?: string; systemPrompt?: string }) => Promise<Session>
    delete: (id: string) => Promise<boolean>
    getMessages: (sessionId: string) => Promise<ChatMessage[]>
    update: (id: string, partial: Partial<Session>) => Promise<Session | null>
    setActiveSkills: (sessionId: string, skillIds: string[]) => Promise<Session | null>
  }
  agent: {
    runStream: (params: {
      sessionId: string
      input: string
      modelConfigId: string
      systemPrompt?: string
      mode?: 'code' | 'office'
      permissionLevel?: 'ask' | 'auto_edit' | 'plan' | 'skip'
    }) => Promise<void>
    stop: (sessionId: string) => Promise<boolean>
    pause: (sessionId: string) => Promise<boolean>
    resume: (sessionId: string) => Promise<boolean>
    status: (sessionId: string) => Promise<string>
    onStreamEvent: (sessionId: string, callback: (event: StreamEvent) => void) => (() => void)
  }
  mcp: {
    list: () => Promise<MCPServerConfig[]>
    add: (server: Omit<MCPServerConfig, 'id' | 'createdAt'>) => Promise<MCPServerConfig>
    update: (id: string, partial: Partial<MCPServerConfig>) => Promise<MCPServerConfig | undefined>
    delete: (id: string) => Promise<boolean>
    connect: (id: string) => Promise<MCPServerStatus>
    disconnect: (id: string) => Promise<boolean>
    status: () => Promise<MCPServerStatus[]>
  }
  shell: {
    confirmCommand: (request: ShellConfirmRequest) => Promise<ShellConfirmResponse>
  }
  skill: {
    list: () => Promise<SkillScanResult>
    reload: () => Promise<SkillScanResult>
    get: (id: string) => Promise<Skill | undefined>
  }
  automation: {
    list: () => Promise<AutomationTask[]>
    get: (id: string) => Promise<AutomationTask | undefined>
    create: (params: { name: string; description?: string; prompt: string; trigger?: AutomationTask['trigger'] }) => Promise<AutomationTask>
    update: (id: string, partial: Partial<AutomationTask>) => Promise<AutomationTask | undefined>
    delete: (id: string) => Promise<boolean>
    run: (id: string) => Promise<{ success: boolean; data?: AutomationRunRecord; error?: string }>
    runs: (id: string, limit?: number) => Promise<AutomationRunRecord[]>
    toggle: (id: string) => Promise<AutomationTask | undefined>
  }
  config: {
    get: () => Promise<AppConfig>
    set: (partial: Partial<AppConfig>) => Promise<AppConfig>
    isApiKeyStorageSecure: () => Promise<boolean>
  }
  orchestration: {
    run: (config: OrchestrationConfig) => Promise<void>
    stop: (runId: string) => Promise<boolean>
    onEvent: (runId: string, callback: (event: OrchestrationEvent) => void) => (() => void)
  }
  metrics: {
    snapshot: () => Promise<MetricsSnapshot>
    reset: () => Promise<boolean>
  }
  memory: {
    search: (query: string, opts?: { sessionId?: string; limit?: number }) => Promise<MemoryEpisode[]>
    list: (opts?: { sessionId?: string; limit?: number; offset?: number }) => Promise<MemoryEpisode[]>
    add: (episode: MemoryEpisode) => Promise<void>
    delete: (id: string) => Promise<void>
    stats: () => Promise<MemoryStats>
  }
  security: {
    getConfig: () => Promise<SandboxConfig>
    setConfig: (config: SandboxConfig) => Promise<boolean>
    checkAccess: (agentId: string, resource: string, level: AccessLevel) => Promise<{ allowed: boolean; error?: string }>
  }
  guardrail: {
    check: (input: string, point: GuardrailCheckPoint) => Promise<GuardrailReport>
    getRules: () => Promise<GuardrailRuleConfig[]>
    setRules: (rules: GuardrailRuleConfig[]) => Promise<boolean>
  }
  dag: {
    run: (config: DAGConfig) => Promise<void>
    stop: (runId: string) => Promise<boolean>
    onEvent: (runId: string, callback: (event: OrchestrationEvent) => void) => (() => void)
  }
  collaboration: {
    run: (config: CollaborationConfig) => Promise<void>
    stop: (runId: string) => Promise<boolean>
    onEvent: (runId: string, callback: (event: any) => void) => (() => void)
  }
  debugger: {
    status: () => Promise<{ enabled: boolean; logEntries: number; subscriberCount: number; inspectorRunning: boolean; inspectorPort: number; totalSpans: number; totalSessions: number }>
    traces: (limit?: number) => Promise<TraceSpan[]>
    sessionTrace: (sessionId: string) => Promise<SessionTrace | null>
    clear: () => Promise<boolean>
    startInspector: (port?: number) => Promise<{ port: number; running: boolean }>
    stopInspector: () => Promise<boolean>
  }
  mcpResource: {
    list: (serverId: string) => Promise<MCPResourceInfo[]>
    read: (serverId: string, uri: string) => Promise<string>
  }
  supervisor: {
    addWorker: (worker: { id?: string; name: string; skills?: string[]; maxConcurrency?: number; modelConfigId: string; systemPrompt?: string }) => Promise<SupervisorWorker>
    removeWorker: (id: string) => Promise<boolean>
    submitTask: (task: { name: string; type: string; payload: Record<string, unknown>; requiredSkills?: string[]; priority?: number; timeout?: number }) => Promise<SupervisorTaskResult>
    stats: () => Promise<SupervisorStats>
    listWorkers: () => Promise<SupervisorWorker[]>
    setStrategy: (strategy: AssignmentStrategy) => Promise<AssignmentStrategy>
  }
  dynamicDag: {
    run: (config: DynamicDAGConfig) => Promise<void>
    stop: (runId: string) => Promise<boolean>
    onEvent: (runId: string, callback: (event: OrchestrationEvent) => void) => (() => void)
  }
  rag: {
    ingest: (source: string, content: string, metadata?: Record<string, string>) => Promise<{ documentId: string; chunkCount: number }>
    search: (query: string, topK?: number) => Promise<RAGSearchResult[]>
    clear: () => Promise<boolean>
    stats: () => Promise<{ documents: number; chunks: number; vectorDim: number }>
  }
  memoryCompress: {
    compress: (config?: Partial<MemoryCompressConfig>) => Promise<MemoryCompressResult>
  }
  telemetry: {
    configure: (config: TelemetryConfig) => Promise<boolean>
    export: () => Promise<TelemetryExportResult>
    spans: () => Promise<TelemetrySpanInfo[]>
    status: () => Promise<{ configured: boolean; enableTraces: boolean; enableMetrics: boolean; otlpEndpoint: string; activeSpans: number; totalSpans: number; totalExported: number }>
    getConfig: () => Promise<TelemetryConfig>
  }
  toolCache: {
    stats: () => Promise<ToolCacheStats>
    clear: () => Promise<boolean>
  }
  builtinTools: {
    list: () => Promise<BuiltinToolInfo[]>
    toggle: (name: string, enabled: boolean) => Promise<boolean>
  }
  cost: {
    summary: () => Promise<CostSummary>
    records: (limit?: number) => Promise<CostRecord[]>
    reset: () => Promise<boolean>
    setBudget: (budget: BudgetConfig | null) => Promise<boolean>
    getBudget: () => Promise<BudgetConfig | null>
    setPricing: (model: string, pricing: ModelPricing) => Promise<boolean>
    listPricing: () => Promise<ModelPricing[]>
  }
  contextWindow: {
    getConfig: () => Promise<ContextWindowConfig>
    setConfig: (config: Partial<ContextWindowConfig>) => Promise<boolean>
    trim: (messages: Array<{ role: string; content: string }>) => Promise<Array<{ role: string; content: string }>>
    compress: (messages: Array<{ role: string; content: string }>, modelConfigId: string) => Promise<Array<{ role: string; content: string }>>
  }
  audit: {
    log: (event: Omit<AuditEvent, 'timestamp'> & { timestamp?: string }) => Promise<boolean>
    query: (filter: AuditQueryFilter) => Promise<AuditEvent[]>
    report: (start: string, end: string) => Promise<ComplianceReport>
    getConfig: () => Promise<AuditConfig>
    setConfig: (config: Partial<AuditConfig>) => Promise<boolean>
    clear: () => Promise<boolean>
    count: () => Promise<number>
  }
  prompt: {
    render: (name: string, vars: Record<string, unknown>) => Promise<string>
    list: () => Promise<PromptRegistryEntry[]>
    register: (name: string, template: string) => Promise<boolean>
    delete: (name: string) => Promise<boolean>
    renderMessage: (role: 'system' | 'user' | 'assistant', vars: Record<string, unknown>) => Promise<string>
    setMessageTemplate: (role: 'system' | 'user' | 'assistant', template: string) => Promise<boolean>
    fewshotRender: (name: string, input: string, vars?: Record<string, unknown>) => Promise<string>
    fewshotAddExample: (name: string, input: string, output: string) => Promise<boolean>
fewshotGetExamples: (name: string) => Promise<FewShotExample[]>
variantsList: () => Promise<PromptVariantInfo[]>
}
  planning: {
    decompose: (task: string, modelConfigId?: string) => Promise<Plan['subtasks']>
    generatePlan: (task: string, modelConfigId?: string) => Promise<Plan>
  }
  reflection: {
    reflect: (input: string, output: string, modelConfigId?: string) => Promise<ReflectionResult>
    critique: (output: string, modelConfigId?: string) => Promise<CritiqueResult>
    improve: (output: string, feedback: CritiqueResult, modelConfigId?: string) => Promise<string>
    reflectAndImprove: (input: string, output: string, modelConfigId?: string) => Promise<{ reflection: ReflectionResult; critique: CritiqueResult; improvedOutput: string }>
  }
  toolLearning: {
    recordSuccess: (toolName: string, args: string, result: string, sessionId?: string) => Promise<boolean>
    recordFailure: (toolName: string, args: string, errorMsg: string, sessionId?: string) => Promise<boolean>
    bestPractices: (toolName: string) => Promise<BestPractice[]>
    suggest: (toolName: string, args: string) => Promise<ToolLearningSuggestion>
    stats: (toolName?: string) => Promise<Array<{ toolName: string; totalCalls: number; successCount: number; failureCount: number; successRate: number; avgResultLength: number }>>
    records: (toolName?: string, limit?: number) => Promise<ToolUsageRecord[]>
  }
  hitl: {
    getConfig: () => Promise<HITLConfig>
    setConfig: (config: Partial<HITLConfig>) => Promise<boolean>
    getPending: () => Promise<HITLInterruptRequest | null>
    resume: (response: HITLResponse) => Promise<boolean>
    addInterruptPoint: (point: HITLInterruptPoint) => Promise<boolean>
    removeInterruptPoint: (type: HITLInterruptPoint['type'], toolName?: string) => Promise<boolean>
    addAutoApprove: (toolName: string) => Promise<boolean>
    removeAutoApprove: (toolName: string) => Promise<boolean>
    /** 监听主进程推送的 HITL pending-added 事件，返回取消监听函数 */
    onPendingAdded: (callback: (req: HITLInterruptRequest) => void) => () => void
  }
  multimodal: {
    fromFile: (filePath: string, text?: string) => Promise<MultimodalMessage>
    createImageURL: (text: string, imageURL: string, detail?: 'low' | 'high' | 'auto') => Promise<MultimodalMessage>
    createImageB64: (text: string, imageBase64: string, mimeType: string, detail?: 'low' | 'high' | 'auto') => Promise<MultimodalMessage>
    createAudio: (text: string, audioBase64: string, mimeType: string) => Promise<MultimodalMessage>
    createVideo: (text: string, videoBase64: string, mimeType: string) => Promise<MultimodalMessage>
    toLLMContent: (msg: MultimodalMessage) => Promise<Array<Record<string, unknown>>>
    supportedMime: () => Promise<{ images: string[]; audio: string[]; video: string[] }>
  }
  memoryFTS: {
    search: (query: string, opts?: { sessionId?: string; limit?: number }) => Promise<MemoryFTSResult[]>
    stats: () => Promise<MemoryFTSStats>
    rebuild: () => Promise<boolean>
  }
  orchestrationExt: {
    templatesList: () => Promise<OrchestrationTemplate[]>
    templatesGet: (id: string) => Promise<OrchestrationTemplate | undefined>
    runsList: (limit?: number) => Promise<OrchestrationRunRecord[]>
    runsGet: (id: string) => Promise<OrchestrationRunRecord | undefined>
    performance: () => Promise<OrchestrationPerformanceReport>
  }
  observability: {
    trend: (hours?: number) => Promise<MetricsTrend>
    costAnalysis: () => Promise<CostAnalysisReport>
    anomalyList: (includeAcknowledged?: boolean) => Promise<AnomalyAlert[]>
    anomalyAcknowledge: (id: string) => Promise<boolean>
    anomalyCheck: () => Promise<AnomalyAlert[]>
  }
  fewShotWeight: {
    add: (name: string, input: string, output: string, metadata?: Record<string, unknown>) => Promise<boolean>
    feedback: (name: string, input: string, positive: boolean) => Promise<boolean>
    list: (name: string) => Promise<FewShotExampleWithWeight[]>
    setConfig: (name: string, config: Partial<FewShotWeightConfig>) => Promise<boolean>
  }
  toolLearningExt: {
    visualization: () => Promise<ToolLearningVisualization>
    failureModes: () => Promise<ToolLearningVisualization['failureModes']>
    clear: () => Promise<boolean>
  }
  securityPreset: {
    list: () => Promise<SecurityPreset[]>
    apply: (level: SecurityPresetLevel) => Promise<SecurityPreset>
  }
  sessionExt: {
    search: (query: string, opts?: { workspaceId?: string; limit?: number }) => Promise<SessionSearchResult[]>
    export: (sessionId: string, options: SessionExportOptions) => Promise<SessionExportResult>
    contextInfo: (sessionId: string) => Promise<SessionContextInfo>
  }
  terminalExt: {
    listTabs: () => Promise<TerminalTabInfo[]>
    commandHistory: (terminalId?: string, limit?: number) => Promise<TerminalCommandHistoryEntry[]>
    runCommand: (command: string, opts?: { cwd?: string; timeout?: number }) => Promise<{ stdout: string; stderr: string; exitCode: number | null }>
  }
  adaptive: {
    getProfile: (agentId?: string) => Promise<AdaptiveLearningProfile>
    getHints: (agentId?: string) => Promise<AdaptiveHint[]>
    getProgress: (agentId?: string) => Promise<LearningProgress>
    recordInteraction: (params: {
      agentId?: string
      agentName?: string
      input: string
      output: string
      success: boolean
      toolCalls?: number
      duration?: number
      sessionId?: string
    }) => Promise<boolean>
    extractRules: (agentId?: string) => Promise<boolean>
    clearProfile: (agentId?: string) => Promise<boolean>
  }
  screenshot: {
    analyze: (request: ScreenshotAnalysisRequest) => Promise<ScreenshotAnalysis>
    getResult: (id: string) => Promise<ScreenshotAnalysis | null>
    listResults: () => Promise<ScreenshotAnalysis[]>
  }
  resilience: {
    getConfig: () => Promise<ResilienceConfig>
    setConfig: (partial: Partial<ResilienceConfig>) => Promise<ResilienceConfig>
    getStats: () => Promise<ResilienceStats>
    resetBreaker: (modelId: string) => Promise<boolean>
  }
  fileChange: {
    list: (sessionId?: string) => Promise<FileChangeRecord[]>
    get: (id: string) => Promise<{ change: FileChangeRecord; diff: FileDiffLine[] } | null>
    clear: (sessionId?: string) => Promise<boolean>
    accept: (id: string) => Promise<FileChangeRecord | undefined>
    reject: (id: string) => Promise<FileChangeRecord | undefined>
  }
  terminal: {
    create: (opts?: { cwd?: string; shell?: string }) => Promise<string>
    destroy: (id: string) => Promise<boolean>
    input: (id: string, data: string) => Promise<boolean>
    resize: (id: string, cols: number, rows: number) => Promise<boolean>
    list: () => Promise<string[]>
    onData: (id: string, callback: (data: string) => void) => (() => void)
    onExit: (id: string, callback: (exitCode: number) => void) => (() => void)
  }
  hookConfig: {
    list: () => Promise<HookRule[]>
    add: (rule: Omit<HookRule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<HookRule>
    update: (id: string, partial: Partial<HookRule>) => Promise<HookRule | undefined>
    delete: (id: string) => Promise<boolean>
    toggle: (id: string) => Promise<HookRule | undefined>
    test: (rule: HookRule, ctx: { eventPoint: HookEventPoint; agentId: string; sessionId: string; turn: number }) => Promise<HookExecutionResult>
    summary: () => Promise<HookConfigSummary>
  }
  preview: {
    open: (url: string) => Promise<boolean>
    close: () => Promise<boolean>
    navigate: (url: string) => Promise<boolean>
    reload: () => Promise<boolean>
    goBack: () => Promise<boolean>
    goForward: () => Promise<boolean>
    getUrl: () => Promise<string>
    devtools: () => Promise<boolean>
    updateBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>
    onUrlChanged: (callback: (url: string) => void) => (() => void)
    onTitleChanged: (callback: (title: string) => void) => (() => void)
  }
  multiFile: {
    read: (filePath: string) => Promise<string>
    writeBatch: (edits: MultiFileEdit[]) => Promise<MultiFileEditResult[]>
    listChanges: (sessionId?: string) => Promise<FileChangeRecord[]>
  }
  testGen: {
    analyze: (filePath: string) => Promise<TestGenAnalysis>
    generate: (filePath: string, modelConfigId: string) => Promise<TestGenResult>
    run: (testFilePath: string) => Promise<{ success: boolean; output: string; passed: number; failed: number }>
  }
  wiki: {
    generate: (workspaceId: string, modelConfigId: string) => Promise<WikiDocument>
    get: (id: string) => Promise<WikiDocument | null>
    list: (workspaceId?: string) => Promise<WikiDocument[]>
    delete: (id: string) => Promise<boolean>
  }
  agentConfig: {
    list: () => Promise<CustomAgentConfig[]>
    get: (id: string) => Promise<CustomAgentConfig | null>
    add: (config: Omit<CustomAgentConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CustomAgentConfig>
    update: (id: string, partial: Partial<CustomAgentConfig>) => Promise<CustomAgentConfig | null>
    delete: (id: string) => Promise<boolean>
  }
  modelRoute: {
    suggest: (taskType: string, input: string) => Promise<RouteSuggestion>
    getConfig: () => Promise<ModelRouteConfig>
    setConfig: (config: Partial<ModelRouteConfig>) => Promise<ModelRouteConfig>
  }
  codeReview: {
    review: (files: string[], modelConfigId: string) => Promise<CodeReviewResult>
    get: (id: string) => Promise<CodeReviewResult | null>
    list: () => Promise<CodeReviewResult[]>
  }
  subAgent: {
    run: (config: SubAgentRunConfig) => Promise<SubAgentRunResult>
    stop: (runId: string) => Promise<boolean>
    status: (runId: string) => Promise<SubAgentRunStatus | null>
    listPresets: () => Promise<SubAgentPreset[]>
  }
  img2code: {
    analyze: (imagePath: string, modelConfigId: string) => Promise<ImageAnalysis>
    generate: (request: ImageToCodeRequest) => Promise<ImageToCodeResult>
    refine: (resultId: string, feedback: string, modelConfigId: string) => Promise<ImageToCodeResult>
    getResult: (id: string) => Promise<ImageToCodeResult | null>
    listFrameworks: () => Promise<Array<{ id: CodeFramework; label: string; extension: string }>>
  }
  // SDK Enhancements API
  sdkEnhancements: {
    extractStructured: (text: string, config?: Record<string, unknown>) => Promise<unknown>
    fuseMultimodal: (inputs: unknown[], config?: Record<string, unknown>) => Promise<unknown>
    batchProcess: (modelConfigId: string, requests: unknown[], maxConcurrent?: number) => Promise<unknown>
    abTest: {
      create: (name: string, config: { variants: { name: string; systemPrompt: string }[]; evaluator: { type: string; keywords?: string[] } }) => Promise<{ name: string; variantCount: number }>
      run: (name: string, input: string, modelConfigId: string) => Promise<unknown>
      results: (name: string) => Promise<unknown>
    }
    eval: {
      addCase: (task: string, input: string, expected: string) => Promise<boolean>
      clearCases: () => Promise<boolean>
      run: () => Promise<unknown>
    }
    streamingPipeline: {
      create: (name: string, steps: unknown[]) => Promise<{ name: string; stepCount: number }>
      run: (name: string, input: string) => Promise<unknown[]>
    }
    dynamicOrch: {
      schedule: (task: unknown) => Promise<unknown>
      schedulerStats: () => Promise<unknown>
    }
    plugin: {
      load: (pluginPath: string) => Promise<{ path: string; loaded: boolean }>
      list: () => Promise<unknown[]>
      unload: (pluginName: string) => Promise<boolean>
    }
    workerPool: {
      stats: () => Promise<unknown>
      execute: (task: unknown) => Promise<unknown>
    }
    viz: {
      mermaid: (type: string, data: unknown) => Promise<string>
      dot: (type: string, data: unknown) => Promise<string>
    }
    agentMonitor: {
      stats: () => Promise<unknown>
      events: (limit?: number) => Promise<unknown[]>
    }
    cache: {
      stats: () => Promise<unknown>
      clear: () => Promise<boolean>
    }
    getInfo: () => Promise<{ version: string; errorCodes: Record<string, string> }>
  }
  // SDK Phase 4 API
  sdkPhase4: {
    dagBuilder: {
      run: (config: unknown) => Promise<{ result: unknown; duration: number }>
    }
    resilience: {
      execute: (key: string, operation: string, data?: unknown, timeoutMs?: number) => Promise<unknown>
      breakerState: (key?: string) => Promise<{ state: string; key: string }>
      resetBreaker: (key?: string) => Promise<boolean>
    }
    provider: {
      rateLimitSet: (rpm: number) => Promise<{ rpm: number; active: boolean }>
      rateLimitGet: () => Promise<{ rpm: number; active: boolean }>
      batchProcess: (modelConfigId: string, requests: unknown[], maxConcurrent?: number) => Promise<unknown>
    }
    extract: {
      data: (modelConfigId: string, input: string, schema: unknown, model?: string) => Promise<unknown>
      buildSchema: (name: string, properties: Record<string, unknown>) => Promise<unknown>
      getSchemas: () => Promise<unknown>
      withSchema: (modelConfigId: string, input: string, schema: unknown, model?: string, maxRetries?: number) => Promise<unknown>
    }
    reasoning: {
      reason: (modelConfigId: string, messages: unknown[], opts?: { temperature?: number; maxTokens?: number }) => Promise<unknown>
      reasonStream: (modelConfigId: string, messages: unknown[], opts?: { temperature?: number; maxTokens?: number }) => Promise<unknown>
      quickReason: (modelConfigId: string, messages: unknown[], opts?: { temperature?: number; maxTokens?: number }) => Promise<unknown>
    }
    memory: {
      compress: (modelConfigId: string, config?: { windowSize?: number; minEpisodes?: number; model?: string }) => Promise<unknown>
      simpleSummary: (content: string) => Promise<string>
      decay: (decayFactor?: number) => Promise<unknown>
    }
    security: {
      checkShellMeta: (cmd: string) => Promise<unknown>
      checkPathTraversal: (path: string) => Promise<unknown>
      resolvePathSafe: (rootDir: string, filePath: string) => Promise<unknown>
      sanitizeInput: (input: string) => Promise<unknown>
      checkCommandGuard: (command: string) => Promise<unknown>
    }
    getSchemas: () => Promise<unknown>
    extractWithSchema: (modelConfigId: string, input: string, schema: unknown, model?: string, maxRetries?: number) => Promise<unknown>
    buildSchema: (name: string, properties: Record<string, unknown>) => Promise<unknown>
  }
  // Performance optimization API
  perf: {
    speculative: {
      stats: () => Promise<unknown[]>
      reset: () => Promise<boolean>
      toggle: (enabled: boolean) => Promise<unknown>
    }
    cache: {
      stats: () => Promise<unknown>
      clear: () => Promise<boolean>
      toggle: (enabled: boolean) => Promise<boolean>
    }
  }
  // Checkpoint API
  checkpoint: {
    create: (sessionId: string, filePaths: string[], description?: string) => Promise<string>
    restore: (checkpointId: string) => Promise<{ success: boolean; restoredCount: number }>
    list: (sessionId: string) => Promise<Array<{ id: string; sessionId: string; createdAt: string; description: string; fileCount: number }>>
    get: (checkpointId: string) => Promise<{ id: string; sessionId: string; createdAt: string; description: string; files: Array<{ relativePath: string; beforeContent: string | null; afterContent: string | null }> } | null>
    delete: (checkpointId: string) => Promise<boolean>
    clear: (sessionId: string) => Promise<void>
    stats: () => Promise<{ totalCheckpoints: number; totalSessions: number; totalFiles: number }>
  }
  // Inline Completion API
  inlineCompletion: {
    complete: (req: { filePath: string; language: string; contentBefore: string; contentAfter: string; cursorLine: number; cursorColumn: number }) => Promise<{ text: string; confidence: number; cacheHit: boolean } | null>
    toggle: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>
    status: () => Promise<{ enabled: boolean }>
    clearCache: () => Promise<{ success: boolean }>
  }
  // LSP / Diagnostics API
  lsp: {
    diagnostics: (filePath: string) => Promise<Array<{ filePath: string; line: number; column: number; severity: string; message: string; code?: string; source: string }>>
    allDiagnostics: () => Promise<Array<Array<string | { filePath: string; line: number; column: number; severity: string; message: string; code?: string; source: string }[]>>>
    quickCheck: (rootDir: string) => Promise<Array<{ filePath: string; line: number; column: number; severity: string; message: string; code?: string; source: string }>>
    toggle: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>
    status: () => Promise<{ enabled: boolean }>
  }
  // Plugin API
  plugin: {
    list: () => Promise<Array<{ id: string; manifest: { name: string; version: string; description: string; author?: string }; enabled: boolean; installedAt: string }>>
    reload: () => Promise<Array<{ id: string; manifest: { name: string; version: string; description: string; author?: string }; enabled: boolean; installedAt: string }>>
    toggle: (id: string, enabled: boolean) => Promise<{ success: boolean }>
    setConfig: (id: string, config: Record<string, unknown>) => Promise<{ success: boolean }>
    getConfig: (id: string) => Promise<Record<string, unknown> | null>
    stats: () => Promise<{ total: number; enabled: number; disabled: number }>
  }
  // Embedding API
  embedding: {
    info: () => Promise<{ provider: string; model: string; dimensions: number; cached: number }>
    clearCache: () => Promise<{ success: boolean }>
  }
  sync: {
    connect: (config: SyncConfig) => Promise<void>
    disconnect: () => Promise<void>
    getStatus: () => Promise<SyncState>
    syncFile: (filePath: string) => Promise<void>
    resolve: (filePath: string, resolution: 'local' | 'remote' | 'merge') => Promise<void>
    getConflicts: () => Promise<SyncConflict[]>
    onStatus: (listener: (state: SyncState) => void) => () => void
    onConflict: (listener: (conflict: SyncConflict) => void) => () => void
    offStatus: (listener: (state: SyncState) => void) => void
    offConflict: (listener: (conflict: SyncConflict) => void) => void
  }
}

declare global {
  interface Window {
    aela: AELAApi
  }
}

export {}
