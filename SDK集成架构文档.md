# AELA 与 AgentPrimordia SDK 集成架构文档

## 1. 概述

本文档描述 AELA 桌面应用与 AgentPrimordia TypeScript SDK (`@agentprimordia/sdk`) 的集成架构、接口设计和最佳实践。

### 1.1 技术栈

| 组件 | 技术 |
|------|------|
| AELA 应用 | Electron 33 + React 18 + TypeScript |
| AP SDK | TypeScript (120+ 模块) |
| 通信 | Electron IPC (ipcMain/ipcRenderer) |
| 构建 | tsup (SDK) + electron-vite (AELA) |
| 状态管理 | Zustand 4（7 个 slice） |
| 持久化 | electron-store 10 + better-sqlite3 |

### 1.2 依赖关系

```json
{
  "devDependencies": {
    "@agentprimordia/sdk": "file:../codecast/AgentPrimordia/sdk/typescript"
  }
}
```

**发布时切换为**:
```json
{
  "dependencies": {
    "@agentprimordia/sdk": "^1.0.0"
  }
}
```

---

## 2. 集成层次架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     AELA 渲染进程 (Renderer)                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React Components (30+ 视图, SDKToolsView, etc.)          │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  window.aela.* (Preload API, ~55 分组)              │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                       IPC 通信层                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  IPC Handlers (26 个 handler 文件, ~200 通道)             │  │
│  │  agent / orchestration / memory / security / sdkEnhance  │  │
│  │  sdkPhase4 / resilience / terminal / preview / ...       │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                     AELA 主进程 (Main)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              ServiceContainer (DI 容器)                    │  │
│  │  统一生命周期: start() / stop() + 依赖注入                  │  │
│  │  40+ 服务通过 SERVICE_TOKENS 常量注册                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────────────────┐         │
│  │ AgentService    │  │ SDKEnhancementsService      │         │
│  │ (ReActAgent,   │  │ (12项SDK增强能力)           │         │
│  │  SelfTuner,    │  │ - 结构化输出提取            │         │
│  │  Speculative,  │  │ - 多模态融合                │         │
│  │  CachedProvider)│ │ - 批量请求处理              │         │
│  │ + AgentHook    │  │ - Prompt A/B测试            │         │
│  │   Factory      │  │ - 评估套件                  │         │
│  │   (10 Hooks)   │  │ - 流式管道                  │         │
│  │ + Guardrail    │  │ - 动态编排+调度器           │         │
│  │ + Security     │  │ - 插件热加载                │         │
│  │ + ModelRouter  │  │ - Worker线程池             │         │
│  │   注入         │  │ - 可视化工具               │         │
│  └─────────────────┘  │ - Agent监控               │         │
│  ┌─────────────────┐  │ - 缓存统计                │         │
│  │ ReasoningService│  └─────────────────────────────┘         │
│  │ (ReasoningEngine)│ ┌─────────────────────────────┐         │
│  └─────────────────┘ │ RAGService                  │         │
│  ┌─────────────────┐ │ (RAGStore + RAGReranker     │         │
│  │ ResilienceService│ │  + MMRReranker)            │         │
│  │ (CircuitBreaker,│ └─────────────────────────────┘         │
│  │  Retry, Wrapper)│ ┌─────────────────────────────┐         │
│  └─────────────────┘ │ MemoryService               │         │
│  ┌─────────────────┐ │ (SQLite + FTS5 + HNSW       │         │
│  │ ModelRouter     │ │  + HashEmbedding + 衰减)    │         │
│  │ (智能路由)      │ └─────────────────────────────┘         │
│  └─────────────────┘ ┌─────────────────────────────┐         │
│                      │ OrchestrationService        │         │
│                      │ (Pipeline/Parallel/Handoff/ │         │
│                      │  Pool/GroupChat/Debate/     │         │
│                      │  Supervisor)                │         │
│                      └─────────────────────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│                      AP SDK 层                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  @agentprimordia/sdk v1.0.0                               │  │
│  │  - ReActAgent, Lifecycle, HookManager (10 HookPoints)    │  │
│  │  - 15+ LLM Providers (OpenAI, Anthropic, Gemini, etc.)  │  │
│  │  - Memory System (RAG, Vector, HNSW, SQLite, FTS5)       │  │
│  │  - Orchestration (Pipeline, DAG, GroupChat, Debate, Sup.) │  │
│  │  - Security (Sandbox, Guardrails, ACL, CommandGuard)     │  │
│  │  - Tools (FileSystem, Shell, Web, API, Plugin)           │  │
│  │  - Observability (Metrics, OTel, Debugger, AgentMonitor) │  │
│  │  - Evolution (SelfTuning, SpeculativeExec, ABTest)       │  │
│  │  - Resilience (CircuitBreaker, Retry, RateLimiter)       │  │
│  │  - Reasoning (ReasoningEngine)                            │  │
│  │  - RAG (RAGStore, RAGReranker, MMRReranker)              │  │
│  │  - Structured (StructuredExtractor, SchemaBuilder)       │  │
│  │  - Multimodal (MultimodalFusion)                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心服务详解

