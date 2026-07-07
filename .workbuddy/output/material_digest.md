# AELA - 资料摘要 v1.0

> 本文档做一件事：**精读主理人转交的全部原始资料，逐份、逐章节做出摘要**——后面任何人拿到这份摘要，都能通过章节号快速定位回原始文件的对应位置。

> 上游输入：主理人转交的全部原始资料（25 份 `.md` / `.mermaid`，位于 `E:/codecast/AELA/` 及 `E:/codecast/AELA/docs/` 下）；
> 产出者：`knowledge-ingest-engineer`（知识摄入工程师 - 闻资料），经 G1 校验与人工审核通过后交付。

---

## 0. 元信息

```yaml
标题: AELA - 资料摘要 v1.0
版本: v1.0
状态: Draft
创建日期: 2026-07-07
整理人: 闻资料 (knowledge-ingest-engineer)
审核人:
  - 主理人 (team-lead)

原始资料清单:
  - E:/codecast/AELA/README.md: 项目总览、特性、SDK 集成架构、安全说明
  - E:/codecast/AELA/CODE_WIKI.md: 代码库说明（66KB，信息量最大）
  - E:/codecast/AELA/SDK集成架构文档.md: SDK 集成架构与设计细节
  - E:/codecast/AELA/USER_GUIDE.md: 用户使用指南
  - E:/codecast/AELA/CONTRIBUTING.md: 贡献指南
  - E:/codecast/AELA/verification_report.md: 源码修复验证报告
  - E:/codecast/AELA/docs/incremental-design-fixall-2026-07-06.md: 增量修复架构设计
  - E:/codecast/AELA/docs/incremental-prd-fixall-2026-07-06.md: 增量修复 PRD
  - E:/codecast/AELA/docs/project-evaluation-2026-07-06.md: 项目深度评估报告
  - E:/codecast/AELA/docs/class-diagram.mermaid: 类图
  - E:/codecast/AELA/docs/sequence-diagram.mermaid: 时序图
  - E:/codecast/AELA/docs/qa-report-fixall-2026-07-06.md: 增量修复回归验证 QA
  - E:/codecast/AELA/docs/qa-report-fullverify-2026-07-06.md: 补偿性全量验证 QA
  - E:/codecast/AELA/docs/qa-report-testfix-2026-07-06.md: 测试技术债修复回归 QA
  - E:/codecast/AELA/docs/architecture/adr-001-sdk-integration.md: ADR-001 SDK 本地依赖
  - E:/codecast/AELA/docs/architecture/adr-002-sandbox-tradeoff.md: ADR-002 Sandbox 妥协
  - E:/codecast/AELA/docs/architecture/adr-003-state-slice.md: ADR-003 Zustand Slice
  - E:/codecast/AELA/docs/architecture/adr-004-ipc-misc-split.md: ADR-004 IPC Misc 拆分
  - E:/codecast/AELA/docs/architecture/adr-005-di-wire-dependencies.md: ADR-005 DI 注入重构
  - E:/codecast/AELA/docs/architecture/mcp-tool-scope.md: MCP 工具调用范围说明
  - E:/codecast/AELA/docs/design/2026-07-05-background-agent.md: 后台常驻 Agent 设计
  - E:/codecast/AELA/docs/design/2026-07-05-context-aware-conversation.md: 上下文感知对话设计
  - E:/codecast/AELA/docs/plans/2026-07-05-background-agent.md: 后台常驻 Agent 实施计划
  - E:/codecast/AELA/docs/plans/2026-07-05-context-aware-conversation.md: 上下文感知对话实施计划
  - E:/codecast/AELA/docs/testing/coverage-plan.md: 测试覆盖率提升计划
```

| 版本 | 日期 | 作者 | 变更内容 |
| --- | --- | --- | --- |
| v1.0 | 2026-07-07 | 闻资料 | 初稿（Phase 1 资料摄入，G1 门） |

---

## 1. 资料清单

> 列出全部原始资料，每份标注解析状态。解析失败或跳过的必须注明原因。

| 编号 | 文件名 | 类型 | 来源 | 解析状态 | 说明 |
| --- | --- | --- | --- | --- | --- |
| D1 | `README.md` | md | 项目根目录 | 已解析 | 项目总览、特性表、SDK 集成五阶段、安全说明、贡献指引 |
| D2 | `CODE_WIKI.md` | md | 项目根目录 | 已解析 | 代码库完整说明（66KB），13 章 + 数据流附录 |
| D3 | `SDK集成架构文档.md` | md | 项目根目录 | 已解析 | SDK 集成层次、核心服务详解、IPC 设计、DI 容器、类型系统 |
| D4 | `USER_GUIDE.md` | md | 项目根目录 | 已解析 | 用户使用指南，10 章 |
| D5 | `CONTRIBUTING.md` | md | 项目根目录 | 已解析 | 贡献指南（前置条件/本地开发/规范/架构约定/PR） |
| D6 | `verification_report.md` | md | 项目根目录 | 已解析 | 源码修复验证（12 项已修复验证 + 6 个 Bug，均已修复） |
| D7 | `docs/incremental-design-fixall-2026-07-06.md` | md | docs/ | 已解析 | 增量修复架构设计（T1–T9 任务分解 + Open Questions） |
| D8 | `docs/incremental-prd-fixall-2026-07-06.md` | md | docs/ | 已解析 | 增量修复 PRD（15 项问题定性 + 本轮范围） |
| D9 | `docs/project-evaluation-2026-07-06.md` | md | docs/ | 已解析 | 项目深度评估报告（架构/质量/依赖/性能安全/可维护性 + 15 问题 + 健康度评分） |
| D10 | `docs/class-diagram.mermaid` | mermaid | docs/ | 已解析 | 类图：校验基础设施/S-1/S-2/Q-1 拆分结构 |
| D11 | `docs/sequence-diagram.mermaid` | mermaid | docs/ | 已解析 | 时序图：sync apiKey 改前（URL query）/改后（header+限流） |
| D12 | `docs/qa-report-fixall-2026-07-06.md` | md | docs/ | 已解析 | 增量修复回归验证 QA（185/185 通过，Round 2 闭环） |
| D13 | `docs/qa-report-fullverify-2026-07-06.md` | md | docs/ | 已解析 | 补偿性全量验证 QA（tsc 绿、vitest 986/1039、e2e 2 失败） |
| D14 | `docs/qa-report-testfix-2026-07-06.md` | md | docs/ | 已解析 | 测试技术债修复回归 QA（①③④ 真绿、② 确认真实产品 bug） |
| D15 | `docs/architecture/adr-001-sdk-integration.md` | md | docs/architecture/ | 已解析 | ADR-001：SDK 本地 `file:` 依赖策略（已接受） |
| D16 | `docs/architecture/adr-002-sandbox-tradeoff.md` | md | docs/architecture/ | 已解析 | ADR-002：Sandbox 妥协（当前 sandbox:false，带拆分计划） |
| D17 | `docs/architecture/adr-003-state-slice.md` | md | docs/architecture/ | 已解析 | ADR-003：Zustand Slice 状态管理（已接受） |
| D18 | `docs/architecture/adr-004-ipc-misc-split.md` | md | docs/architecture/ | 已解析 | ADR-004：IPC Misc 拆分（已执行，964→472 行） |
| D19 | `docs/architecture/adr-005-di-wire-dependencies.md` | md | docs/architecture/ | 已解析 | ADR-005：AgentService 依赖注入重构（已执行） |
| D20 | `docs/architecture/mcp-tool-scope.md` | md | docs/architecture/ | 已解析 | MCP 工具调用范围限制说明（注释型文档） |
| D21 | `docs/design/2026-07-05-background-agent.md` | md | docs/design/ | 已解析 | 后台常驻 Agent 设计（已确认，Phase P0） |
| D22 | `docs/design/2026-07-05-context-aware-conversation.md` | md | docs/design/ | 已解析 | 上下文感知智能对话设计（已确认） |
| D23 | `docs/plans/2026-07-05-background-agent.md` | md | docs/plans/ | 已解析 | 后台常驻 Agent 实施计划（task-by-task） |
| D24 | `docs/plans/2026-07-05-context-aware-conversation.md` | md | docs/plans/ | 已解析 | 上下文感知对话实施计划（task-by-task） |
| D25 | `docs/testing/coverage-plan.md` | md | docs/testing/ | 已解析 | 测试覆盖率提升计划（基线 + 阶段目标） |

**类型枚举说明**：本批资料全部为 Markdown（类型记为 `md`）与 Mermaid（类型记为 `mermaid`）；模板默认枚举 `docx / pdf / pptx / xlsx` 适用于通用场景，本项目原始资料实际形态为上述两类，已如实标注。

**辅助文件（未纳入主摘要范围）**：`docs/typecheck.log`、`docs/vitest.log` 及根目录 `*.log`（dev/build/test 日志）为运行期产物，非结构化文档，按主理人「仅 .md/.mermaid」要求不计入 D 编号；其结论已被 D6/D12/D13/D14 等验证报告引用，下游如需底层证据可回溯这些日志。

---

## 2. 资料内容摘要

> 逐份文档按自身章节结构做摘要。每条摘要标注章节号（`D编号，§章节`），后面任何人想核实某个点，直接定位回原文对应位置即可。

### D1：README.md

> 项目总览与快速上手入口 — 来源：项目根目录主 README（版本 v0.2.0）

