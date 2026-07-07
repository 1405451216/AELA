# AELA Code Wiki

> AELA — Solo 模式 AI 编码助手桌面应用

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [整体架构](#4-整体架构)
5. [主进程模块 (src/main)](#5-主进程模块-srcmain)
6. [预加载层 (src/preload)](#6-预加载层-srcpreload)
7. [渲染进程模块 (src/renderer)](#7-渲染进程模块-srcrenderer)
8. [共享类型 (src/shared)](#8-共享类型-srcshared)
9. [IPC 通信协议](#9-ipc-通信协议)
10. [数据持久化](#10-数据持久化)
11. [安全机制](#11-安全机制)
12. [构建与运行](#12-构建与运行)
13. [依赖关系图](#13-依赖关系图)

---

## 1. 项目概述

AELA 是一款基于 Electron 的桌面端 AI 编码助手，采用 **Solo 模式**（单 Agent 自主执行），集成了 AgentPrimordia SDK 实现 ReAct Agent 编排。用户可以配置多种 LLM 模型、管理工作区、使用 Skills 技能系统，并通过 MCP 协议扩展工具能力。

**核心特性：**
- 多模型支持（OpenAI / Anthropic / Gemini / Ollama / DeepSeek / Qwen / GLM / Mistral / Cohere / Azure OpenAI，10+ 专用 Provider）
- ReAct Agent 流式对话与工具调用 + **AgentSelfTuner 自省调优** + **SpeculativeExecutor 投机执行** + **CachedProvider 请求缓存**
- **三层提示词系统**（共享基础层 + 模式专属层 + 变体层），支持 6 种行为变体
- **动态 Few-Shot 示例注入**，基于相似度/长度/随机选择器
- 工作区文件管理（文件树、代码搜索、文件读写）
- Skills 技能系统（Markdown 格式，支持注册为 Agent 工具，自动扫描 `.claude` / `.codex` / `.cursor` 等第三方目录）
- MCP 服务器管理（stdio / http 两种传输模式）
- Shell 命令安全确认机制（三级风险评估）
- 自动化任务系统（手动/定时/事件触发）
- **多 Agent 编排**（Pipeline / Parallel / Handoff / AgentPool + GroupChat / Debate / Supervisor）
- **DAG 调度 / 协作模式 / Supervisor / 动态拓扑**（均已接入 UI Tab，完整可交互）
- **可观测性体系**：运行时指标 / Trace 追踪 / OpenTelemetry 遥测 / 调试器 / AgentMonitor
- **记忆系统**：情景记忆（SQLite + FTS5 + HNSW 混合检索）/ 混合搜索 / 压缩摘要 / 重要性衰减 / **Phase 5 读写闭环**
- **安全体系**：沙箱 ACL / 安全护栏（输入/输出双向检查） / CommandGuard / InputSanitizer / 审计日志 / **Phase 5 执行链路接入**
- **成本追踪与预算管理**
- **上下文窗口管理**（trim / compress 策略 / **Phase 5 实际 token 测量 + 动态压缩**）
- **任务规划 / 自我反思 / 工具学习**
- **人机协作（HITL）**：工具确认中断点 / 预算超限中断
- **多模态支持**：图片 / 音频 / 视频 + **多模态融合** + **截图分析**
- **模型智能路由**：根据任务类型 + 输入复杂度生成模型建议
- **弹性组件**：CircuitBreaker 熔断器 + Retry 重试 + RateLimiter 限流 + BatchProcessor 批处理
- **推理引擎**：ReasoningEngine 独立推理（单轮同步 / 流式）
- **结构化提取**：StructuredExtractor LLM 驱动（情感分析 / 分类 / 摘要 / NER）
- **工具增强**：内置终端（多 Tab）+ 浏览器预览 + 多文件编辑 + 自动测试生成 + Repo Wiki
- **Agent 自适应学习**：用户画像 + 交互学习 + 规则提取
- **代码审查 / Sub-Agent 并行隔离 / 图片转代码**
- 深色/浅色主题切换（SVG Logo 透明背景，主题自适应）
- **国际化（i18n）**：中英文切换（共享翻译字典）

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Electron-Vite 2.3 + Vite 5 |
| 状态管理 | Zustand 4（7 个 slice） |
| UI 样式 | Tailwind CSS 3（CSS 变量主题切换） |
| Markdown 渲染 | react-markdown + remark-gfm + react-syntax-highlighter |
| 国际化 | 自研轻量 i18n（`useSyncExternalStore`），字典在 `src/shared/i18n.ts` 共享 |
| 数据持久化 | electron-store 10 + better-sqlite3（记忆 FTS5 + HNSW） |
| AI SDK | @agentprimordia/sdk（本地 SDK，120+ 模块） |
| 打包发布 | electron-builder 25 |
| 代码规范 | ESLint |
| DI 容器 | 自研 ServiceContainer（统一生命周期 + 依赖注入） |

---

## 3. 项目结构

```
AELA/
├── src/
│   ├── main/                          # Electron 主进程
│   │   ├── index.ts                   # 主进程入口：服务初始化、DI 容器注册、IPC 注册
│   │   ├── secretStore.ts             # API Key 加密 (Electron safeStorage)
│   │   ├── ipc/
│   │   │   ├── index.ts               # IPC 处理器注册入口（DI 容器路由）
│   │   │   └── handlers/              # 26 个 IPC 处理器文件（按功能域拆分）
│   │   ├── sdk/                       # SDK 适配器
│   │   │   ├── ABTestAdapter.ts       # A/B 测试适配器
│   │   │   ├── BatchAdapter.ts        # 批量请求适配器
│   │   │   └── EvalSuiteAdapter.ts    # 评估套件适配器
│   │   ├── services/                  # 40+ 服务
│   │   │   ├── ServiceContainer.ts    # DI 容器（统一生命周期 + 依赖注入）
│   │   │   ├── AgentService.ts        # 核心 Agent 编排（ReAct + Hook + 注入链）
│   │   │   ├── AgentHookFactory.ts    # Hook 工厂（创建 10 个 HookPoint + 安全检查）
│   │   │   ├── AgentConfigService.ts  # Agent 自定义配置管理
│   │   │   ├── ConfigStore.ts         # 应用配置持久化
│   │   │   ├── SessionStore.ts        # 会话与消息持久化
│   │   │   ├── WorkspaceManager.ts    # 工作区文件管理
│   │   │   ├── ToolManager.ts         # 工具管理（内置 + MCP + Skill + 缓存）
│   │   │   ├── ProviderManager.ts     # 多模型 Provider 管理
│   │   │   ├── SkillScanner.ts        # Skills 扫描与加载（含 ScanLog 诊断）
│   │   │   ├── AutomationStore.ts     # 自动化任务持久化
│   │   │   ├── PromptBuilder.ts       # 三层提示词构建器
│   │   │   ├── promptContents.ts      # 提示词变体内容定义（6 种变体）
│   │   │   ├── PromptService.ts       # 模板引擎 + Few-Shot 示例选择器
│   │   │   ├── FewShotRegistry.ts     # Few-Shot 示例注册表
│   │   │   ├── OrchestrationService.ts# 多 Agent 编排（7 模式）
│   │   │   ├── orchestration/         # 编排子模块
│   │   │   │   ├── GroupChatOrchestrator.ts
│   │   │   │   ├── StreamingPipelineOrchestrator.ts
│   │   │   │   ├── SupervisorOrchestrator.ts
│   │   │   │   ├── OrchestrationReplay.ts
│   │   │   │   └── OrchestrationTemplates.ts
│   │   │   ├── ObservabilityService.ts# 运行时指标与事件总线
│   │   │   ├── MemoryService.ts       # 情景记忆系统（混合搜索 + 压缩）
│   │   │   ├── SqliteMemoryStore.ts   # SQLite 底层存储（FTS5 + HNSW）
│   │   │   ├── SecurityService.ts     # 安全沙箱（ACL + 命令注入 + 路径穿越）
│   │   │   ├── GuardrailService.ts    # 安全护栏（输入/输出双向检查）
│   │   │   ├── ModelRouter.ts         # 模型智能路由
│   │   │   ├── RAGService.ts          # RAG 管道（文档切分 + 混合检索 + 重排序）
│   │   │   ├── ReasoningService.ts    # 独立推理引擎
│   │   │   ├── ResilienceService.ts   # 弹性执行（熔断 + 重试 + 限流 + 批处理）
│   │   │   ├── SDKEnhancementsService.ts # 12 项 SDK 增强能力封装
│   │   │   ├── CostTrackerService.ts  # 成本追踪与预算管理
│   │   │   ├── ContextWindowService.ts# 上下文窗口管理
│   │   │   ├── AuditService.ts        # 审计日志
│   │   │   ├── PlanningService.ts     # 任务规划
│   │   │   ├── ReflectionService.ts   # 自我反思
│   │   │   ├── ToolLearningService.ts # 工具学习
│   │   │   ├── HITLService.ts         # 人机协作
│   │   │   ├── MultimodalService.ts   # 多模态消息构建
│   │   │   ├── TerminalService.ts     # 内置终端（多 Tab + 命令历史）
│   │   │   ├── HookConfigService.ts   # 用户 Hooks 配置
│   │   │   ├── PreviewService.ts      # 浏览器预览窗口
│   │   │   ├── TestGenService.ts      # 自动测试生成
│   │   │   ├── RepoWikiService.ts     # 仓库 Wiki 生成
│   │   │   ├── CodeReviewService.ts   # 代码审查
│   │   │   ├── SubAgentIsolationService.ts # Sub-Agent 并行隔离
│   │   │   ├── ImageToCodeService.ts  # 图片转代码
│   │   │   ├── AdaptiveLearningService.ts  # Agent 自适应学习
│   │   │   ├── ScreenshotAnalysisService.ts # 截图分析
│   │   │   ├── DAGSchedulerService.ts # DAG 编排调度
│   │   │   ├── CollaborationService.ts# 多 Agent 协作
│   │   │   ├── SupervisorService.ts   # Supervisor 监督者
│   │   │   ├── DynamicDAGService.ts   # 动态拓扑 DAG
│   │   │   ├── DebuggerService.ts     # 调试器
│   │   │   ├── TelemetryService.ts    # OpenTelemetry 遥测
│   │   │   ├── sdkTypes.ts            # SDK 类型映射
│   │   │   └── tools/                 # 工具实现
│   │   │       ├── builtin/           # 内置工具（filesystem / shellAndSearch / dataLoaders）
│   │   │       ├── diff.ts            # 文件差异计算
│   │   │       ├── fileChangeTracker.ts # 文件变更追踪
│   │   │       ├── mathParser.ts      # 数学表达式解析
│   │   │       ├── pathSafety.ts      # 路径安全检查
│   │   │       └── shellRisk.ts       # Shell 命令风险评估
│   │   └── utils/                     # 工具函数
│   ├── preload/
│   │   └── index.ts                   # 预加载脚本（contextBridge API，~55 个 API 分组）
│   ├── renderer/                      # 渲染进程（React 应用）
│   │   ├── index.html                 # HTML 入口
│   │   └── src/
│   │       ├── main.tsx               # React 入口
│   │       ├── App.tsx                # 根组件（视图路由）
│   │       ├── i18n/
│   │       │   └── index.ts           # i18n 入口（Re-export shared/i18n.ts）
│   │       ├── stores/                # Zustand slice 架构（7 个切片）
│   │       │   ├── viewStore.ts       # 视图路由（30+ 视图类型）
│   │       │   ├── configStore.ts     # 配置 + 主题 + 语言 + 字体 + 会话 + 工作区 + 模型
│   │       │   ├── messagesStore.ts   # 消息列表 + 流式内容 + 流式事件
│   │       │   ├── skillStore.ts      # 技能管理 + 扫描日志
│   │       │   ├── streaming.ts       # 流式状态
│   │       │   ├── automationStore.ts # 自动化任务
│   │       │   ├── dialog.ts          # 对话框状态
│   │       │   ├── loadInitial.ts     # 初始化加载逻辑
│   │       │   └── index.ts           # Store 导出
│   │       ├── components/            # 30+ 视图组件
│   │       │   ├── ChatView.tsx       # 对话主视图
│   │       │   ├── InputBox.tsx       # 输入框组件
│   │       │   ├── Sidebar.tsx        # 侧边栏导航
│   │       │   ├── SettingsView.tsx   # 设置页（38 个 Tab：13 配置 + 25 工具）
│   │       │   ├── DashboardView.tsx  # 仪表盘
│   │       │   ├── SDKToolsView.tsx   # SDK 工具面板（Phase 5）
│   │       │   ├── ResilienceView.tsx # 弹性组件面板
│   │       │   ├── ModelConfigView.tsx# 模型配置页
│   │       │   ├── MCPManagerView.tsx # MCP 管理页
│   │       │   ├── WorkspaceView.tsx  # 工作区管理页
│   │       │   ├── SkillsView.tsx     # Skills 管理页
│   │       │   ├── AutomationView.tsx # 自动化任务页
│   │       │   ├── OrchestrationView.tsx  # 多 Agent 编排页
│   │       │   ├── RAGView.tsx        # RAG 管理页
│   │       │   ├── PlanningView.tsx   # 任务规划页
│   │       │   ├── TerminalEnhancedView.tsx # 增强终端
│   │       │   ├── HooksView.tsx      # 用户 Hooks 配置
│   │       │   ├── PreviewView.tsx    # 浏览器预览
│   │       │   ├── MultiFileEditor.tsx# 多文件编辑器
│   │       │   ├── TestGenView.tsx    # 测试生成
│   │       │   ├── WikiView.tsx       # 仓库 Wiki
│   │       │   ├── AgentConfigView.tsx# Agent 配置
│   │       │   ├── CodeReviewView.tsx # 代码审查
│   │       │   ├── SubAgentView.tsx   # Sub-Agent 管理
│   │       │   ├── ImageToCodeView.tsx# 图片转代码
│   │       │   ├── MemorySearchView.tsx # 记忆搜索
│   │       │   ├── ObservabilityDashboardView.tsx # 可观测性仪表盘
│   │       │   ├── FewShotWeightView.tsx  # Few-Shot 权重优化
│   │       │   ├── ToolLearningView.tsx   # 工具学习可视化
│   │       │   ├── SecurityPresetView.tsx # 安全策略模板
│   │       │   ├── SessionManagerView.tsx # 会话管理增强
│   │       │   ├── AdaptiveLearningView.tsx # 自适应学习
│   │       │   ├── ScreenshotAnalysisView.tsx # 截图分析
│   │       │   ├── OrchestrationTemplatesView.tsx # 编排模板
│   │       │   ├── DiffView.tsx       # 文件差异视图
│   │       │   ├── WorkbenchPanel.tsx # 工作台面板
│   │       │   ├── ErrorBoundary.tsx  # 错误边界
│   │       │   ├── Dialog.tsx         # 对话框组件
│   │       │   ├── settings/          # 设置页子组件（12 个 Tab 面板）
│   │       │   ├── orchestration/     # 编排子 Tab（5 个）
│   │       │   ├── chat/              # 聊天子组件（10+ 个）
│   │       │   └── shared/            # 共享组件
│   │       ├── assets/
│   │       │   ├── AelaLogo.tsx       # AELA Logo（内联 SVG，透明背景）
│   │       │   ├── AelaHeroLogo.tsx   # AELA Hero Logo（SVG + 发光动画）
│   │       │   └── modes/index.tsx    # 模式图标（内联 SVG）
│   │       ├── styles/index.css       # 全局样式（CSS 变量主题 + 动画）
│   │       ├── types/global.d.ts      # 全局类型声明
│   │       └── utils/index.ts         # 工具函数
│   └── shared/                        # 共享类型
│       ├── types.ts                   # Re-exports + AELA 特有类型（~100+ 类型）
│       ├── ipcChannels.ts             # IPC 通道常量（~200 通道）+ IPCResponse
│       ├── sdkTypes.ts                # SDK 相关类型定义
│       └── i18n.ts                    # 共享 i18n 字典（zh / en，~900 条）
├── electron.vite.config.ts            # Electron-Vite 构建配置
├── tsconfig.json                      # TypeScript 根配置
├── tsconfig.node.json                 # Node.js 端 TS 配置
├── tsconfig.web.json                  # Web 端 TS 配置
├── tailwind.config.js                 # Tailwind 配置（CSS 变量主题）
├── postcss.config.js                  # PostCSS 配置
├── package.json                       # 项目配置与依赖
└── release/                           # 构建输出目录
```

---

## 4. 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    渲染进程 (Renderer)                             │
│  ┌─────────┐  ┌──────────┐  ┌──────────────┐  ┌───────────┐      │
│  │ React UI │──│ Zustand  │──│window.aela   │  │  i18n     │      │
│  │ 30+ 视图 │  │ 7 切片   │  │API(contextBdg)│  │ useT()   │      │
│  └─────────┘  └──────────┘  └──────┬───────┘  └───────────┘      │
└─────────────────────────────────────┼────────────────────────────┘
                                      │ IPC (invoke/on)
┌─────────────────────────────────────┼────────────────────────────┐
│              预加载层 (Preload)      │                            │
│  contextBridge.exposeInMainWorld    │ ~55 API 分组                 │
└─────────────────────────────────────┼────────────────────────────┘
                                      │
┌─────────────────────────────────────┼────────────────────────────┐
│                  主进程 (Main)       │                            │
│  ┌──────────────────────────────────┴─────────────────────────┐  │
│  │       ServiceContainer DI 容器（40+ 服务统一管理）          │  │
│  │       startAll() / stopAll() + get<T>(token)               │  │
│  └──┬──────────────────────────────────────────────────────┬──┘  │
│     │  IPC 处理器（26 个 handler 文件，~200 通道）          │      │
│     ▼                                                      │      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │      │
│  │Agent     │  │Orchest.  │  │Memory    │  │Security  │   │      │
│  │Service   │  │Service   │  │Service   │  │+Guardrail│   │      │
│  │(Hook     │  │(7 模式)  │  │(SQLite + │  │(ACL+注入 │   │      │
│  │ Factory) │  │          │  │ FTS5+HNSW│  │ 防护)    │   │      │
│  │+注入链   │  │          │  │ +衰减)   │  │          │   │      │
│  └──┬───────┘  └──────────┘  └──────────┘  └──────────┘   │      │
│     │                                                    │      │
│  ┌──▼──────────┐  ┌──────────────────────────────────┐   │      │
│  │PromptBuilder│  │ @agentprimordia/sdk v1.0.0       │   │      │
│  │+PromptSvc   │  │ ReActAgent / Provider / Tool     │   │      │
│  │+Few-Shot    │  │ HookManager / Lifecycle          │   │      │
│  │+ModelRouter │  │ RAGStore / Memory / HNSW         │   │      │
│  └─────────────┘  │ Orchestration / DAG / GroupChat  │   │      │
│                    │ Security / CommandGuard / Sanitizer│ │      │
│  ┌─────────┐ ┌─────┴───┐ ┌──────────┐ ┌──────────┐  │   │      │
│  │RAG      │ │Reasoning│ │Resilience│ │SDK       │  │   │      │
│  │Service  │ │Service  │ │Service   │ │Enhance   │  │   │      │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘  │   │      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │      │
│  │Cost     │ │Context  │ │Planning  │ │Reflection│  │   │      │
│  │Tracker  │ │Window   │ │Service   │ │Service   │  │   │      │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘  │   │      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │      │
│  │HITL     │ │Multimod.│ │Terminal  │ │HookConfig│  │   │      │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘  │   │      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │      │
│  │Preview  │ │TestGen  │ │Wiki      │ |CodeReview|  │   │      │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘  │   │      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │      │
│  │SubAgent │ |Img2Code | |Adaptive  │ |Screenshot|  │   │      │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘  │   │      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │      │
│  │DAG      │ │Collab.  │ |Supervisor| |DynamicDAG|  │   │      │
│  └─────────┘ └─────────┘ └──────────┘ └──────────┘  │   │      │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐               │   │      │
│  |Audit    │ |ToolLearn│ |Observab. |               │   │      │
│  └─────────┘ └─────────┘ └──────────┘               │   │      │
│                    └──────────────────────────────┘   │      │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. 主进程模块 (src/main)

### 5.1 入口文件 — `index.ts`

**职责：** Electron 应用生命周期管理、服务初始化、DI 容器注册、窗口创建。

**关键流程：**
1. 获取单实例锁（`requestSingleInstanceLock`），确保只有一个应用实例运行
2. `app.whenReady()` 后依次初始化所有服务（共 40+ 个服务实例）
3. 将高级服务注入 `AgentService`（通过 `wireComponents()` 一次性注入 Memory / CostTracker / ContextWindow / HITL / Audit / ToolLearning / PromptService / HookConfig / Guardrail / Security / ModelRouter）
4. 注册所有服务到 `ServiceContainer` DI 容器
5. 注册 IPC 处理器（传入容器，各 handler 通过 `container.get<T>()` 获取服务）
6. 设置 Shell 命令确认回调（将确认请求转为原生 `dialog` 弹窗）
7. 创建 `BrowserWindow` 并加载 UI
8. `before-quit` 时调用 `container.stopAll()` 统一清理

**服务初始化顺序：**
```
基础服务: ConfigStore → SessionStore → WorkspaceManager → AutomationStore
可观测层: ObservabilityService → MemoryService → SecurityService → GuardrailService
Agent层:  AgentService (注入 Memory) → CostTracker → ContextWindow → Audit
          → Planning → Reflection → ToolLearning → HITL → Multimodal → PromptService
          → HookConfig → wireComponents (注入全部到 AgentService)
编排层:   OrchestrationService → DAGScheduler → Collaboration → Supervisor → DynamicDAG
数据层:   RAGService → TelemetryService → DebuggerService
工具层:   TerminalService → PreviewService → TestGenService → RepoWikiService
高级层:   AgentConfigService → ModelRouter → CodeReviewService → SubAgentIsolationService
          → ImageToCodeService → AdaptiveLearningService → ScreenshotAnalysisService
          → ResilienceService
SDK层:    SDKEnhancementsService → ReasoningService
```

### 5.2 ServiceContainer — `services/ServiceContainer.ts`

**职责：** 统一服务生命周期管理 + 依赖注入容器。

**核心功能：**
- `register<T>(token, instance)` — 注册服务实例
- `registerFactory<T>(token, factory)` — 注册懒创建工厂
- `get<T>(token)` — 同步获取服务
- `resolve<T>(token)` — 异步获取服务（支持异步工厂）
- `startAll()` — 按注册顺序启动所有服务
- `stopAll()` — 逆序停止所有服务
- `SERVICE_TOKENS` — 40+ 服务标识常量集中定义

**设计优势：** 消除了 37+ 参数传递问题，统一了 `stop()` 方法命名，管理了服务间依赖关系。

### 5.3 AgentService — `services/AgentService.ts`

**职责：** 核心编排层，整合 Provider + Tool + Session + Prompt + Observability + Memory + Cost + Audit + HITL + ToolLearning + Guardrail + Security + ModelRouter + ContextWindow，提供 ReAct Agent 流式运行能力。

**核心方法：**

| 方法 | 说明 |
|------|------|
| `runStream(params)` | 异步生成器，产出 `StreamEvent` 流式事件 |
| `stop(sessionId)` | 停止指定会话的 Agent |
| `pause(sessionId)` | 暂停 Agent |
| `resume(sessionId)` | 恢复 Agent |
| `getStatus(sessionId)` | 获取 Agent 运行状态 |
| `testModel(config)` | 测试模型连接 |
| `wireComponents(deps)` | 一次性注入所有高级服务依赖 |
| `setMemoryService(ms)` | 注入记忆服务 |
| `setGuardrailService(gs)` | 注入安全护栏（通过 AgentHookFactory） |
| `setSecurityService(ss)` | 注入安全沙箱（通过 AgentHookFactory） |
| `setModelRouter(mr)` | 注入模型路由器 |
| `invalidateProvider(modelId)` | 清除 Provider 缓存 |
| `close()` | 关闭所有活跃 Agent |

**`runStream` 执行流程（Phase 5 增强）：**
1. 获取模型配置 → 创建 Provider
2. 加载会话已激活的 Skills：`asTool: true` 的注册为工具，其余拼接到 system prompt
3. 读取 `AGENTS.md` / `CLAUDE.md` 上下文文件（如果配置启用）
4. 获取 MCP 工具列表
5. **使用 `PromptBuilder.build()` 构建三层系统提示词**（共享基础层 + 模式专属层 + 变体层 + 动态上下文注入）
6. **使用 `PromptService.renderFewShot()` 动态追加 Few-Shot 示例**（基于相似度选择最相关示例）
7. **[Phase 5] 通过 `MemoryService.hybridSearchScored()` 检索 Top-5 相关记忆，注入系统提示词**
8. 创建 `HookManager`（通过 `AgentHookFactory` 注册 10 个 HookPoint）+ `Lifecycle` + `ReActAgent`
9. 保存用户消息到 MemoryService
10. 调用 `agent.streamEvents(input)` 获取流式事件
11. 收集 token / tool_call / tool_result，保存到 SessionStore
12. `finally` 块中清理临时注册的 Skill 工具

**Hook 系统（10 个 HookPoint，由 AgentHookFactory 创建）：**

| Hook | 功能 |
|------|------|
| `before_run` | 发布 `agent.start` 事件，增加活跃 Agent 计数 |
| `after_run` | 发布 `agent.stop` 事件，减少活跃 Agent 计数 |
| `before_turn` | 发布 `turn.start` 事件 |
| `after_turn` | 发布 `turn.end` 事件，记录轮次 |
| `before_llm` | 记录 LLM 调用开始时间 + **[Phase 5] GuardrailService 输入检查**（reject 阻断 / sanitize 替换） |
| `after_llm` | 记录 LLM 延迟 + **成本追踪** + **[Phase 5] GuardrailService 输出检查** + **[Phase 5] ContextWindow token 测量** + **[Phase 5] ModelRouter 模型建议** |
| `before_tool` | 发布事件 + **审计日志** + **HITL 中断检查** + **[Phase 5] SecurityService 命令注入防护 + 路径穿越检测 + ACL 权限检查** |
| `after_tool` | 记录工具延迟 + 审计日志 + **工具学习**（记录成功/失败经验） |
| `on_error` | 发布 `agent.error` 事件 |
| `on_complete` | 发布事件 + **自动保存情景记忆** |

**Few-Shot 示例库：**
- `aela.code`：编程模式（5 个示例，相似度选择，最多 3 个）
- `aela.daily`：日常模式（5 个示例，相似度选择，最多 2 个）

### 5.4 AgentHookFactory — `services/AgentHookFactory.ts`

**职责：** 工厂类，专门负责创建 Agent 的 10 个 HookPoint。

**依赖注入：** 接收 GuardrailService / SecurityService / CostTrackerService / ContextWindowService / ModelRouter / AuditService / HITLService / ToolLearningService / MemoryService / ObservabilityService 等服务，在对应 Hook 点执行检查和记录。

### 5.5 PromptBuilder — `services/PromptBuilder.ts`

**职责：** 三层提示词构建器，参考 CodeCast `prompt_builder.go` 架构。

**三层结构：**
1. **共享基础层**（`promptBase`）：角色定义、安全边界、沟通规范
2. **模式专属层**（`promptCodingDefault` / `promptDailyDefault`）：编程模式 vs 日常模式
3. **变体层**（6 种变体）：不同行为风格

**6 种提示词变体：**

| 变体 | 说明 |
|------|------|
| `default` | 平衡版本：完整工具指南 + 质量标准 + 自检 + No TODO |
| `concise` | 极简版本：节省 token，适合小模型或长任务 |
| `safety-first` | 安全优先：强制验证步骤 + 保守变更 + 风险评估 |
| `code-reviewer` | 代码审查：分级问题反馈（Blocker/Major/Minor）+ 修复建议 |
| `pair-programmer` | 结对编程：边做边讲 + 小步推进 + 关键决策征求意见 |
| `mentor-coach` | 导师教练：因材施教 + 建设性反馈 + 教学优先 |

**动态上下文注入：**
- 项目信息（路径、模式、变体名称）
- 自定义指令 + 自定义规则
- 技能提示
- 全局记忆
- **[Phase 5] MemoryService 检索的 Top-5 相关记忆**
- 项目上下文（AGENTS.md / CLAUDE.md）
- 工具目录（内置工具 + MCP 工具，按类别分组）

### 5.6 PromptService — `services/PromptService.ts`

**职责：** 提示词模板管理服务，提供变量注入模板 / 命名模板注册表 / Few-Shot 示例选择器。

**核心组件：**

| 组件 | 说明 |
|------|------|
| `TemplateEngine` | 模板引擎，支持 `{{.key}}` 变量注入、`{{if .key}}` 条件块、`{{range .key}}` 循环 |
| `FewShotTemplate` | Few-Shot 模板，支持示例选择器 + 最大示例数限制 |
| `ExampleSelector` | 示例选择器接口（3 种实现：`SimilaritySelector` / `LengthBasedSelector` / `RandomSelector`） |

### 5.7 ProviderManager — `services/ProviderManager.ts`

**职责：** 根据 `ModelConfig` 创建对应的 LLM Provider 实例，带缓存。

**支持的 Provider 类型：**
- `openai` / `custom` → `OpenAIProvider`（兼容 DeepSeek / Qwen / GLM 等）
- `anthropic` → `AnthropicProvider`
- `ollama` → `OllamaProvider`
- `gemini` → `GeminiProvider`

### 5.8 ToolManager — `services/ToolManager.ts`

**职责：** 管理所有 Agent 可用工具，包括内置工具、MCP 工具和 Skill 工具。

**内置工具：**

| 工具名 | 类 | 功能 |
|--------|-----|------|
| `read_file` | `ReadFileTool` | 读取文件内容 |
| `write_file` | `WriteFileTool` | 写入文件 |
| `list_directory` | `ListDirectoryTool` | 列出目录内容 |
| `execute_command` | `ShellTool` | 执行 Shell 命令（含安全确认） |
| `search_code` | `CodeSearchTool` | 代码搜索（正则 + 扩展名过滤） |
| `get_project_structure` | `ProjectStructureTool` | 获取项目目录树 |
| `http_fetch` | `HttpFetchTool` | HTTP/HTTPS 请求 |
| `load_csv` | `LoadCSVTool` | 加载 CSV 文件 |
| `load_json` | `LoadJSONTool` | 加载 JSON 文件 |
| `load_markdown` | `LoadMarkdownTool` | 加载 Markdown 文件 |
| `calculator` | `CalculatorTool` | 数学计算 |
| `datetime` | `DatetimeTool` | 获取当前日期时间 |

**MCP 工具适配：** `MCPToolAdapter` 将 MCP 服务器的工具包装为 SDK `Tool` 接口，工具名前缀 `mcp_`。

**Skill 工具适配：** `SkillToolAdapter` 将 `asTool: true` 的 Skill 注册为工具，工具名前缀 `skill_`。

**工具缓存：** 支持工具调用结果缓存，提供 `getCacheStats()` / `clearCache()`。

**内置工具开关：** 支持 `listBuiltinTools()` / `toggleBuiltinTool(name, enabled)` 动态启停。

### 5.9 其他核心服务

| 服务 | 职责 |
|------|------|
| `ConfigStore` | 应用配置持久化（electron-store） |
| `SessionStore` | 会话和消息持久化 |
| `WorkspaceManager` | 工作区文件管理（文件树、搜索） |
| `SkillScanner` | Skills 扫描与加载（含 ScanLog 诊断） |
| `AutomationStore` | 自动化任务持久化 |
| `ObservabilityService` | 运行时指标采集与事件总线 |
| `MemoryService` | 情景记忆（SQLite + FTS5 + HNSW + 压缩 + 衰减） |
| `SqliteMemoryStore` | SQLite 底层存储（FTS5 全文 + HNSW 向量索引） |
| `SecurityService` | 安全沙箱（ACL + 命令注入防护 + 路径穿越检测） |
| `GuardrailService` | 安全护栏（输入/输出双向检查：注入检测 / PII / 话题 / 关键词） |
| `ModelRouter` | 模型智能路由（根据任务类型 + 输入复杂度生成模型建议） |
| `RAGService` | RAG 管道（RAGStore + RAGReranker + MMRReranker + 文档加载） |
| `ReasoningService` | 独立推理引擎（ReasoningEngine，单轮同步/流式） |
| `ResilienceService` | 弹性执行（CircuitBreaker + Retry + RateLimiter + BatchProcessor） |
| `SDKEnhancementsService` | 12 项 SDK 增强能力封装 |
| `OrchestrationService` | 多 Agent 编排（7 模式：Pipeline / Parallel / Handoff / Pool / GroupChat / Debate / Supervisor） |
| `DAGSchedulerService` | DAG 编排调度（拓扑排序 + 并发 + Fail-Fast） |
| `CollaborationService` | 多 Agent 协作（debate/review/consensus/brainstorm） |
| `SupervisorService` | Supervisor 监督者（Worker 池 + 轮询/负载均衡/技能匹配） |
| `DynamicDAGService` | 动态拓扑 DAG（条件路由边） |
| `CostTrackerService` | 成本追踪与预算管理 |
| `ContextWindowService` | 上下文窗口管理（trim / compress） |
| `AuditService` | 审计日志（`logs/audit.jsonl`） |
| `PlanningService` | 任务规划（LLM 驱动的任务分解） |
| `ReflectionService` | 自我反思（反思/批评/改进） |
| `ToolLearningService` | 工具学习（成功/失败经验 + 最佳实践） |
| `HITLService` | 人机协作（中断点 + 自动批准） |
| `MultimodalService` | 多模态消息构建（图片/音频/视频） |
| `TerminalService` | 内置终端（多 Tab + 命令历史） |
| `HookConfigService` | 用户 Hooks 配置（10 个生命周期 Hook 点） |
| `PreviewService` | 浏览器预览窗口 |
| `TestGenService` | 自动测试生成 |
| `RepoWikiService` | 仓库 Wiki 生成 |
| `CodeReviewService` | LLM 驱动的代码审查 |
| `SubAgentIsolationService` | Sub-Agent 并行隔离执行 |
| `ImageToCodeService` | 图片转代码工作流 |
| `AdaptiveLearningService` | Agent 自适应学习（用户画像 + 规则提取） |
| `ScreenshotAnalysisService` | 截图分析 |
| `DebuggerService` | 调试器（Trace Span 追踪 + Node Inspector） |
| `TelemetryService` | OpenTelemetry 遥测导出 |

---

## 6. 预加载层 (src/preload)

**文件：** `src/preload/index.ts`

**职责：** 通过 `contextBridge.exposeInMainWorld('aela', api)` 安全地向渲染进程暴露 IPC API。

**暴露的 API 分组（~55 个）：**

| 分组 | 主要方法 |
|------|----------|
| `model` | `list`, `add`, `update`, `delete`, `setDefault`, `test` |
| `workspace` | `list`, `add`, `remove`, `open`, `readFile`, `fileTree`, `search` |
| `session` | `list`, `create`, `delete`, `getMessages`, `update`, `setActiveSkills`, `search`, `export`, `contextInfo` |
| `agent` | `runStream`, `stop`, `pause`, `resume`, `status`, `onStreamEvent` |
| `mcp` | `list`, `add`, `update`, `delete`, `connect`, `disconnect`, `status` |
| `mcpResource` | `list`, `read` |
| `shell` | `confirmCommand`, `execute` |
| `skill` | `list`（含 scanLog）, `reload`（含 scanLog）, `get`, `delete`, `import`, `scanPaths` |
| `automation` | `list`, `get`, `create`, `update`, `delete`, `run`, `runs`, `toggle` |
| `config` | `get`, `set` |
| `orchestration` | `run`, `stop`, `onEvent` |
| `orchestrationExt` | `templatesList`, `templatesGet`, `runsList`, `runsGet`, `performance` |
| `dag` | `run`, `stop`, `onEvent` |
| `collaboration` | `run`, `stop`, `onEvent` |
| `dynamicDag` | `run`, `stop`, `onEvent` |
| `supervisor` | `addWorker`, `removeWorker`, `submitTask`, `stats`, `listWorkers`, `setStrategy` |
| `metrics` | `snapshot`, `reset`, `trend` |
| `observability` | `costAnalysis`, `anomalyList`, `anomalyAcknowledge` |
| `memory` | `search`, `list`, `add`, `delete`, `stats` |
| `memoryCompress` | `compress` |
| `memoryFTS` | `search`, `stats`, `rebuild` |
| `security` | `getConfig`, `setConfig`, `checkAccess`, `checkShellMeta`, `checkPathTraversal`, `resolvePathSafe`, `sanitizeInput`, `checkCommandGuard` |
| `guardrail` | `check`, `getRules`, `setRules` |
| `rag` | `ingest`, `search`, `clear`, `stats`, `setConfigEx`, `getConfigEx`, `storeStats`, `fusionConfig` |
| `telemetry` | `configure`, `export`, `spans`, `status`, `getConfig` |
| `debugger` | `status`, `traces`, `sessionTrace`, `clear`, `startInspector`, `stopInspector` |
| `builtinTools` | `list`, `toggle` |
| `toolCache` | `stats`, `clear` |
| `cost` | `summary`, `records`, `reset`, `setBudget`, `getBudget`, `setPricing`, `listPricing` |
| `contextWindow` | `getConfig`, `setConfig`, `trim`, `compress` |
| `audit` | `log`, `query`, `report`, `getConfig`, `setConfig`, `clear`, `count` |
| `prompt` | `render`, `list`, `register`, `delete`, `renderMessage`, `setMessageTemplate`, `fewshotRender`, `fewshotAddExample`, `fewshotGetExamples`, `variantsList`, `fewshotAddWeighted`, `fewshotFeedback`, `fewshotListWeighted`, `fewshotSetWeightConfig` |
| `planning` | `decompose`, `generatePlan` |
| `reflection` | `reflect`, `critique`, `improve`, `reflectAndImprove` |
| `toolLearning` | `recordSuccess`, `recordFailure`, `bestPractices`, `suggest`, `stats`, `records` |
| `toolLearningExt` | `visualization`, `failureModes`, `clear` |
| `hitl` | `getConfig`, `setConfig`, `getPending`, `resume`, `addInterruptPoint`, `removeInterruptPoint`, `addAutoApprove`, `removeAutoApprove` |
| `multimodal` | `fromFile`, `createImageURL`, `createImageB64`, `createAudio`, `createVideo`, `toLLMContent`, `supportedMime` |
| `fileChange` | `list`, `get`, `clear`, `accept`, `reject` |
| `terminal` | `create`, `destroy`, `input`, `resize`, `list`, `listTabs`, `commandHistory`, `runCommand` |
| `hookConfig` | `list`, `add`, `update`, `delete`, `toggle`, `test`, `export`, `import` |
| `preview` | `open`, `close`, `navigate`, `reload`, `goBack`, `goForward`, `getUrl`, `devtools`, `updateBounds` |
| `multiFile` | `read`, `writeBatch`, `listChanges` |
| `testGen` | `generate`, `analyze`, `run` |
| `wiki` | `generate`, `get`, `list`, `delete` |
| `agentConfig` | `list`, `add`, `update`, `delete`, `get` |
| `modelRoute` | `suggest`, `config` |
| `codeReview` | `review`, `get`, `list` |
| `subAgent` | `run`, `stop`, `status`, `listPresets` |
| `img2code` | `analyze`, `generate`, `refine`, `getResult`, `listFrameworks` |
| `sdkEnhancements` | 12 项 SDK 增强能力 IPC + `getInfo` |
| `resilience` | `getConfig`, `setConfig`, `getStats`, `resetBreaker` |
| `reasoning` | `reason`, `reasonStream`, `quickReason` |
| `fewShotWeight` | Few-Shot 权重管理 |
| `adaptiveLearning` | `getProfile`, `getHints`, `getProgress`, `recordInteraction`, `extractRules`, `clearProfile` |
| `screenshotAnalysis` | `analyze`, `getResult`, `listResults` |

**类型安全辅助：** 封装了 `invoke<T>()` 函数，自动解包 `IPCResponse<T>` 并在失败时抛出异常。

---

## 7. 渲染进程模块 (src/renderer)

### 7.1 入口与根组件

- **`main.tsx`** — React 应用入口，挂载 `<App />` 到 DOM
- **`App.tsx`** — 根组件，根据 `currentView` 状态切换视图（30+ 视图类型）

**视图列表（30+）：**

| 视图 | 组件 | 说明 |
|------|------|------|
| `chat` | `ChatView` | 对话主界面 |
| `models` | `ModelConfigView` | 模型配置管理 |
| `mcp` | `MCPManagerView` | MCP 服务器管理 |
| `settings` | `SettingsView` | 应用设置（38 个 Tab） |
| `workspaces` | `WorkspaceView` | 工作区管理 |
| `skills` | `SkillsView` | Skills 技能管理 |
| `automation` | `AutomationView` | 自动化任务管理 |
| `orchestration` | `OrchestrationView` | 多 Agent 编排 |
| `dashboard` | `DashboardView` | 仪表盘 |
| `rag` | `RAGView` | RAG 管理 |
| `planning` | `PlanningView` | 任务规划 |
| `terminal` | `TerminalEnhancedView` | 增强终端 |
| `hooks` | `HooksView` | 用户 Hooks 配置 |
| `preview` | `PreviewView` | 浏览器预览 |
| `multifile` | `MultiFileEditor` | 多文件编辑 |
| `testgen` | `TestGenView` | 测试生成 |
| `wiki` | `WikiView` | 仓库 Wiki |
| `agentconfig` | `AgentConfigView` | Agent 配置 |
| `codereview` | `CodeReviewView` | 代码审查 |
| `subagent` | `SubAgentView` | Sub-Agent 管理 |
| `img2code` | `ImageToCodeView` | 图片转代码 |
| `memorySearch` | `MemorySearchView` | 记忆搜索 |
| `orchTemplates` | `OrchestrationTemplatesView` | 编排模板 |
| `observability` | `ObservabilityDashboardView` | 可观测性仪表盘 |
| `fewShotWeight` | `FewShotWeightView` | Few-Shot 权重优化 |
| `toolLearning` | `ToolLearningView` | 工具学习可视化 |
| `securityPreset` | `SecurityPresetView` | 安全策略模板 |
| `sessionManager` | `SessionManagerView` | 会话管理增强 |
| `adaptiveLearning` | `AdaptiveLearningView` | 自适应学习 |
| `screenshotAnalysis` | `ScreenshotAnalysisView` | 截图分析 |
| `resilience` | `ResilienceView` | 弹性组件面板 |
| `sdkTools` | `SDKToolsView` | SDK 工具面板 |

### 7.2 国际化 — `i18n/`

**技术：** 基于 `useSyncExternalStore` 的轻量 i18n 系统，翻译字典在 `src/shared/i18n.ts` 中定义（~900 条 zh/en 翻译）。

**核心 API：**
- `useT()` — React Hook，返回 `translate` 函数，语言切换时自动重渲染
- `setLang(lang)` — 切换语言（`zh` / `en`）
- `t` — 非 Hook 版本的翻译函数（用于组件外部）

**翻译覆盖范围：** Sidebar、ChatView、InputBox、SettingsView（全部 38 个 Tab）、SkillsView、MessageBubble、通用按钮等。

### 7.3 状态管理 — Zustand Slice 架构

**技术：** Zustand（`create` 模式），拆分为 7 个独立 slice：

| Slice | 文件 | 核心状态 |
|-------|------|----------|
| **viewStore** | `viewStore.ts` | `currentView`（30+ 视图类型）、`error`、`loading` |
| **configStore** | `configStore.ts` | `appConfig`、`theme`、`language`、`fontSize`、`currentSession`、`currentWorkspace`、`currentModelConfig`、`modelList`、`permissionLevel` |
| **messagesStore** | `messagesStore.ts` | `messages`、`isStreaming`、`streamingContent`、`streamEvents` |
| **skillStore** | `skillStore.ts` | `skills`、`skillScanPaths`、`skillScanLog` |
| **streaming** | `streaming.ts` | 流式状态管理 |
| **automationStore** | `automationStore.ts` | `automations` |
| **dialog** | `dialog.ts` | 对话框状态 |

**即时应用：**
- `setLanguage(lang)` — 立即调用 `setLang()` 更新 i18n + 持久化
- `setFontSize(size)` — 立即设置 `document.documentElement.style.fontSize` + 持久化
- `setTheme(theme)` — 立即添加 CSS class + 持久化
- `toggleTheme()` — 切换主题 + 持久化

**初始化流程（`loadInitial.ts`）：**
1. 加载应用配置 → 应用主题、语言、字体大小
2. 加载模型列表 → 设置默认模型
3. 加载 Skills 列表（含 scanLog）
4. 加载自动化任务列表

### 7.4 ChatView — 对话主视图

**核心功能：**
- 消息展示（用户/助手/工具消息）
- 流式输出（实时显示 token、工具调用状态）
- 模式选择（Code / Office，影响 system prompt）
- Skill 激活（`/skill` 语法快速激活）
- 工作区选择
- 模型切换
- **系统提示词构建委托后端**（`PromptBuilder.build()` + **[Phase 5] Memory 记忆注入**）
- **从 `sessionStorage` 读取自动化试运行 prompt**
- AELA Hero Logo（内联 SVG，透明背景 + 发光动画）

### 7.5 SettingsView — 设置页

**38 个 Tab 结构（分配置类和工具类）：**

**配置类（13 个 Tab）：**

| Tab | 说明 |
|-----|------|
| 系统设置 | 主题、语言、字体大小、sendOnEnter、提示词变体选择、默认提示词、maxTurns/maxMessages |
| 模型 | 模型 CRUD + 连接测试 |
| MCP | MCP 服务器管理 |
| 命令 | 自定义斜杠命令 |
| 规则与记忆 | 全局记忆、自定义规则、上下文文件（AGENTS.md / CLAUDE.md） |
| 成本与预算 | 成本摘要、预算设置、模型定价 |
| 上下文管理 | 上下文窗口配置（trim/compress 策略） |
| 人机协作 | HITL 中断点配置、自动批准工具 |
| 审计日志 | 审计事件查询、合规报告 |
| 提示词模板 | 模板注册/渲染/删除、Few-Shot 示例管理 |
| 安全与护栏 | 沙箱配置、护栏规则 |
| 遥测与调试 | OpenTelemetry 配置、Inspector 控制 |
| 工具管理 | 内置工具开关、工具缓存统计 |

**工具类（25 个 Tab）：** 仪表盘、多 Agent 编排、RAG、任务规划、终端、Hooks、预览、多文件编辑、测试生成、Wiki、Agent 配置、代码审查、Sub-Agent、图片转代码、记忆搜索、编排模板、可观测性、Few-Shot 优化、工具学习、安全策略、会话管理、自适应学习、截图分析、弹性组件、**SDK 工具**。

**即时应用：** 语言切换、字体大小拖动均立即生效（调用 `setLanguage` / `setFontSize`）。

### 7.6 其他视图组件

| 组件 | 说明 |
|------|------|
| `Sidebar` | 侧边栏导航（会话列表 + 功能入口 + 升级模块快捷入口 + 搜索过滤 + i18n + 主题切换 + SVG Logo） |
| `InputBox` | 输入组件（sendOnEnter + 模式选择 + Skill 选择器 + 模型选择 + 工作区选择 + 权限等级下拉 + 智能推荐） |
| `ModelConfigView` | 模型 CRUD + 连接测试 |
| `MCPManagerView` | MCP 服务器管理 + 连接状态 |
| `WorkspaceView` | 工作区管理 + 文件树浏览 |
| `SDKToolsView` | SDK 工具面板（结构化提取 + 记忆衰减 + 性能优化 + 模型路由，Phase 5 新增） |
| `ResilienceView` | 弹性组件面板（CircuitBreaker + Retry + RateLimiter + BatchProcessor） |
| `MessageBubble` | 消息气泡（i18n + Markdown 渲染 + 工具调用展示 + 指标显示） |
| `ToolCallDisplay` | 工具调用展示（参数 + 结果 + 状态） |
| `DiffView` | 文件差异视图 |
| `WorkbenchPanel` | 工作台面板 |
| `ErrorBoundary` | 错误边界 |
| `Dialog` | 对话框组件 |
| `chat/HITLApprovalModal` | HITL 审批弹窗 |
| `chat/DiffPanel` | Diff 面板 |
| `chat/ReflectionPanel` | 反思面板 |
| `chat/TerminalPanel` | 终端面板 |
| `chat/SubAgentPanel` | Sub-Agent 面板 |
| `chat/HitlPanel` | HITL 面板 |

---

## 8. 共享类型 (src/shared)

**文件组织（4 个文件）：**

| 文件 | 内容 |
|------|------|
| `types.ts` | Re-exports `ipcChannels.ts` + `sdkTypes.ts` + AELA 特有类型定义（~100+ 类型） |
| `ipcChannels.ts` | IPC 通道常量 `IPC_CHANNELS`（~200 个通道）+ `IPCResponse<T>` |
| `sdkTypes.ts` | SDK 相关类型定义 |
| `i18n.ts` | 共享 i18n 字典（zh / en，~900 条翻译） |

**核心类型（~100+）：**

`ModelConfig` / `Workspace` / `Session` / `ChatMessage` / `StreamEvent` / `MCPServerConfig` / `MCPServerStatus` / `MCPResourceInfo` / `FileTreeNode` / `AppConfig` / `SlashCommand` / `PromptVariantInfo` / `ShellConfirmRequest/Response` / `Skill` / `AutomationTask` / `AutomationRunRecord` / `OrchestrationConfig` / `OrchestrationEvent` / `MetricsSnapshot` / `MemoryEpisode` / `MemoryCompressConfig/Result` / `SandboxConfig` / `ACLRule` / `AccessLevel` / `GuardrailResult/Report/RuleConfig` / `DAGConfig` / `DAGStep` / `DAGEdge` / `CollaborationConfig` / `CollaborationResult` / `SupervisorWorker/Task/Stats` / `DynamicDAGConfig` / `RAGDocument/Chunk/SearchResult/Config` / `TelemetryConfig/SpanInfo/ExportResult` / `TraceSpan` / `SessionTrace` / `BuiltinToolInfo` / `ToolCacheStats` / `ModelPricing` / `BudgetConfig` / `CostRecord` / `CostSummary` / `ContextWindowConfig` / `ContextCompressConfig` / `AuditEvent/QueryFilter/Config/ComplianceReport` / `PromptRegistryEntry` / `FewShotExample` / `FewShotConfig` / `PromptMessageTemplates` / `Plan` / `SubTask` / `TaskStatus` / `ReflectionResult` / `CritiqueResult` / `ReflectionIssue` / `ToolUsageRecord` / `BestPractice` / `ToolLearningSuggestion` / `HITLConfig` / `HITLInterruptPoint` / `HITLResponse` / `MultimodalContentPart` / `MultimodalMessage` / `IPCResponse<T>` / `PermissionLevel` / `SubAgentPreset` / `SubAgentRunConfig` / `SubAgentRunResult` / `CircuitBreakerState` / `ImageToCodeResult` / `AdaptiveProfile` / `ScreenshotResult` 等。

**IPC 通道常量：** `IPC_CHANNELS` 对象定义了 ~200 个 IPC 通道名称，涵盖所有服务。

---

## 9. IPC 通信协议

### 通信模式

```
渲染进程                    主进程
   │                          │
   │── ipcRenderer.invoke() ──▶│── ipcMain.handle()
   │                          │── container.get<T>(token)
   │                          │── service.method()
   │◀── IPCResponse<T> ──────│
   │                          │
```

### 通道分组（~200 通道，26 个 handler 文件）

| 分组 | 通道前缀 | 说明 |
|------|----------|------|
| Agent | `agent:*` | 流式运行、停止、暂停/恢复、状态、模型测试、投机执行、缓存 |
| 模型 | `model:*` | CRUD + 设为默认 |
| 工作区 | `workspace:*` | CRUD + 文件操作 |
| 会话 | `session:*` | CRUD + 消息获取 + Skill 激活 + 搜索 + 导出 |
| MCP | `mcp:*` | CRUD + 连接管理 + 资源读取 |
| 配置 | `config:*` | 获取/设置应用配置 |
| Shell | `shell:*` | 命令确认 + 命令执行 |
| Skills | `skill:*` | 列表/重载/获取/删除/导入/扫描路径 |
| 自动化 | `automation:*` | CRUD + 执行 + 历史 + 启停 |
| 编排 | `orchestration:*` | 运行/停止 + 高级模式 + 模板 + 回放 + 性能 |
| DAG | `dag:*` | 运行/停止 + Builder |
| 协作 | `collaboration:*` | 运行/停止 |
| 动态DAG | `dynamic-dag:*` | 运行/停止 |
| 指标 | `metrics:*` | 快照/重置/趋势 |
| 可观测性 | `observability:*` | 成本分析/异常检测 |
| 记忆 | `memory:*` | 搜索/列表/添加/删除/统计/压缩/FTS5/衰减 |
| 安全 | `security:*` | 配置/访问检查/命令注入/路径穿越/输入消毒/CommandGuard |
| 护栏 | `guardrail:*` | 检查/规则管理 |
| Supervisor | `supervisor:*` | Worker 管理/任务提交/统计/策略 |
| RAG | `rag:*` | 摄入/搜索/清空/统计/配置/Fusion |
| 遥测 | `telemetry:*` | 配置/导出/Spans/状态 |
| 调试器 | `debugger:*` | 状态/Trace/Inspector |
| 工具缓存 | `tool-cache:*` | 统计/清空 |
| 内置工具 | `builtin-tools:*` | 列表/开关 |
| 成本 | `cost:*` | 摘要/记录/预算/定价 |
| 上下文 | `context-window:*` | 配置/裁剪/压缩 |
| 审计 | `audit:*` | 日志/查询/报告/配置 |
| 提示词 | `prompt:*` | 渲染/注册/删除/Few-Shot/变体列表/权重 |
| 规划 | `planning:*` | 分解/计划生成 |
| 反思 | `reflection:*` | 反思/批评/改进 |
| 工具学习 | `tool-learning:*` | 记录/最佳实践/建议/统计/可视化/失败模式 |
| HITL | `hitl:*` | 配置/中断点/自动批准/恢复 |
| 多模态 | `multimodal:*` | 文件/图片/音频/视频 |
| 文件变更 | `file-change:*` | 列表/获取/清空/接受/拒绝 |
| 终端 | `terminal:*` | 创建/销毁/输入/调整/列表/Tab/历史/运行 |
| Hooks | `hook-config:*` | 列表/增删改/开关/测试/导入导出 |
| 预览 | `preview:*` | 打开/关闭/导航/重载/前进后退/DevTools |
| 多文件 | `multifile:*` | 读取/批量写入/变更列表 |
| 测试生成 | `testgen:*` | 生成/分析/运行 |
| Wiki | `wiki:*` | 生成/获取/列表/删除 |
| Agent配置 | `agent-config:*` | CRUD + 获取 |
| 模型路由 | `model-route:*` | 建议/配置 |
| 代码审查 | `code-review:*` | 审查/获取/列表 |
| Sub-Agent | `subagent:*` | 运行/停止/状态/预设列表 |
| 图片转代码 | `img2code:*` | 分析/生成/优化/结果/框架列表 |
| SDK | `sdk:*` | 12 项增强能力 + 信息/错误码 + Phase 4 高价值模块 |
| 弹性 | `resilience:*` | 配置/统计/重置熔断器 + SDK 弹性执行 |
| 推理 | `reasoning:*` | 推理/流式推理/快速推理 |
| 自适应 | `adaptive:*` | 画像/提示/进度/记录/规则/清除 |
| 截图 | `screenshot:*` | 分析/结果/列表 |

### 流式事件通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `agent:stream-event:{sessionId}` | Main → Renderer | Agent 流式事件 |
| `orchestration:event:{runId}` | Main → Renderer | 编排流式事件 |
| `collaboration:event:{runId}` | Main → Renderer | 协作流式事件 |
| `dynamic-dag:event:{runId}` | Main → Renderer | 动态 DAG 流式事件 |
| `automation:run-event:{runId}` | Main → Renderer | 自动化执行事件 |

---

## 10. 数据持久化

所有持久化数据通过 `electron-store`（JSON 文件）或 `better-sqlite3`（SQLite 数据库）存储在 Electron `userData` 目录下。

| 存储文件 | 对应服务 | 内容 |
|----------|----------|------|
| `aela-config.json` | `ConfigStore` | 应用配置、模型列表、工作区、MCP 服务器 |
| `aela-sessions.json` | `SessionStore` | 会话列表、消息 |
| `aela-automation.json` | `AutomationStore` | 自动化任务、执行记录 |
| SQLite 数据库 | `MemoryService` / `SqliteMemoryStore` | 情景记忆（FTS5 全文索引 + HNSW 向量索引） |
| `logs/audit.jsonl` | `AuditService` | 审计日志（appendFileSync） |

**持久化方案：** 所有高级服务均已实现持久化，重启后数据不丢失：
- `electron-store`：ConfigStore / SessionStore / AutomationStore / CostTracker / ToolLearning / Memory / RAG（7 个服务）
- `better-sqlite3`：MemoryService（FTS5 + HNSW）
- `appendFileSync` 文件日志：AuditService

---

## 11. 安全机制

### 11.1 进程隔离
- 启用 `contextIsolation: true`，渲染进程无法直接访问 Node.js API
- 禁用 `nodeIntegration`，所有跨进程通信通过 `contextBridge` 暴露的安全 API
- 外部链接在系统浏览器中打开（`setWindowOpenHandler`）
- CSP 内容安全策略（生产环境严格，开发环境放宽支持 HMR）

### 11.2 Shell 命令安全

**三级风险评估：**

| 风险等级 | 说明 | 示例 |
|----------|------|------|
| `safe` | 只读操作，直接执行 | `git status`, `ls`, `cat`, `npm list` |
| `moderate` | 写操作，需用户确认 | `npm install`, `git commit`, `mkdir` |
| `dangerous` | 高危操作，必须明确确认 | `rm -rf`, `sudo`, `git push --force` |

### 11.3 安全沙箱（SecurityService）
- ACL 规则：控制 Agent 对资源的访问权限（none/read/write/execute/all）
- **[Phase 5] before_tool hook**：命令注入防护 + 路径穿越检测 + ACL 权限检查
- 命令白名单/黑名单

### 11.4 安全护栏（GuardrailService）
- **[Phase 5] 输入/输出双向检查**：`before_llm` 检查输入 + `after_llm` 检查输出
- 规则类型：注入检测 / PII 过滤 / 话题限制 / 关键词过滤
- 动作：pass / reject（阻断）/ sanitize（替换）/ flag

### 11.5 CommandGuard / InputSanitizer
- **CommandGuard**：命令白/黑名单 + 参数黑名单 + Shell 元字符检测
- **InputSanitizer**：空字节清除 / Unicode 规范化 / 长度限制 / 模式过滤

### 11.6 审计日志（AuditService）
- 记录所有 Agent 操作（文件访问 / Shell 执行 / 工具调用）
- 支持时间范围查询和合规报告生成

### 11.7 单实例锁
通过 `app.requestSingleInstanceLock()` 确保应用只有一个实例运行。

---

## 12. 构建与运行

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发模式（自动编译 SDK + 启动 Electron + Vite HMR）
npm run dev
```

### 构建发布

```bash
# 构建所有平台
npm run build

# 构建 Windows 安装包（NSIS）
npm run build:win

# 构建 macOS DMG
npm run build:mac

# 构建 Linux AppImage
npm run build:linux
```

### 类型检查

```bash
npm run typecheck         # 完整类型检查
npm run typecheck:node    # Node.js 端类型检查
npm run typecheck:web     # Web 端类型检查
```

### 代码检查

```bash
npm run lint
```

### 构建流程

1. `electron-vite build` — 编译主进程、预加载脚本、渲染进程
2. `electron-builder` — 打包为平台安装包
3. 输出到 `release/` 目录

---

## 13. 依赖关系图

### 模块依赖

```
ServiceContainer (DI 容器)
├── ConfigStore / SessionStore / WorkspaceManager / AutomationStore
├── AgentService
│   ├── ProviderManager → @agentprimordia/sdk (Providers)
│   ├── ToolManager → @agentprimordia/sdk (ToolRegistry, MCPClient)
│   ├── AgentHookFactory (10 HookPoints)
│   │   ├── GuardrailService (before_llm / after_llm)
│   │   ├── SecurityService (before_tool)
│   │   ├── CostTrackerService (after_llm)
│   │   ├── ContextWindowService (after_llm)
│   │   ├── ModelRouter (after_llm)
│   │   ├── AuditService (before_tool / after_tool)
│   │   ├── HITLService (before_tool)
│   │   ├── ToolLearningService (after_tool)
│   │   ├── MemoryService (on_complete)
│   │   └── ObservabilityService (all hooks)
│   ├── PromptBuilder (三层提示词 + Memory 注入)
│   ├── PromptService (模板引擎 + Few-Shot)
│   └── SkillScanner (单例)
├── OrchestrationService → @agentprimordia/sdk (ParallelRun, AgentPool, GroupChat)
│   └── orchestration/ (GroupChat, StreamingPipeline, Supervisor, Replay, Templates)
├── DAGSchedulerService / CollaborationService / SupervisorService / DynamicDAGService
├── MemoryService → SqliteMemoryStore (SQLite + FTS5 + HNSW)
├── RAGService → @agentprimordia/sdk (RAGStore, RAGReranker, MMRReranker)
├── ReasoningService → @agentprimordia/sdk (ReasoningEngine)
├── ResilienceService → @agentprimordia/sdk (CircuitBreaker, Retry, RateLimiter)
├── SDKEnhancementsService → @agentprimordia/sdk (12 项能力)
├── CostTrackerService / ContextWindowService / AuditService
├── PlanningService / ReflectionService / ToolLearningService
├── HITLService / MultimodalService
├── TerminalService / PreviewService / HookConfigService
├── TestGenService / RepoWikiService / CodeReviewService
├── SubAgentIsolationService / ImageToCodeService
├── AdaptiveLearningService / ScreenshotAnalysisService
├── ModelRouter / AgentConfigService
├── TelemetryService / DebuggerService / ObservabilityService
└── MainWindowHolder

IPC 注册 (registerIPC)
├── container.get<T>(SERVICE_TOKENS.XXX) → 获取服务
└── 26 个 handler 文件 → ~200 个 IPC 通道
```

### 外部依赖

```
@agentprimordia/sdk (本地 SDK, 120+ 模块)
├── ReActAgent / Lifecycle / HookManager (10 HookPoints)
├── Provider (15+ LLM Providers)
├── ToolRegistry / Tool / MCPClient
├── Memory (RAG, Vector, HNSW, SQLite, FTS5, HashEmbedding, Compressor)
├── Orchestration (Pipeline, DAG, GroupChat, Debate, Supervisor)
├── Security (Sandbox, Guardrails, ACL, CommandGuard, InputSanitizer)
├── Observability (Metrics, OTel, Debugger, AgentMonitor)
├── Evolution (SelfTuning, SpeculativeExec, ABTest, CachedProvider)
├── Resilience (CircuitBreaker, Retry, RateLimiter, BatchProcessor)
├── Reasoning (ReasoningEngine)
├── RAG (RAGStore, RAGReranker, MMRReranker, DocumentLoaders)
├── Structured (StructuredExtractor, SchemaBuilder)
└── Multimodal (MultimodalFusion)

electron-store        — JSON 持久化
better-sqlite3        — SQLite 数据库（FTS5 + HNSW）
zustand               — 前端状态管理（7 个 slice）
react + react-dom     — UI 框架
tailwindcss           — 样式框架（CSS 变量主题）
react-markdown        — Markdown 渲染
remark-gfm            — GFM 扩展
react-syntax-highlighter — 代码高亮
electron-builder      — 打包工具
electron-vite         — 构建工具
```

---

## 附录：数据流示例

### 用户发送消息的完整数据流（Phase 5 增强）

```
1. [Renderer] 用户输入 → handleSend()
2. [Renderer] 创建/获取 Session
3. [Renderer] 添加 userMessage 到 Zustand messagesStore
4. [Renderer] 调用 window.aela.agent.runStream()
5. [Preload] invoke('agent:stream', params)
6. [Main] IPC handler → container.get<AgentService>(SERVICE_TOKENS.AGENT_SERVICE)
7. [Main] AgentService.runStream():
   a. 获取 ModelConfig → ProviderManager.createProvider()
   b. 加载 Session 的 activeSkillIds → 注入 Skills
   c. 读取 AGENTS.md / CLAUDE.md（如启用）
   d. 获取 MCP 工具列表
   e. PromptBuilder.build() → 构建三层系统提示词
   f. PromptService.renderFewShot() → 动态追加 Few-Shot 示例
   g. [Phase 5] MemoryService.hybridSearchScored() → 检索 Top-5 相关记忆注入
   h. AgentHookFactory.create() → 创建 HookManager（注册 10 个 Hook）
   i. 保存用户消息到 MemoryService
   j. 创建 ReActAgent
   k. agent.streamEvents(input) → AsyncGenerator<StreamEvent>
8. [Main] Hook 系统（每次 LLM/工具调用触发）:
   a. before_llm → [Phase 5] GuardrailService 输入检查
   b. after_llm → 记录延迟 + CostTracker + [Phase 5] GuardrailService 输出检查
      + [Phase 5] ContextWindow token 测量 + [Phase 5] ModelRouter 模型建议
   c. before_tool → 审计日志 + HITL 中断检查 + [Phase 5] SecurityService 安全检查
   d. after_tool → 审计日志 + ToolLearning 记录经验
   e. on_complete → MemoryService 自动保存记忆
9. [Main] 遍历 stream → win.webContents.send('agent:stream-event:{sessionId}', evt)
10. [Preload] ipcRenderer.on → callback(data)
11. [Renderer] handleStreamEvent():
    - token → appendStreamingContent()
    - tool_call/tool_result → addStreamEvent()
    - done → addMessage(assistantMsg)
12. [Renderer] UI 更新（消息列表、流式内容、工具调用状态）
```

### 多 Agent 编排数据流

```
1. [Renderer] OrchestrationView 配置编排 → 调用 window.aela.orchestration.run(config)
2. [Preload] invoke('orchestration:run', config)
3. [Main] IPC handler → container.get<OrchestrationService>(SERVICE_TOKENS.ORCHESTRATION_SERVICE)
4. [Main] OrchestrationService:
   a. 根据 mode 选择编排策略 (pipeline/parallel/handoff/pool/groupchat/debate/supervisor)
   b. 为每个 Agent 创建 ReActAgent 实例
   c. 流式产出 OrchestrationEvent
5. [Main] 遍历 stream → win.webContents.send('orchestration:event:{runId}', evt)
6. [Preload] ipcRenderer.on → callback(data)
7. [Renderer] OrchestrationView 实时展示:
    - step_start → 标记 Agent 开始
    - step_token → 实时显示输出
    - step_done → 记录结果
    - all_done → 编排完成
```

---

*文档更新时间: 2026-07-02*
*AELA 版本: 0.2.0*
*SDK 版本: @agentprimordia/sdk@1.0.0*