### 3.1 AgentService

**职责**: 核心 Agent 编排层，管理 ReAct 循环和生命周期

**SDK 集成**:
- `ReActAgent` - ReAct 循环引擎
- `AgentSelfTuner` - 自动调优 maxTurns/parallelToolExecution
- `SpeculativeExecutor` - 投机执行，工具执行期间预热 LLM 调用
- `CachedProvider` / `FingerprintCache` - LLM 响应指纹缓存

**Phase 5 注入链**:
通过 `wireComponents()` 方法一次性注入所有高级服务依赖：
```typescript
agentService.wireComponents({
  memoryService,
  costTracker: costTrackerService,
  contextWindow: contextWindowService,
  hitlService,
  auditService,
  toolLearningService,
  promptService,
  hookConfigService,
  guardrailService,    // → before_llm 输入检查 + after_llm 输出检查
  securityService,     // → before_tool 命令注入防护 + 路径穿越 + ACL
  modelRouter,         // → 根据任务类型 + 输入复杂度生成模型建议
})
```

**注入方法**:
- `setMemoryService(ms)` — 注入记忆服务
- `setGuardrailService(gs)` — 注入安全护栏（通过 `AgentHookFactory`）
- `setSecurityService(ss)` — 注入安全沙箱（通过 `AgentHookFactory`）
- `setModelRouter(mr)` — 注入模型路由器
- `wireComponents(deps)` — 统一注入所有依赖

**AgentHookFactory**: 专门负责创建 10 个 HookPoint 的工厂类，接收 GuardrailService / SecurityService 等依赖，在对应 Hook 点执行安全检查。

**runStream() 执行流程（Phase 5 增强）**:
1. 获取模型配置 → 创建 Provider
2. 加载会话已激活的 Skills
3. 读取 `AGENTS.md` / `CLAUDE.md` 上下文文件
4. 获取 MCP 工具列表
5. **使用 `PromptBuilder.build()` 构建三层系统提示词**
6. **使用 `PromptService.renderFewShot()` 动态追加 Few-Shot 示例**
7. **[Phase 5] 通过 `MemoryService.hybridSearchScored()` 检索 Top-5 相关记忆，注入系统提示词**
8. 创建 `HookManager`（注册 10 个 HookPoint）+ `Lifecycle` + `ReActAgent`
9. **[Phase 5] GuardrailService 在 `before_llm` hook 做输入检查（reject 阻断 / sanitize 替换）**
10. **[Phase 5] GuardrailService 在 `after_llm` hook 做输出检查**
11. **[Phase 5] SecurityService 在 `before_tool` hook 做命令注入防护 + 路径穿越检测 + ACL 权限检查**
12. **[Phase 5] ContextWindow 测量 `promptTokens + conversationTokens`，发布 `context.tokens` 事件，使用率 > 80% 时动态压缩 `maxMessages`**
13. **[Phase 5] ModelRouter 根据任务类型和输入复杂度生成模型建议，发布 `model.suggestion` 事件**
14. 保存用户消息到 MemoryService
15. 调用 `agent.streamEvents(input)` 获取流式事件

### 3.2 SDKEnhancementsService

**职责**: 封装 SDK 独有的 12 项增强能力

**能力清单**:

| # | 能力 | SDK 组件 | IPC 通道 |
|---|------|---------|---------|
| 1 | 结构化输出提取 | StructuredOutputExtractor | SDK_EXTRACT_STRUCTURED |
| 2 | 多模态融合 | MultimodalFusion | SDK_FUSE_MULTIMODAL |
| 3 | 批量请求处理 | BatchRequestProcessor | SDK_BATCH_PROCESS |
| 4 | Prompt A/B测试 | PromptABTest | SDK_ABTEST_CREATE/RUN/RESULTS |
| 5 | 评估套件 | EvalSuite | SDK_EVAL_ADD_CASE/RUN |
| 6 | 流式管道 | StreamingPipeline | SDK_STREAMING_PIPE_CREATE/RUN |
| 7 | 动态编排+调度器 | DynamicOrchestrator + Scheduler | SDK_DYNAMIC_ORCH_SCHEDULE |
| 8 | 插件热加载 | AgentPluginLoader | SDK_PLUGIN_LOAD/LIST/UNLOAD |
| 9 | Worker线程池 | ComputeWorkerPool | SDK_WORKER_POOL_STATS/EXEC |
| 10 | 可视化工具 | MermaidGenerator + DOTGenerator | SDK_VIZ_MERMAID/DOT |
| 11 | Agent监控 | AgentMonitor | SDK_AGENT_MONITOR_STATS |
| 12 | 缓存统计 | FingerprintCache + LLMCache | SDK_CACHE_STATS/CLEAR |

**Phase 5 UI 接入**: 新增 `SDKToolsView` 设置页 Tab，提供四个子面板：
- 结构化提取面板
- 记忆衰减面板
- 性能优化面板（缓存统计 + 投机执行）
- 模型路由面板

### 3.3 ReasoningService

**职责**: 独立单轮推理，适用于轻量级推理任务

**SDK 集成**:
- `ReasoningEngine` - 内置重试+指数退避的推理引擎
- `singleRoundReasoning` / `singleRoundReasoningStream` - 便捷函数

**IPC 通道**: `reasoning:reason` / `reasoning:reason-stream` / `reasoning:quick-reason`

### 3.4 RAGService

**职责**: RAG 管道管理

**SDK 集成**:
- `RAGStore` - 向量+全文混合存储
- `RAGReranker` / `MMRReranker` - 重排序
- `Summarizer` - 文档摘要
- PDF / DOCX / CSV / HTML / Markdown 文档加载器

### 3.5 ResilienceService

**职责**: 弹性执行（重试+熔断+Fallback）

**SDK 集成**:
- `CircuitBreaker` - 熔断器（closed / open / half_open 三态）
- `Retry` - 指数退避重试
- `ResilientWrapper` - 统一包装器
- `RateLimiter` - 令牌桶限流
- `BatchProcessor` - 并发批处理

### 3.6 MemoryService

**职责**: 情景记忆系统，支持混合搜索和压缩摘要

**SDK 集成**:
- `SqliteMemoryStore` - SQLite 底层存储
- FTS5 全文检索 + HNSW 向量索引
- `HashEmbedding` - 双哈希向量化（无需外部 Embedding API）
- `Compressor` - LLM 驱动的记忆压缩
- 重要性衰减机制

**Phase 5 闭环**: `runStream()` 执行前通过 `hybridSearchScored()` 检索 Top-5 相关记忆注入系统提示词，实现记忆读写闭环。

### 3.7 OrchestrationService

**职责**: 多 Agent 编排服务

**支持模式**:
- `pipeline` / `parallel` / `handoff` / `pool` — 基础 4 模式
- `GroupChat` — 群聊编排
- `Debate` — 辩论编排
- `Supervisor` — 主管监督

**扩展子目录** (`services/orchestration/`):
- `GroupChatOrchestrator` — 群聊编排器
- `StreamingPipelineOrchestrator` — 流式管道编排器
- `SupervisorOrchestrator` — 主管编排器
- `OrchestrationReplay` — 编排回放
- `OrchestrationTemplates` — 编排模板库

---

## 4. IPC 通道设计

### 4.1 通道命名规范

```
sdk:<capability>          - SDK 增强能力
sdk:abtest-*              - A/B 测试相关
sdk:eval-*                - 评估套件相关
sdk:viz-*                 - 可视化工具
sdk:phase4-*              - Phase 4 高价值模块
agent:speculative-*       - 投机执行
agent:cache-*             - 缓存统计
memory:fts-*              - 记忆 FTS5 搜索
memory:decay              - 记忆重要性衰减
security:check-*          - 安全检查（命令注入 / 路径穿越）
resilience:*              - 弹性组件
reasoning:*               - 推理引擎
```

### 4.2 通道完整列表

参见 `src/shared/ipcChannels.ts` 中的 `IPC_CHANNELS` 定义（~200 个通道）。