| 章节 | 内容摘要 |
| --- | --- |
| D1，§前置条件 | 本地 SDK 为必选项：通过 `file:` 依赖引用本地 AgentPrimordia SDK（`@agentprimordia/sdk`）。需存在 `../codecast/AgentPrimordia/sdk/typescript` 或设置 `AELA_SDK_PATH` 指向已构建 dist；否则 `postinstall` 校验失败、类型检查/构建失败。 |
| D1，§快速开始 | 提供 `npm install` / `npm run dev` / `npm run typecheck` / `npm run lint` / `npm test` / `npm run build`（及 build:win/mac/linux）命令。 |
| D1，§项目特性 | 列出能力矩阵：多模型（10+ Provider）、ReAct Agent（含 AgentSelfTuner/SpeculativeExecutor/CachedProvider）、三层提示词系统+动态 Few-Shot、Skills、MCP（stdio/http，前缀 mcp_）、多 Agent 编排（Pipeline/Parallel/Handoff/Pool+GroupChat/Debate/Supervisor）、DAGBuilder、弹性组件（CircuitBreaker/Retry/RateLimiter/BatchProcessor）、可观测性、记忆系统、RAG、安全体系（沙箱 ACL/RuleEngine/CommandGuard/InputSanitizer/审计/Keyring）、HITL、成本追踪、结构化提取、多模态、模型路由、Agent 自适应、代码审查、Sub-Agent、工具增强、i18n。 |
| D1，§SDK 集成架构 | 深度集成 `@agentprimordia/sdk` v1.0.0，分五个阶段（Phase 1–5 全部完成）：替换 14 个自研服务、集成 12 项 SDK 独有能力、RAG/Orchestration/Agent 增强、高价值模块集成、SDK 新能力闭环（记忆读写闭环/安全接入/ContextWindow/ModelRouter/SDKToolsView）。 |
| D1，§项目结构 | 给出 `src/` 树：主进程（40+ 服务，26 个 IPC handler 文件，~200 通道）、preload（~55 API 分组）、renderer（30+ 视图，Zustand 7 切片）、shared（types.ts / ipcChannels.ts ~200 通道 / sdkTypes.ts / i18n）。 |
| D1，§架构概览 | 三层架构图：Renderer(Zustand) → Preload(contextBridge) → Main(ServiceContainer DI 40+ 服务) → @agentprimordia/sdk v1.0.0。 |
| D1，§安全说明 | API Key 用 Electron `safeStorage`（macOS Keychain / Windows DPAPI / Linux libsecret），前缀 `enc:v1:`（加密）、`b64:`（降级明文等价，不推荐）、无前缀（旧版自动加密）；`contextIsolation:true`+`nodeIntegration:false`；Shell 命令三级风险（safe/moderate/dangerous）；沙箱 ACL（none/read/write/execute/all）；CommandGuard；InputSanitizer；GuardrailService（输入/输出双向）；SecurityService（before_tool 注入/路径穿越/ACL）；审计日志 `logs/audit.jsonl`。 |
| D1，§SDK 依赖 | 依赖 `@agentprimordia/sdk: "file:../codecast/AgentPrimordia/sdk/typescript"`；发布时可切 `^1.0.0`；可用 `AELA_SDK_PATH` 自定义路径。 |
| D1，§贡献 | 开发流程：改码后跑 `typecheck && lint && test`；保持 slice 架构；新服务注册 ServiceContainer 用 SERVICE_TOKENS；新 IPC 通道在 `ipcChannels.ts` 定义；核心服务测试覆盖率目标 ≥ 60%。 |
| D1，§许可证 | MIT。 |

### D2：CODE_WIKI.md

> 代码库完整说明，信息量最大 — 来源：项目根目录 CODE_WIKI.md（更新 2026-07-02）

| 章节 | 内容摘要 |
| --- | --- |
| D2，§1 项目概述 | AELA 是 Electron 桌面端 AI 编码助手，Solo 模式（单 Agent 自主执行），集成 AgentPrimordia SDK 实现 ReAct 编排；列出核心特性（多模型、ReAct+自省、三层提示词+6 变体、工作区、Skills、MCP、Shell 三级确认、自动化、多 Agent 编排、DAG/协作/Supervisor/动态拓扑、可观测性、记忆、安全、成本、上下文窗口、规划/反思/工具学习、HITL、多模态、模型路由、弹性、推理引擎、结构化提取、工具增强、代码审查/Sub-Agent/图片转代码、主题、i18n）。 |
| D2，§2 技术栈 | Electron 33 + React 18 + TS；electron-vite 2.3 + Vite 5；Zustand 4（7 切片）；Tailwind 3；react-markdown；自研 i18n（useSyncExternalStore，字典 `src/shared/i18n.ts`）；electron-store 10 + better-sqlite3（FTS5+HNSW）；SDK `@agentprimordia/sdk`（本地，120+ 模块）；electron-builder 25；自研 ServiceContainer DI。 |
| D2，§3 项目结构 | 完整 `src/` 树；主进程 40+ 服务（含 sdk/ 适配器 ABTest/Batch/EvalSuite、orchestration/ 子模块、tools/builtin 等）；preload ~55 API 分组；renderer 30+ 视图组件（含 SDKToolsView、ResilienceView、38 个 Settings Tab）；shared 4 文件（types.ts/ipcChannels.ts/sdkTypes.ts/i18n.ts ~900 条）。 |
| D2，§4 整体架构 | 三层架构图（Renderer ↔ Preload ↔ Main DI 容器 ↔ SDK），列出 Main 内服务网格（Agent/Orchest/Memory/Security/Prompt/RAG/Reasoning/Resilience/SDK Enhance/Cost/Context/Planning/Reflection/HITL/Terminal/Preview/TestGen/Wiki/CodeReview/SubAgent/Img2Code/Adaptive/Screenshot/DAG/Collab/Supervisor/DynamicDAG/Audit/ToolLearn/Observab）。 |
| D2，§5 主进程模块 | §5.1 入口 `index.ts`：单实例锁、40+ 服务初始化、`wireComponents()` 注入高级服务、注册 IPC、Shell 确认回调、before-quit `stopAll()`；给出服务初始化顺序（基础→可观测→Agent→编排→数据→工具→高级→SDK）。§5.2 ServiceContainer：`register/registerFactory/get/resolve/startAll/stopAll`、SERVICE_TOKENS 40+、消除 37+ 参数传递。§5.3 AgentService：核心方法表（runStream/stop/pause/resume/wireComponents 等）+ runStream 12 步流程 + 10 个 HookPoint 表 + Few-Shot 库（aela.code 5 例/aela.daily 5 例）。§5.4 AgentHookFactory：创建 10 HookPoint。§5.5 PromptBuilder：三层（共享基础层+模式专属层+变体层）+ 6 变体表。§5.6 PromptService：TemplateEngine/FewShotTemplate/ExampleSelector（3 实现）。§5.7 ProviderManager：openai/custom→OpenAIProvider、anthropic、ollama、gemini。§5.8 ToolManager：12 内置工具表 + MCP/Skill 适配（前缀 mcp_/skill_）+ 缓存 + 开关。§5.9 其他核心服务：~45 个服务职责简表（含 OrchestrationService「7 模式」、DAGScheduler、Collaboration、Supervisor、DynamicDAG 等）。 |
| D2，§6 预加载层 | `contextBridge.exposeInMainWorld('aela', api)`，~55 API 分组，列出分组名+主要方法（model/workspace/session/agent/mcp/shell/skill/automation/config/orchestration*/dag/collaboration/dynamicDag/supervisor/metrics/observability/memory*/security/guardrail/rag/telemetry/debugger/builtinTools/toolCache/cost/contextWindow/audit/prompt*/planning/reflection/toolLearning*/hitl/multimodal/fileChange/terminal/hookConfig/preview/multiFile/testGen/wiki/agentConfig/modelRoute/codeReview/subAgent/img2code/sdkEnhancements/resilience/reasoning/fewShotWeight/adaptiveLearning/screenshotAnalysis）；封装带类型参数的 `invoke()`（泛型调用）。 |
| D2，§7 渲染进程模块 | §7.1 入口 App.tsx（30+ 视图）；§7.2 i18n（useT/setLang/t，~900 条）；§7.3 Zustand 7 切片表 + 即时应用 + loadInitial 流程；§7.4 ChatView（消息/流式/模式/Skill/工作区/模型/Memory 注入）；§7.5 SettingsView「38 个 Tab（13 配置 + 25 工具）」；§7.6 其他视图组件表（Sidebar/InputBox/ModelConfigView/MCPManagerView/SDKToolsView/ResilienceView/MessageBubble/ToolCallDisplay/DiffView/WorkbenchPanel/ErrorBoundary/Dialog/chat 子组件）。 |
| D2，§8 共享类型 | 4 文件（types.ts/ipcChannels.ts/sdkTypes.ts/i18n.ts）；核心类型 ~100+（列出 ModelConfig/Session/ChatMessage/StreamEvent/MemoryEpisode/GuardrailResult/DAGConfig/OrchestrationConfig 等）；IPC_CHANNELS ~200 通道。 |
| D2，§9 IPC 通信协议 | 通信模式（invoke/handle/get/方法）；通道分组表（~200 通道、26 handler 文件，列出 Agent/模型/工作区/会话/MCP/配置/Shell/Skills/自动化/编排/DAG/协作/动态DAG/指标/可观测性/记忆/安全/护栏/Supervisor/RAG/遥测/调试器/工具缓存/内置工具/成本/上下文/审计/提示词/规划/反思/工具学习/HITL/多模态/文件变更/终端/Hooks/预览/多文件/测试生成/Wiki/Agent配置/模型路由/代码审查/Sub-Agent/图片转代码/SDK/弹性/推理/自适应/截图）；流式事件通道表（agent/orchestration/collaboration/dynamic-dag/automation 的 event 通道）。 |
| D2，§10 数据持久化 | electron-store（ConfigStore/SessionStore/AutomationStore/CostTracker/ToolLearning/Memory/RAG 共 7 服务）、better-sqlite3（MemoryService FTS5+HNSW）、appendFileSync（AuditService `logs/audit.jsonl`）；文件：`aela-config.json`/`aela-sessions.json`/`aela-automation.json`/SQLite/`logs/audit.jsonl`。 |
| D2，§11 安全机制 | §11.1 进程隔离（contextIsolation:true、nodeIntegration:false、外部链接系统浏览器、CSP）；§11.2 Shell 三级风险（safe/moderate/dangerous）；§11.3 安全沙箱 SecurityService（ACL + before_tool 注入/路径穿越/ACL）；§11.4 护栏 GuardrailService（before_llm/after_llm 双向、注入/PII/话题/关键词、pass/reject/sanitize/flag）；§11.5 CommandGuard/InputSanitizer；§11.6 审计日志；§11.7 单实例锁。 |
| D2，§12 构建与运行 | dev/build/typecheck/lint 命令；构建流程 electron-vite build → electron-builder → release/。 |
| D2，§13 依赖关系图 | 模块依赖树（ServiceContainer 及其下所有服务与 SDK 依赖）+ 外部依赖清单（SDK 120+ 模块、electron-store、better-sqlite3、zustand、react、tailwind、react-markdown、electron-builder、electron-vite）。 |
| D2，附录 数据流示例 | 用户发消息完整数据流（Renderer→Preload→Main AgentService.runStream 12 步+Hook 系统 5 类+流式回传）；多 Agent 编排数据流。 |

