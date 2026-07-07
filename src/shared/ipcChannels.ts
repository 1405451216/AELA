// ===== IPC 通道定义 =====
// 主进程与渲染进程之间的 IPC 通道常量 + IPCResponse 通用响应类型

// ===== IPC 通道常量 =====
export const IPC_CHANNELS = {
  // Agent 相关
  AGENT_RUN: 'agent:run',
  AGENT_STREAM: 'agent:stream',
  AGENT_STOP: 'agent:stop',
  AGENT_TEST_MODEL: 'agent:test-model',

  // 模型配置
  MODEL_LIST: 'model:list',
  MODEL_ADD: 'model:add',
  MODEL_UPDATE: 'model:update',
  MODEL_DELETE: 'model:delete',
  MODEL_SET_DEFAULT: 'model:set-default',

  // 工作区
  WORKSPACE_LIST: 'workspace:list',
  WORKSPACE_ADD: 'workspace:add',
  WORKSPACE_REMOVE: 'workspace:remove',
  WORKSPACE_OPEN_FOLDER: 'workspace:open-folder',
  WORKSPACE_READ_FILE: 'workspace:read-file',
  WORKSPACE_FILE_TREE: 'workspace:file-tree',
  WORKSPACE_SEARCH: 'workspace:search',

  // 会话
  SESSION_LIST: 'session:list',
  SESSION_CREATE: 'session:create',
  SESSION_DELETE: 'session:delete',
  SESSION_GET_MESSAGES: 'session:get-messages',
  SESSION_UPDATE: 'session:update',
  SESSION_SET_ACTIVE_SKILLS: 'session:set-active-skills',

  // MCP
  MCP_LIST: 'mcp:list',
  MCP_ADD: 'mcp:add',
  MCP_UPDATE: 'mcp:update',
  MCP_DELETE: 'mcp:delete',
  MCP_CONNECT: 'mcp:connect',
  MCP_DISCONNECT: 'mcp:disconnect',
  MCP_STATUS: 'mcp:status',

  // 配置
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  CONFIG_IS_API_KEY_SECURE: 'config:is-api-key-secure',

  // Shell 命令确认
  SHELL_CONFIRM_COMMAND: 'shell:confirm-command',

  // 系统命令执行
  SHELL_EXECUTE: 'shell:execute',

  // Skills
  SKILL_LIST: 'skill:list',
  SKILL_RELOAD: 'skill:reload',
  SKILL_GET: 'skill:get',
  SKILL_DELETE: 'skill:delete',
  SKILL_IMPORT: 'skill:import',
  SKILL_GET_SCAN_PATHS: 'skill:scan-paths',

  // 自动化
  AUTOMATION_LIST: 'automation:list',
  AUTOMATION_GET: 'automation:get',
  AUTOMATION_CREATE: 'automation:create',
  AUTOMATION_UPDATE: 'automation:update',
  AUTOMATION_DELETE: 'automation:delete',
  AUTOMATION_RUN: 'automation:run',
  AUTOMATION_RUNS: 'automation:runs',
  AUTOMATION_TOGGLE: 'automation:toggle',

  // 多 Agent 编排
  ORCHESTRATION_RUN: 'orchestration:run',
  ORCHESTRATION_STOP: 'orchestration:stop',

  // Agent 控制（暂停/恢复）
  AGENT_PAUSE: 'agent:pause',
  AGENT_RESUME: 'agent:resume',
  AGENT_STATUS: 'agent:status',

  // 运行时指标
  METRICS_SNAPSHOT: 'metrics:snapshot',
  METRICS_RESET: 'metrics:reset',

  // 记忆系统
  MEMORY_SEARCH: 'memory:search',
  MEMORY_LIST: 'memory:list',
  MEMORY_ADD: 'memory:add',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_STATS: 'memory:stats',

  // 安全沙箱
  SECURITY_GET_CONFIG: 'security:get-config',
  SECURITY_SET_CONFIG: 'security:set-config',
  SECURITY_CHECK_ACCESS: 'security:check-access',

  // 安全护栏
  GUARDRAIL_CHECK: 'guardrail:check',
  GUARDRAIL_GET_RULES: 'guardrail:get-rules',
  GUARDRAIL_SET_RULES: 'guardrail:set-rules',

  // DAG 编排
  DAG_RUN: 'dag:run',
  DAG_STOP: 'dag:stop',

  // 协作模式
  COLLABORATION_RUN: 'collaboration:run',
  COLLABORATION_STOP: 'collaboration:stop',

  // 调试器
  DEBUGGER_STATUS: 'debugger:status',
  DEBUGGER_TRACES: 'debugger:traces',
  DEBUGGER_SESSION_TRACE: 'debugger:session-trace',
  DEBUGGER_CLEAR: 'debugger:clear',
  DEBUGGER_INSPECTOR_START: 'debugger:inspector:start',
  DEBUGGER_INSPECTOR_STOP: 'debugger:inspector:stop',

  // MCP 资源
  MCP_LIST_RESOURCES: 'mcp:list-resources',
  MCP_READ_RESOURCE: 'mcp:read-resource',

  // Supervisor 监督者
  SUPERVISOR_ADD_WORKER: 'supervisor:add-worker',
  SUPERVISOR_REMOVE_WORKER: 'supervisor:remove-worker',
  SUPERVISOR_SUBMIT_TASK: 'supervisor:submit-task',
  SUPERVISOR_STATS: 'supervisor:stats',
  SUPERVISOR_LIST_WORKERS: 'supervisor:list-workers',
  SUPERVISOR_SET_STRATEGY: 'supervisor:set-strategy',

  // DynamicDAG 动态拓扑
  DYNAMIC_DAG_RUN: 'dynamic-dag:run',
  DYNAMIC_DAG_STOP: 'dynamic-dag:stop',

  // RAG 管道
  RAG_INGEST: 'rag:ingest',
  RAG_SEARCH: 'rag:search',
  RAG_CLEAR: 'rag:clear',
  RAG_STATS: 'rag:stats',

  // Memory 压缩
  MEMORY_COMPRESS: 'memory:compress',

  // OpenTelemetry 遥测
  TELEMETRY_CONFIGURE: 'telemetry:configure',
  TELEMETRY_EXPORT: 'telemetry:export',
  TELEMETRY_SPANS: 'telemetry:spans',
  TELEMETRY_STATUS: 'telemetry:status',
  TELEMETRY_GET_CONFIG: 'telemetry:get-config',

  // 内置工具
  BUILTIN_TOOLS_LIST: 'builtin-tools:list',
  BUILTIN_TOOLS_TOGGLE: 'builtin-tools:toggle',

  // Cost Tracker 成本追踪
  COST_SUMMARY: 'cost:summary',
  COST_RECORDS: 'cost:records',
  COST_RESET: 'cost:reset',
  COST_SET_BUDGET: 'cost:set-budget',
  COST_GET_BUDGET: 'cost:get-budget',
  COST_SET_PRICING: 'cost:set-pricing',
  COST_LIST_PRICING: 'cost:list-pricing',
  COST_DAILY_TREND: 'cost:daily-trend',
  COST_TODAY_OVER_BUDGET: 'cost:today-over-budget',
  COST_EXPORT_CSV: 'cost:export-csv',

  // ===== 开发者面板 =====
  IPC_MONITOR_GET: 'ipc-monitor:get-entries',
  IPC_MONITOR_CLEAR: 'ipc-monitor:clear',

  // ===== Skill 市场 =====
  SKILL_MARKET_LIST: 'skill-market:list',
  SKILL_MARKET_INSTALL: 'skill-market:install',
  SKILL_MARKET_UNINSTALL: 'skill-market:uninstall',
  SKILL_MARKET_INSTALLED: 'skill-market:installed',

  // Context Window 上下文窗口管理
  CONTEXT_WINDOW_GET_CONFIG: 'context-window:get-config',
  CONTEXT_WINDOW_SET_CONFIG: 'context-window:set-config',
  CONTEXT_WINDOW_TRIM: 'context-window:trim',
  CONTEXT_WINDOW_COMPRESS: 'context-window:compress',

  // Audit Logger 审计日志
  AUDIT_LOG: 'audit:log',
  AUDIT_QUERY: 'audit:query',
  AUDIT_REPORT: 'audit:report',
  AUDIT_GET_CONFIG: 'audit:get-config',
  AUDIT_SET_CONFIG: 'audit:set-config',
  AUDIT_CLEAR: 'audit:clear',
  AUDIT_COUNT: 'audit:count',

  // Prompt Management 提示词管理
  PROMPT_RENDER: 'prompt:render',
  PROMPT_LIST: 'prompt:list',
  PROMPT_REGISTER: 'prompt:register',
  PROMPT_DELETE: 'prompt:delete',
  PROMPT_RENDER_MESSAGE: 'prompt:render-message',
  PROMPT_SET_MESSAGE_TEMPLATE: 'prompt:set-message-template',
  PROMPT_FEWSHOT_RENDER: 'prompt:fewshot-render',
  PROMPT_FEWSHOT_ADD_EXAMPLE: 'prompt:fewshot-add-example',
  PROMPT_FEWSHOT_GET_EXAMPLES: 'prompt:fewshot-get-examples',
  PROMPT_VARIANTS_LIST: 'prompt:variants-list',

  // Planning 任务规划
  PLANNING_DECOMPOSE: 'planning:decompose',
  PLANNING_GENERATE_PLAN: 'planning:generate-plan',

  // Reflection 自我反思
  REFLECTION_REFLECT: 'reflection:reflect',
  REFLECTION_CRITIQUE: 'reflection:critique',
  REFLECTION_IMPROVE: 'reflection:improve',
  REFLECTION_REFLECT_AND_IMPROVE: 'reflection:reflect-and-improve',

  // Tool Learning 工具学习
  TOOL_LEARNING_RECORD_SUCCESS: 'tool-learning:record-success',
  TOOL_LEARNING_RECORD_FAILURE: 'tool-learning:record-failure',
  TOOL_LEARNING_BEST_PRACTICES: 'tool-learning:best-practices',
  TOOL_LEARNING_SUGGEST: 'tool-learning:suggest',
  TOOL_LEARNING_STATS: 'tool-learning:stats',
  TOOL_LEARNING_RECORDS: 'tool-learning:records',

  // HITL 人机协作
  HITL_GET_CONFIG: 'hitl:get-config',
  HITL_SET_CONFIG: 'hitl:set-config',
  HITL_GET_PENDING: 'hitl:get-pending',
  HITL_RESUME: 'hitl:resume',
  HITL_ADD_INTERRUPT_POINT: 'hitl:add-interrupt-point',
  HITL_REMOVE_INTERRUPT_POINT: 'hitl:remove-interrupt-point',
  HITL_ADD_AUTO_APPROVE: 'hitl:add-auto-approve',
  HITL_REMOVE_AUTO_APPROVE: 'hitl:remove-auto-approve',

  // Multimodal 多模态
  MULTIMODAL_FROM_FILE: 'multimodal:from-file',
  MULTIMODAL_CREATE_IMAGE_URL: 'multimodal:create-image-url',
  MULTIMODAL_CREATE_IMAGE_B64: 'multimodal:create-image-b64',
  MULTIMODAL_CREATE_AUDIO: 'multimodal:create-audio',
  MULTIMODAL_CREATE_VIDEO: 'multimodal:create-video',
  MULTIMODAL_TO_LLM_CONTENT: 'multimodal:to-llm-content',
  MULTIMODAL_SUPPORTED_MIME: 'multimodal:supported-mime',

  // ===== 文件变更追踪（Diff 视图） =====
  FILE_CHANGE_LIST: 'file-change:list',
  FILE_CHANGE_GET: 'file-change:get',
  FILE_CHANGE_CLEAR: 'file-change:clear',
  FILE_CHANGE_ACCEPT: 'file-change:accept',
  FILE_CHANGE_REJECT: 'file-change:reject',

  // ===== 内置终端 =====
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_DESTROY: 'terminal:destroy',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_LIST: 'terminal:list',

  // ===== 用户 Hooks 配置 =====
  HOOK_CONFIG_LIST: 'hook-config:list',
  HOOK_CONFIG_ADD: 'hook-config:add',
  HOOK_CONFIG_UPDATE: 'hook-config:update',
  HOOK_CONFIG_DELETE: 'hook-config:delete',
  HOOK_CONFIG_TOGGLE: 'hook-config:toggle',
  HOOK_CONFIG_TEST: 'hook-config:test',
  HOOK_CONFIG_EXPORT: 'hook-config:export',
  HOOK_CONFIG_IMPORT: 'hook-config:import',

  // ===== 浏览器预览 =====
  PREVIEW_OPEN: 'preview:open',
  PREVIEW_CLOSE: 'preview:close',
  PREVIEW_NAVIGATE: 'preview:navigate',
  PREVIEW_RELOAD: 'preview:reload',
  PREVIEW_GO_BACK: 'preview:go-back',
  PREVIEW_GO_FORWARD: 'preview:go-forward',
  PREVIEW_GET_URL: 'preview:get-url',
  PREVIEW_DEVTOOLS: 'preview:devtools',
  PREVIEW_UPDATE_BOUNDS: 'preview:update-bounds',

  // ===== 多文件编辑 =====
  MULTIFILE_READ: 'multifile:read',
  MULTIFILE_WRITE_BATCH: 'multifile:write-batch',
  MULTIFILE_LIST_CHANGES: 'multifile:list-changes',

  // ===== 自动测试生成 =====
  TESTGEN_GENERATE: 'testgen:generate',
  TESTGEN_ANALYZE: 'testgen:analyze',
  TESTGEN_RUN: 'testgen:run',

  // ===== Repo Wiki =====
  WIKI_GENERATE: 'wiki:generate',
  WIKI_GET: 'wiki:get',
  WIKI_LIST: 'wiki:list',
  WIKI_DELETE: 'wiki:delete',

  // ===== 自定义 Agent 配置 =====
  AGENT_CONFIG_LIST: 'agent-config:list',
  AGENT_CONFIG_ADD: 'agent-config:add',
  AGENT_CONFIG_UPDATE: 'agent-config:update',
  AGENT_CONFIG_DELETE: 'agent-config:delete',
  AGENT_CONFIG_GET: 'agent-config:get',

  // ===== 模型智能路由 =====
  MODEL_ROUTE_SUGGEST: 'model-route:suggest',
  MODEL_ROUTE_CONFIG: 'model-route:config',

  // ===== 代码审查 =====
  CODE_REVIEW_REVIEW: 'code-review:review',
  CODE_REVIEW_GET: 'code-review:get',
  CODE_REVIEW_LIST: 'code-review:list',

  // ===== Sub-Agent 并行隔离 =====
  SUBAGENT_RUN: 'subagent:run',
  SUBAGENT_STOP: 'subagent:stop',
  SUBAGENT_STATUS: 'subagent:status',
  SUBAGENT_LIST_PRESETS: 'subagent:list-presets',

  // ===== 图片转代码工作流 =====
  IMG2CODE_ANALYZE: 'img2code:analyze',
  IMG2CODE_GENERATE: 'img2code:generate',
  IMG2CODE_REFINE: 'img2code:refine',
  IMG2CODE_GET_RESULT: 'img2code:get-result',
  IMG2CODE_LIST_FRAMEWORKS: 'img2code:list-frameworks',

  // ===== [升级 1] 记忆系统 FTS5 =====
  MEMORY_FTS_SEARCH: 'memory:fts-search',
  MEMORY_FTS_STATS: 'memory:fts-stats',
  MEMORY_FTS_REBUILD: 'memory:fts-rebuild',

  // ===== [升级 2] 编排模板库 + 回放 + 性能 =====
  ORCHESTRATION_TEMPLATES_LIST: 'orchestration:templates-list',
  ORCHESTRATION_TEMPLATES_GET: 'orchestration:templates-get',
  ORCHESTRATION_RUNS_LIST: 'orchestration:runs-list',
  ORCHESTRATION_RUNS_GET: 'orchestration:runs-get',
  ORCHESTRATION_PERFORMANCE: 'orchestration:performance',

  // ===== [升级 3] 可观测性增强 =====
  METRICS_TREND: 'metrics:trend',
  COST_ANALYSIS: 'cost:analysis',
  ANOMALY_LIST: 'anomaly:list',
  ANOMALY_ACKNOWLEDGE: 'anomaly:acknowledge',
  ANOMALY_CHECK: 'anomaly:check',

  // ===== [升级 4] 提示词 Few-Shot 权重 =====
  PROMPT_FEWSHOT_ADD_WEIGHTED: 'prompt:fewshot-add-weighted',
  PROMPT_FEWSHOT_FEEDBACK: 'prompt:fewshot-feedback',
  PROMPT_FEWSHOT_LIST_WEIGHTED: 'prompt:fewshot-list-weighted',
  PROMPT_FEWSHOT_SET_WEIGHT_CONFIG: 'prompt:fewshot-set-weight-config',

  // ===== [升级 5] 工具学习可视化 =====
  TOOL_LEARNING_VISUALIZATION: 'tool-learning:visualization',
  TOOL_LEARNING_FAILURE_MODES: 'tool-learning:failure-modes',
  TOOL_LEARNING_CLEAR: 'tool-learning:clear',

  // ===== [升级 6] 安全策略模板 =====
  SECURITY_PRESETS_LIST: 'security:presets-list',
  SECURITY_PRESET_APPLY: 'security:preset-apply',

  // ===== [升级 7] 会话管理增强 =====
  SESSION_SEARCH: 'session:search',
  SESSION_EXPORT: 'session:export',
  SESSION_CONTEXT_INFO: 'session:context-info',

  // ===== [升级 8] 终端增强 =====
  TERMINAL_LIST_TABS: 'terminal:list-tabs',
  TERMINAL_COMMAND_HISTORY: 'terminal:command-history',
  TERMINAL_RUN_COMMAND: 'terminal:run-command',

  // ===== [进化 1] Agent 自适应学习 =====
  ADAPTIVE_GET_PROFILE: 'adaptive:get-profile',
  ADAPTIVE_GET_HINTS: 'adaptive:get-hints',
  ADAPTIVE_GET_PROGRESS: 'adaptive:get-progress',
  ADAPTIVE_RECORD_INTERACTION: 'adaptive:record-interaction',
  ADAPTIVE_EXTRACT_RULES: 'adaptive:extract-rules',
  ADAPTIVE_CLEAR_PROFILE: 'adaptive:clear-profile',

  // ===== [进化 2] 多模态深化 — 截图分析报错 =====
  SCREENSHOT_ANALYZE: 'screenshot:analyze',
  SCREENSHOT_GET_RESULT: 'screenshot:get-result',
  SCREENSHOT_LIST_RESULTS: 'screenshot:list-results',

  // ===== [进化 3] ResilientProvider =====
  RESILIENCE_GET_CONFIG: 'resilience:get-config',
  RESILIENCE_SET_CONFIG: 'resilience:set-config',
  RESILIENCE_GET_STATS: 'resilience:get-stats',
  RESILIENCE_RESET_BREAKER: 'resilience:reset-breaker',

  // ===== [SDK 深度集成] RAG 扩展（SDK RAGStore + Reranker） =====
  RAG_SET_CONFIG_EX: 'rag:set-config-ex',
  RAG_GET_CONFIG_EX: 'rag:get-config-ex',
  RAG_STORE_STATS: 'rag:store-stats',
  RAG_FUSION_CONFIG: 'rag:fusion-config',

  // ===== [SDK 深度集成] 编排高级模式（DAG/GroupChat/Debate/Supervisor） =====
  ORCHESTRATION_ADVANCED_RUN: 'orchestration:advanced-run',
  ORCHESTRATION_ADVANCED_STOP: 'orchestration:advanced-stop',

  // ===== [SDK 深度集成] SDKEnhancements 12 项能力 IPC =====
  // 1. 结构化输出提取
  SDK_EXTRACT_STRUCTURED: 'sdk:extract-structured',
  // 2. 多模态融合
  SDK_FUSE_MULTIMODAL: 'sdk:fuse-multimodal',
  // 3. 批量请求处理
  SDK_BATCH_PROCESS: 'sdk:batch-process',
  // 4. Prompt A/B 测试
  SDK_ABTEST_CREATE: 'sdk:abtest-create',
  SDK_ABTEST_RUN: 'sdk:abtest-run',
  SDK_ABTEST_RESULTS: 'sdk:abtest-results',
  // 5. 评估套件
  SDK_EVAL_ADD_CASE: 'sdk:eval-add-case',
  SDK_EVAL_CLEAR_CASES: 'sdk:eval-clear-cases',
  SDK_EVAL_RUN: 'sdk:eval-run',
  // 6. 流式管道
  SDK_STREAMING_PIPE_CREATE: 'sdk:streaming-pipe-create',
  SDK_STREAMING_PIPE_RUN: 'sdk:streaming-pipe-run',
  // 7. 动态编排 + 调度器
  SDK_DYNAMIC_ORCH_SCHEDULE: 'sdk:dynamic-orch-schedule',
  SDK_SCHEDULER_STATS: 'sdk:scheduler-stats',
  // 8. 插件热加载
  SDK_PLUGIN_LOAD: 'sdk:plugin-load',
  SDK_PLUGIN_LIST: 'sdk:plugin-list',
  SDK_PLUGIN_UNLOAD: 'sdk:plugin-unload',
  // 9. Worker 线程池
  SDK_WORKER_POOL_STATS: 'sdk:worker-pool-stats',
  SDK_WORKER_POOL_EXEC: 'sdk:worker-pool-exec',
  // 10. 可视化工具
  SDK_VIZ_MERMAID: 'sdk:viz-mermaid',
  SDK_VIZ_DOT: 'sdk:viz-dot',
  // 11. Agent 监控
  SDK_AGENT_MONITOR_STATS: 'sdk:agent-monitor-stats',
  SDK_AGENT_MONITOR_EVENTS: 'sdk:agent-monitor-events',
  // 12. 缓存统计
  SDK_CACHE_STATS: 'sdk:cache-stats',
  SDK_CACHE_CLEAR: 'sdk:cache-clear',

  // ===== [SDK 深度集成] 性能优化（投机执行 + 请求缓存） =====
  AGENT_SPECULATIVE_STATS: 'agent:speculative-stats',
  AGENT_SPECULATIVE_RESET: 'agent:speculative-reset',
  AGENT_SPECULATIVE_TOGGLE: 'agent:speculative-toggle',
  AGENT_CACHE_STATS: 'agent:cache-stats',
  AGENT_CACHE_CLEAR: 'agent:cache-clear',
  AGENT_CACHE_TOGGLE: 'agent:cache-toggle',

  // ===== [SDK 集成] SDK信息与错误码 =====
  SDK_GET_INFO: 'sdk:get-info',

  // ===== [SDK 集成 Phase 4] 高价值模块 IPC =====
  // DAG Builder
  DAG_BUILDER_RUN: 'dag:builder-run',
  // 弹性组件
  RESILIENCE_SDK_EXECUTE: 'resilience:sdk-execute',
  RESILIENCE_SDK_BREAKER_STATE: 'resilience:sdk-breaker-state',
  RESILIENCE_SDK_RESET_BREAKER: 'resilience:sdk-reset-breaker',
  // 限流批处理
  PROVIDER_RATE_LIMIT_SET: 'provider:rate-limit-set',
  PROVIDER_RATE_LIMIT_GET: 'provider:rate-limit-get',
  PROVIDER_BATCH_PROCESS: 'provider:batch-process',
  // 结构化数据提取
  SDK_EXTRACT_DATA: 'sdk:extract-data',
  SDK_BUILD_SCHEMA: 'sdk:build-schema',
  SDK_GET_SCHEMAS: 'sdk:get-schemas',
  // 推理引擎
  REASONING_REASON: 'reasoning:reason',
  REASONING_REASON_STREAM: 'reasoning:reason-stream',
  REASONING_QUICK_REASON: 'reasoning:quick-reason',
  // 记忆压缩
  MEMORY_COMPRESS_SDK: 'memory:compress-sdk',
  MEMORY_SIMPLE_SUMMARY: 'memory:simple-summary',
  // [增强] 记忆重要性衰减
  MEMORY_DECAY: 'memory:decay',
  // [增强] 结构化输出提取（Schema 引导 + 错误反馈重试）
  SDK_EXTRACT_WITH_SCHEMA: 'sdk:extract-with-schema',
  // 安全扩展
  SECURITY_CHECK_SHELL_META: 'security:check-shell-meta',
  SECURITY_CHECK_PATH_TRAVERSAL: 'security:check-path-traversal',
  SECURITY_RESOLVE_PATH_SAFE: 'security:resolve-path-safe',
  SECURITY_SANITIZE_INPUT: 'security:sanitize-input',
  SECURITY_CHECK_COMMAND_GUARD: 'security:check-command-guard',

  // ===== TaskBoard =====
  TASKBOARD_CREATE: 'taskboard:create',
  TASKBOARD_UPDATE: 'taskboard:update',
  TASKBOARD_LIST: 'taskboard:list',
  TASKBOARD_GET: 'taskboard:get',
  TASKBOARD_DELETE: 'taskboard:delete',
  TASKBOARD_VALIDATE_DAG: 'taskboard:validate-dag',

  // ===== AgentBus =====
  AGENTBUS_SEND: 'agentbus:send',
  AGENTBUS_BROADCAST: 'agentbus:broadcast',
  AGENTBUS_RECEIVE: 'agentbus:receive',
  AGENTBUS_LIST_MESSAGES: 'agentbus:list-messages',
  AGENTBUS_CLEAR: 'agentbus:clear',

  // ===== Supervisor Session =====
  SUPERVISOR_SESSION_START: 'supervisor:session-start',
  SUPERVISOR_SESSION_STATUS: 'supervisor:session-status',
  SUPERVISOR_SESSION_STOP: 'supervisor:session-stop',
  SUPERVISOR_DELEGATE: 'supervisor:delegate',
  SUPERVISOR_COLLECT: 'supervisor:collect',
  SUPERVISOR_RESOLVE_CONFLICT: 'supervisor:resolve-conflict',

  // ===== Remote Workspace Sync =====
  SYNC_CONNECT: 'sync:connect',
  SYNC_DISCONNECT: 'sync:disconnect',
  SYNC_STATUS: 'sync:status',
  SYNC_FILE_CHANGE: 'sync:file:change',
  SYNC_CONFLICT: 'sync:conflict',
  SYNC_RESOLVE: 'sync:resolve',
} as const

// ===== IPC 响应类型 =====
export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