通道按功能域分组：
- **基础域**: agent / model / workspace / session / config / shell / skill / automation (~30)
- **编排域**: orchestration / dag / collaboration / supervisor / dynamic-dag / orch-ext (~15)
- **安全域**: security / guardrail / audit / security-preset (~20)
- **AI 域**: memory / memory-fts / rag / planning / reflection / prompt / reasoning (~30)
- **SDK 域**: sdk:* / agent:speculative / agent:cache (~30)
- **工具域**: terminal / preview / multifile / testgen / wiki / hook-config / tool-learning (~25)
- **成本域**: cost / context-window / metrics / observability (~15)
- **高级域**: model-route / code-review / subagent / img2code / adaptive / screenshot / resilience (~25)

### 4.3 错误处理

所有 IPC handler 使用 `wrap()` 统一错误处理：

```typescript
ipcMain.handle(IPC_CHANNELS.SDK_EXTRACT_STRUCTURED, async (_, text: string) => {
  return wrap(() => sdkEnhancementsService.extractStructuredOutput(text))
})
```

### 4.4 IPC 处理器组织

26 个 handler 文件按功能域拆分，位于 `src/main/ipc/handlers/`:
- `agent.ts` / `session.ts` / `modelConfig.ts` / `workspace.ts`
- `orchestration.ts` / `mcp.ts` / `skill.ts` / `automation.ts`
- `memory.ts` / `security.ts` / `sdkEnhancements.ts` / `sdkPhase4.ts`
- `terminal.ts` / `preview.ts` / `multifile.ts` / `testgen.ts` / `wiki.ts`
- `hookConfig.ts` / `toolLearning.ts` / `codeReview.ts` / `subagent.ts`
- `img2code.ts` / `screenshot.ts` / `resilience.ts` / `telemetry.ts`
- `debugger.ts` / `misc.ts`

---

## 5. DI 容器架构

### 5.1 ServiceContainer

所有 40+ 服务通过 `ServiceContainer`（DI 容器）统一管理：

```typescript
// 注册服务
container.register(SERVICE_TOKENS.AGENT_SERVICE, agentService)

// 获取服务
const agentService = container.get<AgentService>(SERVICE_TOKENS.AGENT_SERVICE)

// 统一生命周期
await container.startAll()  // 启动所有服务
await container.stopAll()   // 逆序停止所有服务
```

### 5.2 SERVICE_TOKENS

服务标识常量集中定义在 `ServiceContainer.ts` 中，避免魔法字符串。当前定义了 40+ 个服务 Token。

### 5.3 IPC 与 DI 容器

`registerIPC(container)` 接收容器实例，各 handler 通过 `container.get<T>(token)` 获取服务，消除了 37+ 参数传递。

---

## 6. 类型系统

### 6.1 共享类型组织

共享类型拆分为 3 个文件（`src/shared/`）：
- `types.ts` — Re-exports + AELA 特有类型（~100+ 类型）
- `ipcChannels.ts` — IPC 通道常量（~200 通道）+ `IPCResponse<T>`
- `sdkTypes.ts` — SDK 相关类型定义

### 6.2 类型对齐

AELA 共享类型与 SDK 类型对齐度 ~95%：

| AELA 类型 | SDK 类型 | 对齐度 |
|-----------|---------|--------|
| `Message` | `Message` | 100% |
| `MemoryEpisode` | `MemoryEpisode` | 100% |
| `ToolCallInfo` | `ToolCall` | 95% |
| `AgentMetrics` | `AgentMetrics` | 100% |

### 6.3 SDK 错误码

SDK 定义了 22 种错误码，与 Go 端对齐：

```typescript
export const ErrorCodes = {
  AGENT_STOPPED: 'AGENT_001',
  TOOL_NOT_FOUND: 'TOOL_001',
  LLM_CALL_FAILED: 'LLM_001',
  // ... 22 个错误码
}
```

通过 `window.aela.sdkEnhancements.getInfo()` 可获取完整错误码列表。

---

## 7. 数据流向