### D3：SDK集成架构文档.md

> SDK 集成架构与设计细节 — 来源：项目根目录 SDK集成架构文档.md（更新 2026-07-02）

| 章节 | 内容摘要 |
| --- | --- |
| D3，§1 概述 | 描述 AELA 与 AgentPrimordia TypeScript SDK 的集成架构、接口设计与最佳实践。§1.1 技术栈：Electron 33 + React 18 + TS；SDK TS 120+ 模块；IPC；tsup（SDK）+ electron-vite（AELA）；Zustand 4（7 切片）；electron-store 10 + better-sqlite3。§1.2 依赖关系：`devDependencies` 引用 `file:../codecast/AgentPrimordia/sdk/typescript`；发布切 `^1.0.0`。 |
| D3，§2 集成层次架构 | 层次图：Renderer（30+ 视图/SDKToolsView、window.aela ~55 分组）→ IPC 层（26 handler 文件、~200 通道）→ Main（ServiceContainer 40+ 服务、AgentService+SDKEnhancements+Reasoning+RAG+Resilience+Memory+ModelRouter+Orchestration）→ AP SDK 层（ReActAgent/Lifecycle/HookManager、15+ Provider、Memory、Orchestration、Security、Tools、Observability、Evolution、Resilience、Reasoning、RAG、Structured、Multimodal）。 |
| D3，§3 核心服务详解 | §3.1 AgentService：职责+SDK 集成（ReActAgent/AgentSelfTuner/SpeculativeExecutor/CachedProvider+FingerprintCache）+ Phase 5 注入链 `wireComponents()` + 注入方法 + AgentHookFactory（10 HookPoint）+ runStream() 14 步增强流程（含 MemoryService.hybridSearchScored Top-5、Guardrail before_llm/after_llm、Security before_tool、ContextWindow、ModelRouter）。§3.2 SDKEnhancementsService：12 项能力表（结构化提取/多模态融合/批处理/A-B测试/评估套件/流式管道/动态编排/插件热加载/Worker池/可视化/Agent监控/缓存统计）含 IPC 通道；Phase 5 UI 新增 SDKToolsView 四子面板。§3.3 ReasoningService（ReasoningEngine + reasoning:reason 等通道）。§3.4 RAGService（RAGStore+RAGReranker+MMRReranker+Summarizer+文档加载器）。§3.5 ResilienceService（CircuitBreaker/Retry/ResilientWrapper/RateLimiter/BatchProcessor）。§3.6 MemoryService（SqliteMemoryStore+FTS5+HNSW+HashEmbedding+Compressor+衰减；Phase 5 读写闭环）。§3.7 OrchestrationService：4 基础模式 + GroupChat/Debate/Supervisor；扩展子目录（GroupChat/StreamingPipeline/Supervisor/Replay/Templates Orchestrator）。 |
| D3，§4 IPC 通道设计 | §4.1 命名规范（sdk:/sdk:abtest-*/memory:/security:/resilience:/reasoning: 等）；§4.2 完整列表分组（基础域~30/编排域~15/安全域~20/AI域~30/SDK域~30/工具域~25/成本域~15/高级域~25）；§4.3 统一错误处理 `wrap()`；§4.4 26 handler 文件清单（agent/session/modelConfig/workspace/orchestration/mcp/skill/automation/memory/security/sdkEnhancements/sdkPhase4/terminal/preview/multifile/testgen/wiki/hookConfig/toolLearning/codeReview/subagent/img2code/screenshot/resilience/telemetry/debugger/misc）。 |
| D3，§5 DI 容器架构 | §5.1 ServiceContainer（register/get/startAll/stopAll）；§5.2 SERVICE_TOKENS 40+；§5.3 `registerIPC(container)` 消除 37+ 参数传递。 |
| D3，§6 类型系统 | §6.1 共享类型 3 文件（types.ts ~100+ 类型 / ipcChannels.ts ~200 通道+IPCResponse / sdkTypes.ts）；§6.2 类型对齐度 ~95%（Message/MemoryEpisode/AgentMetrics 100%、ToolCallInfo 95%）；§6.3 SDK 22 种错误码（AGENT_001/TOOL_001/LLM_001 等）。 |
| D3，§7 数据流向 | 数据流图：User Input→Renderer→Main AgentService.runStream（Memory 检索注入/PromptBuilder/Few-Shot/HookManager/Security/Audit/HITL/ReActAgent）→UI Update。 |
| D3，§8 最佳实践 | §8.1 服务层（DI 注册/统一生命周期/懒加载/依赖注入）；§8.2 IPC Handler（wrap()/container.get 泛型调用/类型安全/通道常量）；§8.3 渲染进程（Preload API/Zustand slice/错误处理/加载态）。 |
| D3，§9 测试 | §9.1 单元测试（Vitest + Mock）；§9.2 测试覆盖清单（A/B 测试/评估套件/流式管道/动态编排/插件/Worker/可视化/监控/生命周期）。 |
| D3，§10 版本管理 | §10.1 SDK 版本 1.0.0；§10.2 兼容性：AELA 0.2.0 ↔ SDK 1.0.0 兼容（Phase 1-5 全完成），0.1.0 ↔ 1.0.0 兼容（Phase 1-4）。 |
| D3，§11 故障排查 | §11.1 常见问题表（SDK 初始化失败/IPC 超时/类型不匹配/Guardrail 阻断/记忆检索无果/熔断器 open）；§11.2 调试技巧（主进程日志 userData/aela-main.log、渲染进程 Console、IPC 断点、Hook 链路日志）。 |

### D4：USER_GUIDE.md

> 用户使用指南 — 来源：项目根目录 USER_GUIDE.md（v0.2.0）

| 章节 | 内容摘要 |
| --- | --- |
| D4，§1 快速开始 | §1.1 安装（Win `.exe` NSIS / macOS `.dmg` / Linux `.AppImage`，单实例）；§1.2 配置模型（添加模型字段表、支持 OpenAI/Anthropic/Ollama/Custom）；§1.3 发起第一次对话。 |
| D4，§2 界面导航 | 侧边栏（新建任务/技能/自动化/任务列表/设置）+ 主内容区；设置页「共 27 个标签页」但下文明列「配置类 13 + 功能模块 25 = 38」（见 §3 冲突 X4）。 |
| D4，§3 对话与编码 | §3.1 两种模式（Code/Office，影响 system prompt）；§3.2 工作区（文件树/搜索/读写/AGENTS.md/CLAUDE.md）；§3.3 技能系统（Markdown 格式、/触发、`as_tool:true` 注册为工具、扫描路径 ~/.aela/skills 等 + 第三方 .claude/.codex/.cursor）；§3.4 Shell 命令三级风险确认（绿/黄/红 + 拒绝/允许本次/本次会话允许同类）；§3.5 HITL（中断点/自动批准/预算超限中断）；§3.6 文件变更与 Diff 审查（接受/拒绝）；§3.7 内嵌终端（xterm.js）；§3.8 6 种提示词变体（default/concise/safety-first/code-reviewer/pair-programmer/mentor-coach）。 |
| D4，§4 技能管理 | 技能列表/预览/扫描路径/诊断/重新扫描；自定义技能创建；Skill 作为工具（skill_ 前缀）。 |
| D4，§5 自动化任务 | 触发类型（手动/定时 Cron/事件）；操作（创建/试运行/历史/启停）；执行历史保留最近 200 条。 |
| D4，§6 多 Agent 编排 | 称「支持 5 种编排模式」（与 CODE_WIKI 的 7 模式不一致，见 §3 X9）。§6.1 基本编排（Pipeline/Parallel/Handoff/Pool）；§6.2 DAG 调度器（拓扑排序/并发/Fail-Fast）；§6.3 协作模式（Debate/Review/Consensus/Brainstorm）；§6.4 Supervisor（Worker 池/调度策略/优先级队列）；§6.5 动态拓扑 DAG（条件路由边/Agent·Transform·Condition 节点/动态拓扑）。 |
| D4，§7 开发者工具集 | §7.1 代码审查（严重度 红/橙/黄/蓝、类别 安全/性能/风格/Bug）；§7.2 自动测试生成；§7.3 Repo Wiki；§7.4 图片转代码（React/Vue3/HTML/Tailwind/Svelte/Angular）；§7.5 多文件编辑；§7.6 浏览器预览；§7.7 Agent 配置（可选工具 read_file/write_file/list_directory/search_code/execute_command/web_fetch/mcp_tool）；§7.8 Sub-Agent 隔离（资源配额/聚合模式 concat-best-merge-vote/Fail-Fast/最大并发）。 |
| D4，§8 高级配置 | §8.1 成本与预算（摘要/按模型/预算/定价表/HITL 中断）；§8.2 上下文窗口（Trim/Compress）；§8.3 安全与护栏（ACL none-read-write-execute-all、护栏规则 注入/PII/话题/关键词、动作 pass/reject/sanitize/flag）；§8.4 审计日志（logs/audit.jsonl）；§8.5 提示词模板与 Few-Shot（{{.key}}/{{if}}/{{range}}）；§8.6 Hooks 配置（10 个 Hook 点表 + 动作 执行命令/阻止/修改输入/通知）；§8.7 遥测与调试（OTel/调试器/Node Inspector）；§8.8 工具管理（12 内置工具开关 + 缓存统计）；§8.9 RAG 管道（摄入/混合检索/增强/统计）；§8.10 任务规划；§8.11 规则与记忆（全局记忆/自定义规则/上下文文件/情景记忆压缩）；§8.12 MCP 服务器管理（stdio/http、工具前缀 mcp_）；§8.13 自定义命令（/命令名）。 |
| D4，§9 主题与国际化 | 深色/浅色主题、语言（中文/English）、字体大小、Enter 发送，均即时持久化。 |
| D4，§10 常见问题 | 模型配置/文件访问/Shell 拦截/Token 节省/技能扫描/多 Agent 区别/数据存储（userData 下 aela-*.json + logs/audit.jsonl）/重置应用。 |

### D5：CONTRIBUTING.md

> 贡献指南 — 来源：项目根目录 CONTRIBUTING.md

| 章节 | 内容摘要 |
| --- | --- |
| D5，§1 前置条件 | 同 D1：本地 SDK 必选项（`file:../codecast/AgentPrimordia/sdk/typescript` 或 `AELA_SDK_PATH`）；`postinstall` 校验不通过则类型检查/构建失败。 |
| D5，§2 本地开发 | `npm install` / `npm run dev` / `npm run typecheck`（node+web）/ `npm run lint` / `npm test` / `npm run test:coverage` / `npm run build`。 |
| D5，§3 代码规范 | TS strict；注释简体中文；Google 风格（2 空格/camelCase）；强类型（避免 any，SDK 载荷确需 any 注明）；可测试（核心服务覆盖率 ≥ 60%）；渲染层 React 函数组件+Hooks+Zustand slice。 |
| D5，§4 架构约定 | §4.1 新增服务须在 ServiceContainer 注册并用 SERVICE_TOKENS；§4.2 新增 IPC 通道须在 `ipcChannels.ts` 定义常量 + handler 用 `validateInput(schema, params)`（zod，优先复用宽松 Schema）+ `wrap()` + preload/api 暴露 + global.d.ts 补齐；§4.3 上帝文件拆分（内容/常量型按业务维度拆，index.ts 桶文件 re-export，导出面 100% 不变红线）；§4.4 安全基线不可降级（contextIsolation:true+nodeIntegration:false、严格 CSP、safeStorage，OS Keyring 不可用时 SecretStore 必须 fail-closed 拒绝明文落盘）。 |
| D5，§5 提交与 PR | 分支命名 feat/fix/refactor/docs/test/chore/style/perf/type；提交前 typecheck+lint+test；Conventional Commits；PR 说明动机/影响/自测/是否触安全基线；上帝文件拆分/安全改动重点评审。 |
| D5，§6 许可证 | MIT。 |

### D6：verification_report.md

> 源码修复验证报告 — 来源：项目根目录 verification_report.md

| 章节 | 内容摘要 |
| --- | --- |
| D6，一、已修复问题验证 | 12 项验证表（#1 ObservabilityService.trendTimer close 清理、#1b 趋势持久化 flushTrendPoints 防抖、#2 runStream try/finally+yield* 修复 TOCTOU、#3 SessionStore 批量 IN 查询、#4 FTS5 MATCH 搜索、#5 ToolLearning 防抖、#6 translateF 回调避免 $& 注入、#7 setLang 监听 try/catch、#8 TerminalView dataDisposable、#9 DiffList 单次 reduce、#10 ToolCache write_file 后 invalidatePath「部分通过」（executeWithCache 从未被调用）、#11 readProjectMdFiles mtime 缓存「通过（有部分缺陷）」、#12 TerminalService env 白名单）。 |
| D6，二、新发现问题 | 6 个 Bug 均标注「✅ 已修复」（更新 2026-07-03）：Bug#1 HIGH 趋势点全量刷盘（flushTrendPoints 未被调用）；Bug#2 HIGH ShellTool 全量继承 process.env 泄漏（改白名单 safeEnv）；Bug#3 MEDIUM ToolManager 死代码/缓存失效（移除 executeWithCache 等）；Bug#4 MEDIUM SubAgent Promise.race 超时未捕获 rejection；Bug#5 MEDIUM readProjectMdFiles 仅 AGENTS.md mtime 校验（重构至 AgentContextBuilder）；Bug#6 LOW shellAndSearch killTimer Windows SIGKILL 语义。 |
| D6，三、总结 | 严重度统计：HIGH 2、MEDIUM 3、LOW 1，全部已修复。 |

### D7：docs/incremental-design-fixall-2026-07-06.md

> 增量修复架构设计（FixAll）— 来源：架构师 高见远（software-architect），依据 D9+D8

| 章节 | 内容摘要 |
| --- | --- |
| D7，§0 评估报告路径勘误 | 重要更正：validateInput 实际在 `src/main/ipc/schemas.ts:253-260`（非评估所述 `main/utils/ipcHelpers.ts`）；secretStore.ts 在 `src/main/secretStore.ts`（73 行，非 services/ 下）；Q-1 promptContents 实际按「基础层+模式(coding/daily)×变体」组织，非 PRD 文字的 agent/tool/system（修正 PRD 口径）。 |
| D7，§1 实现方案与框架选型 | §1.1 技术栈不变（Electron^33+React18+TS^5.6+electron-vite^2.3+Vite^5.4+Vitest^4+Playwright^1.61）；唯一新增依赖 `react-window@^1.8.10`（devDependency）；移除 yjs/y-websocket/lib0（全仓零 import）。§1.2 D-1/D-2 对打包影响：BUNDLE_DEPS 已含 electron-store，electron.vite.config.ts 无需改；D-2 移除不影响产物。§1.3 各改动思路表（A-3 删 sync-server、D-1/D-2 依赖、S-1 SecretStore fail-closed、S-2 apiKey 改 header、Q-2/S-3 21 handler 补 zod、Q-1 内容型拆分、P-1 react-window、M-2 文档、M-1 补单测）。 |
| D7，§2 文件列表 | T1 依赖治理（package.json/lockfile，electron.vite.config.ts 无改）；T2 删 sync-server；T3 SecretStore fail-closed + SettingsView 提示；T4 sync apiKey 加固 + SyncService；T5 schemas.ts + 21 handler；T6 i18n/promptContents 内容型拆分（index.ts 桶文件）；T7 消息列表虚拟化（react-window + MessageList.tsx）；T8 CONTRIBUTING+README；T9 补单测（不改门禁）。 |
| D7，§3 任务列表 | T1–T9 有序任务，含依赖与验收点；实现顺序建议 T1→T2→T3/T4→T5→T6→T7→T8→T9；T7 依赖 T1，T9 依赖 T3/T5/T6。 |
| D7，§4 共享知识 | zod 集中 schemas.ts 约定、validateInput 调用范式、i18n 拆分导入方式（@shared/i18n，8 导出）、promptContents 拆分（13 常量）、MessageList props 约定、react-window 版本 ^1.8.10。 |
| D7，§5 风险与回归范围 | 回归风险表：T1 重装跑全量门禁、S-1 行为变更需单测+e2e、T5 schema 严格度对照调用方、T4 两端契约同步；红线：D-1/D-2 重装全绿、S-1 insecure 锁死、T5 严格度实测、T4 同步。 |
| D7，§6 待明确事项（Open Questions） | 8 项：A-1/D-3 SDK 解耦方案（npm/monorepo/submodule，未定前不改 file: 依赖）；S-2 客户端改造范围；Q-1 拆分口径（base/coding/daily 是否可接受）；S-1 主密码派生（本轮只做最小 fail-closed）；P-1 虚拟化选型（默认 react-window）；Q-2 schema 严格度（id 是否统一 sessionIdSchema max128）；A-2 表面积收敛规范落点；D-2 transitive 残留。 |
| D7，§7 任务依赖图 | mermaid 图：T1 独立、T7→T1、T9→T3/T5/T6，其余可并行。 |

### D8：docs/incremental-prd-fixall-2026-07-06.md

> 增量修复 PRD（FixAll）— 来源：产品经理 许清楚（software-product-manager），依据 D9

| 章节 | 内容摘要 |
| --- | --- |
| D8，§0 总览表 | 15 项问题定性：可直接修且实现 8 项（A-3,Q-2,D-1,D-2,S-1,S-3,S-4,M-2）；需架构决策推迟 2 项（A-1,D-3）；分阶段演进安全起步 3 项（Q-1,S-2,P-1）；纯路线图 2 项（A-2,M-1）。 |
| D8，§1 逐项定性 | §1.1 A-1/D-3 SDK 兄弟依赖（P1，需架构决策，三选一 npm/monorepo/submodule，本轮只补文档+环境变量回退）；§1.2 A-2 表面积过大（P2，立规范）；§1.3 A-3 死代码 sync-server（P1，可直接修）；§1.4 Q-1 上帝文件（P2，内容型本轮拆，类型型/逻辑型分阶段）；§1.5 Q-2/S-3 IPC 校验（P1，补 ~20 handler zod）；§1.6 D-1 依赖分类（P1，react/react-dom/electron-store 移入 dependencies）；§1.7 D-2 未使用依赖（P2，移除 yjs/y-websocket/lib0）；§1.8 S-1 SecretStore 明文降级（P1，fail-closed，可选主密码增强）；§1.9 S-2 apiKey 入 URL query（P2，改 header+限流，TLS 推迟）；§1.10 S-4 echo 死代码（P2，并入 A-3）；§1.11 M-1 覆盖率（P2，门禁 30→45→60 分步，本轮不强制提升）；§1.12 M-2 文档（P2，补 CONTRIBUTING）；§1.13 P-1 列表虚拟化（P2，消息列表试点）。 |
| D8，§2 可直接修实现清单 | 8 项动作表（A-3/S-4 删 sync-server、Q-2/S-3 补 zod、D-1 依赖移入、D-2 移除未使用、S-1 fail-closed、M-2 补文档）；执行顺序建议 D-1/D-2→A-3/S-4→S-1→Q-2/S-3→M-2。 |
| D8，§3 需架构决策/分阶段推迟清单 | A-1/D-3（SDK 解耦，只补文档）、A-2（表面积规范）、Q-1（内容型拆）、S-2（apiKey 改 header+限流）、M-1（覆盖率路线）、P-1（消息列表试点）。 |
| D8，§4 重点处置建议 | §4.1 A-1/D-3 根因与结论（需架构决策，本轮不动）；§4.2 Q-1 分层处置（内容型本轮拆，类型型代码生成、逻辑型单独立项，拆分红线导出签名不变）。 |
| D8，§5 风险与回归总览 | 低风险（依赖/死代码/单文件加固/文档）vs 中高风险（SDK 依赖图/多 View 重构/逻辑型大文件/TLS）；建议门禁。 |