```
┌──────────────────────────────────────────────────────────────┐
│                      数据流向图                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User Input ──→ Renderer ──[IPC]──→ Main Services           │
│                                        │                     │
│                                        ▼                      │
│                              AgentService.runStream()         │
│                              ┌─────────────────────┐        │
│                              │ 1. Memory 检索注入   │        │
│                              │ 2. PromptBuilder     │        │
│                              │ 3. Few-Shot 注入     │        │
│                              │ 4. HookManager 创建  │        │
│                              │    - before_llm:     │        │
│                              │      Guardrail 输入   │        │
│                              │    - after_llm:      │        │
│                              │      Guardrail 输出   │        │
│                              │      CostTracker     │        │
│                              │      ContextWindow   │        │
│                              │      ModelRouter     │        │
│                              │    - before_tool:    │        │
│                              │      Security 检查    │        │
│                              │      Audit + HITL    │        │
│                              │ 5. ReActAgent.run()  │        │
│                              └─────────────────────┘        │
│                                        │                     │
│                                        ▼                     │
│  UI Update ←── Renderer ←──[IPC]── SDK Response            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. 最佳实践

### 8.1 服务层开发

1. **DI 容器注册**: 所有服务在 `ServiceContainer` 中注册，使用 `SERVICE_TOKENS` 常量
2. **统一生命周期**: 实现 `IService` 接口（可选 `start()` / `stop()`）
3. **懒加载**: SDK 组件在 Service 层使用单例缓存
4. **依赖注入**: 通过 `wireComponents()` 或 setter 方法注入依赖

```typescript
export class SDKEnhancementsService implements IService {
  private fusion: MultimodalFusion | null = null
  
  getFusion(config: MultimodalFusionConfig): MultimodalFusion {
    if (!this.fusion) {
      this.fusion = new MultimodalFusion(config)
    }
    return this.fusion
  }
  
  stop(): void {
    this.workerPool?.terminate()
  }
}
```

### 8.2 IPC Handler 开发

1. **统一错误处理**: 使用 `wrap()` 包装
2. **通过 DI 容器获取服务**: `container.get<T>(SERVICE_TOKENS.XXX)`
3. **类型安全**: 避免 `any`，使用 SDK 类型
4. **通道常量**: 在 `ipcChannels.ts` 中定义

### 8.3 渲染进程开发

1. **使用 Preload API**: 通过 `window.aela.*` 调用（~55 API 分组）
2. **Zustand slice**: 新增状态使用独立 slice（7 个切片：viewStore / configStore / messagesStore / skillStore / streaming / automationStore / dialog）
3. **错误处理**: 捕获 IPC 错误并显示
4. **加载状态**: 异步操作显示 loading 状态

---

## 9. 测试

### 9.1 单元测试

SDK 服务层测试使用 Vitest + Mock：

```typescript
// test/services/sdkEnhancementsService.test.ts
vi.mock('@agentprimordia/sdk', () => ({
  PromptABTest: vi.fn().mockImplementation((config) => ({
    run: vi.fn().mockResolvedValue({ winner: 'default' }),
  })),
  // ... 其他 Mock
}))
```

### 9.2 测试覆盖

- A/B 测试管理 ✅
- 评估套件 ✅
- 流式管道 ✅
- 动态编排器 ✅
- 插件加载器 ✅
- Worker 线程池 ✅
- 可视化工具 ✅
- Agent 监控 ✅
- 生命周期管理 ✅

---

## 10. 版本管理

### 10.1 SDK 版本

当前 SDK 版本: `1.0.0`

版本检测日志：
```
[SDK] AgentPrimordia SDK version: 1.0.0
```

### 10.2 兼容性

| AELA 版本 | SDK 版本 | 状态 |
|-----------|---------|------|
| 0.2.0 | 1.0.0 | ✅ 兼容（Phase 1-5 全部完成） |
| 0.1.0 | 1.0.0 | ✅ 兼容（Phase 1-4） |

---

## 11. 故障排查

### 11.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| SDK 组件初始化失败 | 依赖缺失 | 检查 `node_modules/@agentprimordia/sdk` |
| IPC 调用超时 | LLM 响应慢 | 增加超时配置 |
| 类型不匹配 | SDK 版本不兼容 | 更新 SDK 版本 |
| Guardrail 阻断输出 | 输出触发安全规则 | 检查护栏规则配置 |
| 记忆检索无结果 | 记忆库为空或 FTS5 索引未建 | 执行 `memory:fts-rebuild` |
| 熔断器 open 状态 | LLM 连续失败 | 检查 Provider 配置 + 重置熔断器 |

### 11.2 调试技巧

1. 查看主进程日志: `userData/aela-main.log`
2. 查看渲染进程日志: Chrome DevTools Console
3. IPC 通道检查: 使用 `ipcMain.handle` 断点
4. Hook 链路追踪: 查看 `before_llm` / `after_llm` / `before_tool` hook 日志

---

*文档更新时间: 2026-07-02*
*SDK 版本: @agentprimordia/sdk@1.0.0*
*AELA 版本: 0.2.0*