### D9：docs/project-evaluation-2026-07-06.md

> 项目深度评估报告 — 来源：架构师 高见远，2026-07-06（静态源码审查，未改文件）

| 章节 | 内容摘要 |
| --- | --- |
| D9，⚠️ 关键更正 | 任务简报称「Go 后端 API + Agent 引擎」，但仓库内无 Go 代码；实际技术栈为 Electron + TypeScript 单体应用，主进程承担「后端」，Agent 引擎来自 `@agentprimordia/sdk`（兄弟仓库 `file:` 依赖）。本报告基于真实架构撰写。 |
| D9，§0 项目概览与评估方法论 | §0.1 代码规模：src ~58,440 行；main 138 文件、preload 31 文件（24 api 命名空间）、renderer 89.tsx+24.ts、shared 39 文件；测试 ~70；DI 容器 ~53 服务；IPC 通道 325 个；文档体系较完善。§0.2 评估方法（扫描+精读+静态模式扫描+配置CI审查）。 |
| D9，§1 项目架构评估 | §1.1 分层架构图（Renderer→Preload→Main→SDK），优点：三层分离、DI 容器（topoSort 防循环依赖）、IPC handler 拆分、视图懒加载；§1.2 问题与表（上帝文件、~53 服务膨胀、两份 sync-server、SDK file: 耦合、325 IPC 通道），架构级风险 A-1/A-2/A-3。 |
| D9，§2 代码质量评估 | §2.1 ESLint/Prettier/strict 良好、wrap() 统一响应、zod 部分（17/37 handler 导入 validateInput）；§2.2 错误处理序列图 + 不足（~20/37 handler 无 zod 校验）；§2.3 代码坏味道表（上帝文件 i18n 1428/promptContents 860/SessionStore 720/global.d.ts 673/ToolManager 664/MemoryService 652、死代码 sync-server、重复 sync-server、魔法数字）。 |
| D9，§3 依赖与配置分析 | §3.1 依赖清单（运行时依赖误置 devDependencies：react/react-dom/electron-store；声明未使用 yjs/y-websocket/lib0；兄弟 file: 依赖；版本较新合理；ws 仅 sync-server）；§3.2 配置文件审查（electron.vite.config.ts 合理含 AELA_SDK_PATH 回退、tsconfig 合理、tailwind 主题、vitest 覆盖率门禁 语句45/分支30/函数45/行45 当前实测 51/36/51/52、playwright 合理、eslint 严格）。 |
| D9，§4 性能与安全评估 | §4.1 性能（流式渲染 O(n) 优化优、视图懒加载、定时器清理依赖调用方、大列表虚拟化未核实、包体积含未使用依赖）；§4.2 安全（正面：sandbox:true+contextIsolation:true+nodeIntegration:false、CSP 分离、safeStorage、无硬编码密钥、dangerouslySetInnerHTML 已 escape；风险：S-1 Base64 明文降级、S-2 apiKey 入 URL query、S-3 ~20/37 handler 无校验、S-4 echo 死代码）。 |
| D9，§5 可维护性与扩展性评估 | §5.1 模块化良好（~53 服务、37 handler、15 Zustand store、配置外置）；§5.2 测试覆盖表（语句 51.02%/分支 35.91%/函数 50.84%/行 52.19，均越线但分支偏低；渲染层组件测试少）；§5.3 文档完善（缺 CONTRIBUTING.md、SDK 前置条件未显著标注）。 |
| D9，§6 问题总结与改进建议 | §6.1 问题汇总表（A-1~P-1 共 15 项，含严重度/优先级/证据）；§6.2 Top 5–10 问题（S-3/Q-2、D-1、A-1/D-3、S-1、A-3、D-2、A-2、Q-1、M-1、P-1）；§6.3 改进路线图 gantt（P1 1-2 周、P2 3-6 周）；无 P0 阻断。 |
| D9，§7 总体健康度评分 | 架构 76 / 代码质量 73 / 依赖与配置 66 / 性能与安全 77 / 可维护与扩展 80 / 综合 74；结论「健康且可继续演进」，优先 P1 五项。 |
| D9，附录 A | 最大源文件 Top 20（i18n 1428、promptContents 860、PromptService 812、SessionStore 720、global.d.ts 673、ToolManager 664、MemoryService 652…）。 |
| D9，附录 B | 评估所用关键命令（结构/安全扫描/依赖使用率/校验覆盖率/死代码）。 |

### D10：docs/class-diagram.mermaid

> 类图 — 来源：docs/class-diagram.mermaid（配合增量修复设计 D7 的 Q-2/S-3/S-1/S-2/Q-1 改动）

| 章节 | 内容摘要 |
| --- | --- |
| D10，校验基础设施 | `schemas` 类（+sessionIdSchema/+filePathSchema/+nonEmptyStringSchema/+terminalRunCommandSchema/+validateInput）、`ipcHelpers` 类（+wrap）、`Handler` 类（registerXxxHandlers）；Handler 依赖 schemas（入口 validateInput）与 ipcHelpers（包 wrap）。 |
| D10，S-1 SecretStore | `SecretStore` 接口（encrypt/decrypt/isSecure）+ `createSecretStore` 工厂；note：insecure 时 encrypt 抛错/内存态，拒绝明文落盘（对应 T3）。 |
| D10，S-2 SyncService | `SyncService` 类（-ws/connect/-openWebSocket L235 改传参）；note：T4 apiKey 改 header/子协议，去掉 query。 |
| D10，Q-1 i18n 拆分 | `i18n_index` 桶文件（Lang/dict/setLang+getLang/subscribeLang+getLangSnapshot/translate/translateF）聚合 i18n_zh/en/common（导出面不变）。 |
| D10，Q-1 promptContents 拆分 | `promptContents_index` 桶文件（promptBase + promptCoding*/promptDaily* 12 变体）聚合 prompt_base/coding/daily；`PromptBuilder` 经 `from './promptContents'` 依赖桶文件。 |

### D11：docs/sequence-diagram.mermaid

> 时序图 — 来源：docs/sequence-diagram.mermaid（sync apiKey 传输改前/改后对比，对应 S-2/T4）

| 章节 | 内容摘要 |
| --- | --- |
| D11，改前（现状，不安全） | Renderer(preload/api/sync.ts)→SyncService→sync-server：WebSocket `serverUrl/ws?roomId=..&apiKey=..`（SyncService.ts:235），server 用 `url.searchParams.get('apiKey')`（sync-server.ts:117）；apiKey 缺失则 ws.close(4001)。 |
| D11，改后（T4 目标） | 同链路：WebSocket `serverUrl/ws?roomId=..`，`{ headers: { 'X-Api-Key': apiKey } }`；server 读 `req.headers['x-api-key']` + 令牌桶限流；无效/超限则 ws.close(4001) 或 429；通过后 file_update/awareness 广播。 |

### D12：docs/qa-report-fixall-2026-07-06.md

> 增量修复回归验证 QA 报告 — 来源：QA 严过关，2026-07-06，验证工程师 T1–T9 交付

| 章节 | 内容摘要 |
| --- | --- |
| D12，一、最终判定 | 通过（源码 Bug 已修复，Round 2 复跑全绿）；测试通过率（不依赖 SDK 子集）185/185（100%）；遗留 1 项非阻断（T3 SettingsView UI 提示未实现）；智能路由 Round1→Engineer、Round2→NoOne。 |
| D12，二、测试执行结果 | §2.1 重跑新增测试：secretStore 7、schemas 14、i18n 8，合计 29/29（与工程师自测一致；schemas 重复声明 genericNumberOptionalSchema 已修复为单处 L271）。§2.2 扩展可运行子集：promptBuilder 25、i18n 8、多 handler（agent/memory/security/orchestration 等）共 164，162 通过/2 失败（sdkEnhancements.test.ts，源码 Bug）。 |
| D12，三、静态正确性核查 | T1 依赖治理 PASS（react/react-dom/electron-store 移入 dependencies、yjs/y-websocket/lib0 移除、@agentprimordia/sdk 仍 devDependencies、新增 react-window@^1.8.11 + 冗余 @types/react-window）；T2 删 sync-server PASS；T3 SecretStore fail-closed 后端 PASS / UI 缺口（SettingsView 提示未交付）；T4 sync apiKey 加固 PASS（两端契约对齐：X-Api-Key header，roomId 走 query，限流 30/分+200/10s）；T5 IPC 校验 严格度 PASS / 1 处源码 Bug（sdkEnhancements.ts 缺 genericObjectOptionalSchema 导入，已路由工程师）；T6 内容型拆分 PASS（i18n 8 导出、promptContents 13 常量，导出面不变）；T7 消息列表虚拟化 PASS（静态，流式/diff 在 MessageList 外渲染）。 |
| D12，四、智能路由判定 | 路由 Engineer：sdkEnhancements.ts:57 引用未导入的 genericObjectOptionalSchema，一行修复建议。 |
| D12，七、Round 2 复跑 | 工程师补导入后 sdkEnhancements.test.ts 11/11 通过，全子集 185/185；2 轮闭环。 |
| D12，五、已知问题/未覆盖项 | ① 源码 Bug 已修复闭环；② T3 SettingsView UI 提示未实现（非阻断）；③ 环境限制（根 tsc/全量 vitest/playwright 因缺 SDK dist 无法跑，T4/T7 仅静态核查）。 |
| D12，六、结论 | T1–T9 整体质量良好，唯一阻断性回归为 T5 引入的缺导入 Bug（已闭环）；全子集转绿。 |

### D13：docs/qa-report-fullverify-2026-07-06.md

> 补偿性全量验证 QA 报告 — 来源：QA 严过关，2026-07-06（背景：上轮 SDK 路径错误致全量跳过，本轮修正为 `file:../AgentPrimordia/sdk/typescript`）

| 章节 | 内容摘要 |
| --- | --- |
| D13，§0 最终判定（TL;DR） | 智能路由 NoOne（无 T1–T9 代码回归）；tsc 初始失败 5 处（src/shared/i18n/）经 QA 最小化修复后通过；vitest 执行 1039/1053，通过 986（执行率 94.9%、全量率 93.6%）；Playwright e2e 2 失败（__dirname 未定义，ESM）；遗留 4 项（均非代码回归）。 |
| D13，§1 类型检查 | 初始 5 错误全在 src/shared/i18n/lang.ts（漏 `import type { Lang }` from './dict'）+ translate.ts TS7053；属 T6 拆分缺陷（a）+ SDK 修正后首暴露（b）；QA 修复 1 行 import 后 tsc 通过（EXIT=0）。 |
| D13，§2 全量单元测试 | 直接全量挂起→bisect 得真实计数：components 89(88/1/0)、services 704(640/50/14)、ipc 145(145/0/0)、stores 64(64/0/0)、shared 8(8/0/0)、e2e 43(41/2/0)；合计 1053(986/53/14)。失败归属：① better-sqlite3 原生模块在 vitest worker 无法加载（52 失败，环境）；② BackgroundAgentService.test.ts worker 收集阶段崩溃（14 未执行，环境）；③ DiffCard.test.tsx 1 失败（测试质量，断言歧义）；④ T1–T9 重点文件零失败。 |
| D13，§3 Playwright e2e | 2/2 失败（__dirname 未定义在 ESM 上下文，先于 electron.launch），非显示环境限制；分类（c）测试代码缺陷。 |
| D13，§4 智能路由总判定 | tsc i18n 5 错误→QA 自修；vitest 53+14→NoOne；e2e 2→NoOne；总判定 NoOne。 |
| D13，§5 遗留问题清单 | ① better-sqlite3 worker 加载失败（环境）；② BackgroundAgentService worker 崩溃（环境/运行器）；③ smoke.spec.ts __dirname（测试代码）；④ DiffCard 断言歧义（测试质量）；✅ i18n Lang 漏导入已修复。 |
| D13，§6 结论与建议 | 全量无新增回归；4 项遗留均非业务代码回归，建议独立技术债跟进。最终判定 NoOne。 |

### D14：docs/qa-report-testfix-2026-07-06.md

> 测试技术债修复回归验证 QA 报告 — 来源：QA 严过关，2026-07-06（验证 D13 遗留 4 项修复）

| 章节 | 内容摘要 |
| --- | --- |
| D14，§0 最终判定 | ①③④ 三项工程师修复经独立实跑全部确认有效（无需返工）；② 确认为真实产品 bug（非测试债），本轮不返工，另立产品 bug；遗留 2 项。 |
| D14，§1 复跑 ① better-sqlite3 | 66/66 PASS（memoryService 25 + sessionStore 25 + coreUserFlow 16）；工程师替换匹配 Node22 的预编译二进制 v12.11.1 + vitest.config 加 `server.deps.external:['better-sqlite3']` 有效。 |
| D14，§2 复跑 ④ DiffCard | 9/9 PASS（断言由 getByText 收紧为 getByRole('button',{name:/View Details/})）。 |
| D14，§3 复跑 ③ Playwright smoke | 不再报 __dirname，改为 `Process failed to launch!`（无显示环境，非代码回归）；工程师 ESM 修复有效。 |
| D14，§4 ② 独立复现无限循环 | `BackgroundAgentService.extractFilePathsFromOutput` 正则 `/([\w./\-]+\.tsx?)[\s(,:;]|$/gm` 因运算符优先级导致行尾零宽 `$` 匹配不推进 lastIndex → 真·无限循环；12/12 输入全部 LOOP，含空字符串；实跑 test 文件 80s 超时无输出佐证 worker 事件循环被阻塞。确认真实产品 bug（src/main/services/BackgroundAgentService.ts）。 |
| D14，§5 改动面核查 | 仅 test/、vitest.config.ts、预编译二进制被改；src/ 业务源码未改动（② 保持未修，符合「不改业务源码」约束）。 |
| D14，§6 智能路由判定 | ①③④ NoOne（无需返工）；② NoOne（本轮不返工，另立产品 bug）。 |
| D14，§7 遗留问题 | ① BackgroundAgentService 正则无限循环（真实产品 bug，建议改 `(?:[\s(,:;]|$)` 或 matchAll+循环保护）；② Playwright e2e 无显示环境失败。 |
| D14，§8 结论 | ①③④ 真绿、② 确认真实产品 bug、src 业务源码未被改动、遗留 2 项。 |

### D15：docs/architecture/adr-001-sdk-integration.md

> ADR-001：SDK 本地依赖策略 — 状态：接受（Accepted），2026-07-01

| 章节 | 内容摘要 |
| --- | --- |
| D15，上下文 | AELA 需集成 `@agentprimordia/sdk`（SDK 活跃迭代，API 频繁变）；决定引用方式。 |
| D15，决策 | 采用本地 `file:` 协议依赖：`"@agentprimordia/sdk": "file:../codecast/AgentPrimordia/sdk/typescript"`；优先级 `AELA_SDK_PATH` 环境变量 > 默认相对路径。 |
| D15，理由 | 优势（迭代即时生效、类型头对头、可改 SDK 验证）；风险（跨机器不可移植、breaking change 穿透、CI 需先构建 SDK dist）。 |
| D15，缓解措施 | 类型漂移检测（CI typecheck）、SDK Adapter 层（EvalSuite/ABTest/Batch）、环境变量覆盖。 |
| D15，未来演进 | SDK 稳定后发布 npm 包 `@agentprimordia/sdk@^1.0.0`，AELA 改 semver 依赖，Adapter 保留。 |

### D16：docs/architecture/adr-002-sandbox-tradeoff.md

> ADR-002：Sandbox 妥协决策 — 状态：接受（带拆分计划），2026-07-01

| 章节 | 内容摘要 |
| --- | --- |
| D16，上下文 | Electron 安全最佳实践要求 preload `sandbox:true`；AELA 当前配置 `sandbox:false`。 |
| D16，决策 | 当前（v0.1.x）保留 `sandbox:false`（原因：preload 用 fs/path/child_process，需 Node 能力）。 |
| D16，风险 | sandbox:false 下若渲染进程被 XSS 注入，攻击者可访问 Node.js API。 |
| D16，缓解措施 | CSP 已启用（生产收紧 'self'）；contextIsolation:true + nodeIntegration:false；外部链接系统浏览器隔离。 |
| D16，拆分计划（v0.2.0） | preload 拆两层：纯桥接层 `bridge.ts`（无 Node 依赖，可 sandbox:true）+ 能力层 `capabilities.ts`（需 Node，sandbox:false 隔离在独立进程）。 |

### D17：docs/architecture/adr-003-state-slice.md

> ADR-003：Zustand Slice 状态管理架构 — 状态：接受，2026-07-01

| 章节 | 内容摘要 |
| --- | --- |
| D17，上下文 | 渲染进程需跨组件共享状态（视图/主题/会话/配置/消息等）。 |
| D17，决策 | 采用 Zustand + Slice 模式（不用 Redux/Context API）。 |
| D17，Slice 清单 | 列出 6 个：viewStore、configStore、skillStore、automationStore、messagesStore、streaming.ts（注：表中未列 dialog，与 D1/D2 的 7 切片口径不同，见 §3 X5）。 |
| D17，关键决策 | ① streaming.ts 独立于 messagesStore（避免整 ChatView 重渲染）；② 单一 facade 兼容层 stores/app.ts（老 useAppStore 保留警告）；③ 状态订阅优化（容器组件改选择性订阅，P2）。 |
| D17，理由 | 相比 Redux 无 boilerplate、TS 友好、选择性订阅；相比 Context API 避免 Provider 嵌套。 |

### D18：docs/architecture/adr-004-ipc-misc-split.md

> ADR-004：IPC Misc 拆分决策 — 状态：接受（已执行），2026-07-01

| 章节 | 内容摘要 |
| --- | --- |
| D18，上下文 | `misc.ts` 膨胀至 964 行 / 154 个 ipcMain.handle 注册，承载 20+ 域，是 50%+ 通道的兜底文件。 |
| D18，决策 | 将 misc.ts 按 IPC 通道域拆分为 15 个独立 handler 文件（mcp/telemetry/debugger/terminal/preview/wiki/multifile/testgen/hookConfig/codeReview/subagent/screenshot/img2code/resilience/toolLearning）。 |
| D18，保留在 misc.ts | 约 60 个跨域/高频小通道（config/metrics/cost/context-window/prompt/planning/reflection/hitl/multimodal/adaptive/agent-config/builtin-tools/tool-cache/rag/anomaly/sdk:get-info 等）。 |
| D18，执行结果 | misc.ts 964→472 行（-51%），新增 15 文件，ipc/index.ts 加 15 register，全量 typecheck/lint/test 通过。 |

### D19：docs/architecture/adr-005-di-wire-dependencies.md

> ADR-005：AgentService 依赖注入重构 — 状态：接受（已执行），2026-07-01

| 章节 | 内容摘要 |
| --- | --- |
| D19，上下文 | index.ts 中 AgentService 创建后需注入 13 个协作服务（13 个 setXxx() 调用），启动顺序硬编码。 |
| D19，决策 | 新增统一 `wireDependencies(deps)` 方法，合并 13 个 setter 为 1 次调用。 |
| D19，重构前后对比 | 前：13 个 setXxx()；后：wireDependencies({memoryService, costTracker, contextWindow, hitlService, auditService, toolLearningService, promptService, hookConfigService, guardrailService, securityService, modelRouter})。 |
| D19，理由 | 单一职责、集中管理、向后兼容（保留 setter）、类型安全（编译期检查必填）。 |
| D19，未采用方案 | 纯构造器注入（影响测试 mock）、容器 resolve（同步不支持异步创建）。 |

### D20：docs/architecture/mcp-tool-scope.md

> MCP 工具调用范围限制说明 — 来源：docs/architecture/mcp-tool-scope.md（注释型文档）

| 章节 | 内容摘要 |
| --- | --- |
| D20，全文 | MCP 工具走 MCP 客户端 RPC（stdio/http），**不经过 SecurityService Sandbox**；调用链 Agent→ToolManager.execute()→MCPToolAdapter.execute()→mcpClient.callTool()；安全依赖：MCP 服务器由用户显式配置（信任源）、工具 scope 限定、stdio 模式工具执行在子进程/宿主不受渲染进程沙箱约束；与 shell 命令区别：shell 走 SecurityService+CommandGuard+HITL，MCP 工具无 ACL 检查（信任配置服务器）；风险：恶意 MCP 服务器可能返回恶意工具定义；缓解：仅允许用户显式添加的 MCP 服务器（非自动发现）。 |

### D21：docs/design/2026-07-05-background-agent.md

> 后台常驻 Agent 设计 — 状态：已确认，Phase P0，2026-07-05

| 章节 | 内容摘要 |
| --- | --- |
| D21，§1 设计理念 | Agent 应在后台持续监控、主动修复、通知确认（不等用户发现）。 |
| D21，§2 架构 | 核心组件：BackgroundAgentService（主进程，订阅事件/检测/触发修复/管理 diff）、FileWatcher（chokidar，排除 node_modules/.git/build/dist）、TerminalWatcher、DiagnosticWatcher（LSP）、MicroAgent（轻量循环 Agent，5s 超时/单文件修复/只读+受限写）、DiffStore（渲染）、DiffCard（UI）；安全机制：沙箱执行/超时（5s Agent、10s 全局）/范围限制（触发文件+1 关联）/预算（每小时 Token，复用 CostTracker）/撤销（CheckpointService）/用户确认（diffCard pending→accepted/rejected）。 |
| D21，§3 事件流 | 触发源（文件保存/Terminal 输出/Git 变更/LSP 诊断）；状态机（触发→检测→MicroAgent.run→修复成功 DiffCard(pending)/超时 Toast/不需要修复静默）；DiffCard pending→accepted（Checkpoint 应用）/rejected（回滚）。 |
| D21，§4 MicroAgent 设计 | 工具集（✅ read_file/list_files/search_codebase/edit_file 限触发+1 关联；❌ delete_file/execute_command/write_file/MCP）；约束（5s 超时/单文件/2000 tokens/小时 20 次）；修复协议（结构化 prompt）。 |
| D21，§5 文件结构 | BackgroundAgentService.ts / MicroAgent.ts / DiffCard.tsx / diffStore.ts + 测试。 |
| D21，§6 IPC 通道 | bg-agent:status（主→渲染）、bg-agent:diff（推送 pending）、bg-agent:accept（渲染→主）、bg-agent:reject（渲染→主）。 |
| D21，§7 实施计划 | Phase1 核心（2-3 天）、Phase2 DiffCard UI（1-2 天）、Phase3 触发源集成（1-2 天），总计 4-7 天。 |

### D22：docs/design/2026-07-05-context-aware-conversation.md

> 上下文感知智能对话设计 — 状态：已确认，2026-07-05

| 章节 | 内容摘要 |
| --- | --- |
| D22，§1 设计理念 | Agent 已看到问题，用户只需确认下一步（范式转变）。 |
| D22，§2 系统架构 | Renderer（Editor Context Bridge + Chat Interface）↔ Main（ContextCollector 新增 + AgentHookFactory 扩展 + SessionStore 扩展）经 IPC context:sync/context:change。 |
| D22，§3 上下文感知层 | §3.1 自动感知来源（Monaco 编辑器/终端面板/Git 状态/LSP 诊断/文件树）；§3.2 注入机制（轻量上下文每条消息携带 activeFile+terminalTail，重度上下文 change 触发 gitStatus+diagnostics+projectStructure）；§3.3 智能输入辅助（@filename/#error/#terminal/Ctrl+. 快速修复）；§3.4 实现模块（ContextCollector.ts/context.ts/SmartInput.tsx/ContextBar.tsx/contextStore.ts）。 |
| D22，§4 对话体验层 | §4.1 Agent 活动内嵌（ToolCallCard + ActivityTimeline）；§4.2 流式分块渲染（contentBlock[] 替代 string）；§4.3 消息虚拟化（>50 条启用 VirtualMessageList.tsx）；§4.4 对话控制（优雅中断/历史编辑/消息分支）。 |
| D22，§5 数据流设计 | §5.1 上下文同步流程；§5.2 Agent 活动事件流（agent:activity）；§5.3 ActivityEvent 类型（tool_start/tool_end/reasoning/context_update/agent_thought）。 |
| D22，§6 实施计划 | Phase1 流式渲染（1-2 天）、Phase2 Agent 内联活动（2-3 天）、Phase3 上下文感知（2-3 天）、Phase4 对话控制（1-2 天），约 6-10 天。 |
| D22，§7 成功指标 | 长响应渲染帧率 由低于 15fps 提升至 ≥30fps、操作可见性、上下文手动粘贴降 70%、中断恢复控制在 2s 内。 |
| D22，§8 风险与缓解 | ContextCollector 性能（增量+debounce）、contentBlock 兼容（渐进增强）、虚拟化复杂度（>50 启用）、IPC 事件过多（缓冲+rAF 合并）。 |

### D23：docs/plans/2026-07-05-background-agent.md

> 后台常驻 Agent 实施计划 — 来源：docs/plans/，task-by-task（subagent-driven-development）

| 章节 | 内容摘要 |
| --- | --- |
| D23，Goal/Architecture/Tech Stack | 目标：监听文件/终端/Git/LSP 变更→MicroAgent 单文件修复→Checkpoint→DiffCard 确认；技术栈 chokidar/Electron Notification/Zustand/TS。 |
| D23，Task 1 | MicroAgent 轻量修复 Agent（create MicroAgent.ts + test，TDD failing→pass，5s 超时/返回 diff/null）。 |
| D23，Task 2 | BackgroundAgentService 核心（订阅 TerminalService 输出→正则匹配→MicroAgent→checkpoint→push diff；注册到 ServiceBootstrap）。 |
| D23，Task 3 | DiffCard UI + IPC（DiffCard.tsx/diffStore.ts/bg-agent.ts + test）。 |
| D23，Task 4 | 触发源集成（FileWatcher/终端错误正则）。 |
| D23，Task 5 | 验收测试（手动验证保存含 TS 错误→DiffCard、超时 Toast、预算超限暂停、全量测试通过）。 |

### D24：docs/plans/2026-07-05-context-aware-conversation.md

> 上下文感知智能对话实施计划 — 来源：docs/plans/，task-by-task

| 章节 | 内容摘要 |
| --- | --- |
| D24，Goal/Architecture/Tech Stack | 目标：上下文感知对话+流式优化+活动内联+对话控制；三层叠加 ContextCollector→AgentHookFactory→Renderer；技术栈 Electron33/React18/Zustand/TS5.6/react-window。 |
| D24，文件结构 | 新增（ContextCollector.ts/ipc/context.ts/preload/api/context.ts/contextStore.ts/activityStore.ts/ToolCallCard.tsx/ActivityTimeline.tsx/SmartInput.tsx/ContextBar.tsx/VirtualMessageList.tsx）；修改（AgentHookFactory/AgentStreamProcessor/AgentService/streaming.ts/messagesStore/MessageBubble/ChatView/InputBox/stream.ts）。 |
| D24，Phase 1 流式渲染优化 | Task1 streamingStore 升级 contentBlock（types/stream.ts 加 ContentBlock/ActivityEvent，failing→pass）；Task2 MessageBubble 分块渲染（BlockRenderer + 旧消息兼容）。 |
| D24，Phase 2 Agent 活动内联 | Task3 ToolCallCard 组件（failing→pass）；Task4 activityStore + AgentHookFactory 扩展（beforeTool/afterTool 推 activity）。 |
| D24，Phase 3 上下文感知 | Task5 ContextCollector 服务（EditorContext/ContextBlock，IPC context:update/context:get）；Task6 SmartInput + ContextBar UI。 |
| D24，Phase 4 对话控制 | Task7 优雅中断（AbortController）；Task8 历史编辑+会话分支（messagesStore.editMessage/branchFrom）。 |
| D24，执行顺序总结 | Task1→2→3→4→5→6→7→8，每 Task 独立可验证可回滚。 |

### D25：docs/testing/coverage-plan.md

> 测试覆盖率提升计划 — 来源：docs/testing/，基线 2026-07-03

| 章节 | 内容摘要 |
| --- | --- |
| D25，当前基线（2026-07-03） | Statements 50.35% / Branches 34.91% / Functions 49.76% / Lines 51.51%；目标 60/50/60/60；阶段1（55/40/55/55）、阶段2（60/50/60/60）。 |
| D25，提升策略 | 阶段1 补齐无测试服务（OrchestrationService/RAGService/ResilienceService 等）；阶段2 渲染组件测试升级（SettingsView/AutomationView/CommandPalette 等）；CI 中 coverage 阈值逐步提高（每次 5%）。 |

---

## 3. 冲突记录

> 不同资料对同一事实描述矛盾时，**并列保留两个版本**，不做裁决。下游（research-analyst / business-architect 等）据此裁决。

| 编号 | 冲突主题 | 版本 A | 出处 A | 版本 B | 出处 B | 差异说明 |
| --- | --- | --- | --- | --- | --- | --- |
| X1 | IPC 通道总数 | ~200 个 | D1，§项目结构；D2，§3/§9；D3，§2/§4 | 325 个 | D9，§0.1/§1.2/§6.1 | 早期文档（设计/总览）记 ~200，评估报告（2026-07-06 静态审查）记 325；可能为口径（含/不含子系统通道）或期间增长，未裁决。 |
| X2 | IPC handler 文件数 | 26 个 | D1，§项目结构；D2，§3/§5.9；D3，§2/§4.4 | 37 个 | D9，§1.1/§1.2/§6.1 | 同上，早期文档记 26，评估报告记 37；ADR-004（D18）将 misc.ts 拆为 15 个文件，可能解释了数量增长，但未裁决具体口径。 |
| X3 | 主进程服务总数 | 40+ 个 | D1，§项目结构；D2，§3/§4/§5；D3，§2/§5 | ~53 个 | D9，§0.1/§1.2/§6.1 | 早期文档记 40+，评估报告记 ~53；增长可能与迭代新增服务有关，未裁决。 |
| X4 | 设置页标签页数 | 文字「共 27 个标签页」，但下文明列 13 配置 + 25 工具 = 38 | D4，§2（内部矛盾：文字 27 vs 所列 38） | 38 个 Tab（13 配置 + 25 工具） | D2，§7.5 | D4 文字「27」与自身所列 38 矛盾；D2 明确记 38；以 D2 的 38 为较完整口径，但 D4 文字 27 仍并列保留。 |
| X5 | Zustand slice/store 数量 | 7 个切片（viewStore/configStore/messagesStore/skillStore/streaming/automationStore/dialog） | D1，§项目结构；D2，§3/§7.3 | ADR-003 列 6 个（缺 dialog）；评估报告记 ~15 个 store | D17，Slice 清单；D9，§5.1 | 三处口径不一：D1/D2 记 7 切片，D17 表仅列 6（漏 dialog），D9 记 15 store（含 app/voice 等兼容/扩展 store）；未裁决。 |
| X6 | 渲染进程 sandbox 当前状态 | 当前（v0.1.x）保留 `sandbox:false` | D16，决策/上下文 | `WindowManager.ts` 设 `sandbox:true` | D9，§4.2/§11.1 | ADR-002 明确当前 sandbox:false（计划 v0.2.0 拆分后桥接层 sandbox:true）；评估报告 §4.2 却记 sandbox:true 已设；二者对「当前是否 sandbox:true」描述相反，未裁决（可能为版本演进或评估误读）。 |
| X7 | SDK 本地依赖路径 | `file:../codecast/AgentPrimordia/sdk/typescript` | D1，§SDK 依赖；D2，§1/§13；D3，§1.2；D5，§1；D15，决策 | 实际修正为 `file:../AgentPrimordia/sdk/typescript` | D13，§0（背景） | ADR-001/D1/D3/D5 文档统一记 `../codecast/AgentPrimordia/sdk/typescript`；但全量验证 QA（D13）披露上一轮 package.json 实际为 `file:../codecast/AgentPrimordia/...`（多一层 codecast 且缺 /sdk/typescript）导致 SDK 未链上，已修正为 `file:../AgentPrimordia/sdk/typescript`；文档与仓库实际路径不一致，未裁决。 |
| X8 | react-window 版本 | `^1.8.10`（devDependency） | D7，§1.1/§2 T7/§4 | `^1.8.11`（devDependency，实际加入） | D12，§三 T1 | 设计文档指定 ^1.8.10，QA 核查实际 package.json 加入 ^1.8.11（并冗余保留 @types/react-window）；版本小差异，未裁决。 |
| X9 | 多 Agent 编排模式数与集合 | 文字「支持 5 种编排模式」，协作模式列 Debate/Review/Consensus/Brainstorm | D4，§6（内部：文字 5 但内容远多于 5） | 「7 模式：Pipeline/Parallel/Handoff/Pool/GroupChat/Debate/Supervisor」 | D2，§5.9；D3，§3.7 | D4 文字「5 种」与其所述内容（4 基础 + 协作 4 + Supervisor + 动态）矛盾；D2/D3 记 7 模式且协作集合为 GroupChat/Debate/Supervisor，与 D4 的 Debate/Review/Consensus/Brainstorm 不一致；未裁决。 |
| X10 | promptContents 拆分口径 | 按 `agent`/`tool`/`system` 拆子模块 | D8，§4.2/§1.4 | 实际按「基础层 + 模式(coding/daily) × 变体」组织（13 常量：base + 6 coding + 6 daily） | D7，§0勘误/§3 T6/§4 | PRD（D8）文字建议 agent/tool/system；设计（D7）经核实更正为 base/coding/daily（与源码一致）；两文档口径冲突，D7 显式声明 D8 文字为误，但二者并列保留供下游确认。 |
| X11 | 测试覆盖率基线数值 | Statements 50.35% / Branches 34.91% / Functions 49.76% / Lines 51.51%（2026-07-03） | D25，当前基线 | Statements 51.02% / Branches 35.91% / Functions 50.84% / Lines 52.19%（2026-07-06） | D9，§5.2 | 同一项目的覆盖率基线在两文档中数字不同（日期相差 3 天，可能因修复/新增测试导致微升）；门禁一致为 45/30/45/45；未裁决。 |
| X12 | 缺 zod 校验的 handler 数量 | ~20/37（约 20 个缺校验） | D9，§2.2/§6.1 | 列 21 个 handler 文件补 schema（与「现有 17 个」对应应为 20） | D7，§1.3/§2 T5/§4 | 评估报告记 ~20 个缺校验（37-17=20）；设计文档列 21 个待补 handler 文件；数量差 1，未裁决（可能计数口径或文件归并差异）。 |

> 补充事实（非矛盾，但下游需注意）：D9「⚠️ 关键更正」指出任务简报称「Go 后端」，实际仓库无 Go 代码，为 Electron+TS 单体 + SDK；D14 确认 `BackgroundAgentService.extractFilePathsFromOutput` 存在真实产品 bug（正则无限循环），属独立于本轮修复的技术债，建议另立产品 bug。

---

## 4. 硬指标清单

| 章节 | 硬指标 | 状态 |
| --- | --- | --- |
| §1 | 每份资料有解析状态，失败/跳过注明原因 | ✅ |
| §2 | 每份文档按章节逐条摘要，每条标注了 `D编号，§章节` | ✅ |
| §3 | 冲突信息并列保留，不做裁决 | ✅ |
| §0/全文 | 覆盖模板全部核心章节（§0 元信息、§1 资料清单、§2 资料内容摘要、§3 冲突记录、§4 硬指标清单 + 附录A 生成流程 + 附录B 解析Skill） | ✅ |
| 全文 | 无占位符残留（尖括号占位符 / 示例类前缀 / 例类前缀 / 待填日期 / 待补充标记） | ✅ |
| §0 | 元信息完整（标题/版本/日期/整理人/审核人/原始资料清单） | ✅ |
| §2 | 引用溯源一致：每条摘要可定位到 原文件 + 章节（D编号↔原文件↔章节映射见回传引用定位汇总） | ✅ |
| 附录A | 生成流程（步骤总览 + 流程图 + 整理原则）完整 | ✅ |
| 附录B | 解析 Skill 列出（md/mermaid 对应解析方式） | ✅ |

---

## 附录 A：生成流程

### 流程总览

| 步骤 | 动作 | 落入章节 |
| --- | --- | --- |
| Step0 | 读取模板 + 全部原始资料（25 份 .md/.mermaid）+ 目录枚举 | — |
| Step1 | 盘点资料清单，标注解析状态 | §1 |
| Step2 | 逐份精读，按文档自身章节结构逐条摘要（D1–D25） | §2 |
| Step3 | 交叉比对不同资料，发现并记录矛盾（X1–X12） | §3 |
| Step4 | 逐项核验硬指标（9 项） | §4 |

```mermaid
flowchart LR
    S0[读取模板与资料] --> S1[盘点资料清单]
    S1 --> S2[逐份精读逐章节摘要]
    S2 --> S3[交叉比对记录冲突]
    S3 --> S4[硬指标自检]
```

### 整理原则

1. **逐份精读，不跨文档归并**：摘要按文档自身章节结构组织，不做跨文档的主题重组（那是下游的事）。
2. **出处即章节号**：每条摘要标注 `D编号，§章节`，直接映射回原文位置。
3. **冲突保留**：矛盾信息并列保留两个版本，不擅自裁决（X1–X12）。
4. **事实驱动**：以原始资料中的事实为准，不添加主观推断；上下文感知/后台 Agent 等设计文档仅作事实摘述，不做方案优劣判断。
5. **解析形态如实标注**：本批资料均为 Markdown（`md`）与 Mermaid（`mermaid`），如实标注类型，不套用 docx/pdf/pptx/xlsx 枚举。

---

## 附录 B：解析 Skill

- `md`：Markdown 文档（README / CODE_WIKI / SDK 集成架构 / USER_GUIDE / CONTRIBUTING / 各类报告 / ADR / design / plans / coverage-plan），使用 Read 工具直接精读，按 `##`/`###` 章节结构摘述。
- `mermaid`：Mermaid 图文件（class-diagram / sequence-diagram），使用 Read 工具读取，按图中节点/参与者/注释摘述其结构语义。
- 注：本模板默认枚举 `docx / pdf / pptx / xlsx` 适用于通用办公资料场景；本项目 Phase 1 上游原始资料实际形态为 `md` + `mermaid`，已按真实形态解析并标注。若后续阶段出现 Office/PDF 类资料，将对应启用 docx/pdf/pptx/xlsx 解析 Skill（pandoc / pypdf / markitdown / openpyxl 等）。
