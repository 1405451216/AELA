# AELA

> Solo 模式 AI 编码助手桌面应用 — 基于 Electron 33 + React 18 + TypeScript

[![TypeScript](https://img.shields.io/badge/typescript-strict-blue)]() [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]() [![Version](https://img.shields.io/badge/version-0.2.0-purple)]()

## 前置条件

> ⚠️ **本地 SDK 为必选项**：AELA 通过 `file:` 依赖直接引用本地 AgentPrimordia SDK（`@agentprimordia/sdk`）。
> 在运行 `npm install` / `npm run dev` 之前，请**至少满足以下任一条件**：
>
> - **方式一（默认路径）**：在本仓库同级目录存在 `../codecast/AgentPrimordia/sdk/typescript`
>   （即把 `AgentPrimordia` 仓库克隆到 `E:/codecast/AgentPrimordia`）；
> - **方式二（自定义路径）**：设置环境变量 `AELA_SDK_PATH` 指向**已构建**的 SDK `dist` 目录，例如：
>   ```bash
>   AELA_SDK_PATH=/abs/path/to/AgentPrimordia/sdk/typescript/dist npm install
>   ```
>
> 若 SDK 未就绪，`npm install` 的 `postinstall` 校验脚本会给出提示，类型检查与构建也会因无法解析
> `@agentprimordia/sdk` 而失败。详见下方「SDK 依赖」一节。

## 快速开始

```bash
# 安装依赖（需要本地 SDK：../codecast/AgentPrimordia/sdk/typescript）
npm install

# 启动开发模式（Vite HMR + Electron 主进程热重载）
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 单元测试
npm test

# 构建发布包
npm run build        # 当前平台
npm run build:win    # Windows NSIS
npm run build:mac    # macOS DMG
npm run build:linux  # Linux AppImage
```

## 项目特性

| 类别 | 能力 |
|------|------|
| **多模型** | OpenAI / Anthropic / Gemini / Ollama / DeepSeek / Qwen / GLM / Mistral / Cohere / Azure OpenAI（10+ 专用 Provider） |
| **ReAct Agent** | 自主执行 + 流式输出 + 工具调用 + **AgentSelfTuner 自省调优** + **SpeculativeExecutor 投机执行** + **CachedProvider 请求缓存** |
| **提示词工程** | **三层提示词系统**（共享基础层 + 模式专属层 + 6 种变体层）+ **动态 Few-Shot 示例注入** |
| **Skills** | Markdown 格式技能，可注册为 Agent 工具，自动扫描 `.claude` / `.codex` / `.cursor` 等第三方目录 |
| **MCP** | stdio / http 两种传输，工具名前缀 `mcp_` |
| **多 Agent 编排** | Pipeline / Parallel / Handoff / Pool + **GroupChat 群聊** / **Debate 辩论** / **Supervisor 主管** |
| **DAG 调度** | **DAGBuilder 有向无环图**任务编排，支持重试 / 超时 / 条件跳过 / 节点级调度 |
| **弹性组件** | **CircuitBreaker 熔断器** + **Retry 重试** + **ResilientWrapper 统一弹性包装** |
| **限流批处理** | **RateLimiter 令牌桶限流**（RPM 控制）+ **BatchProcessor 并发批处理** |
| **推理引擎** | **ReasoningEngine 独立推理**（单轮同步 / 流式），与 ReAct 循环解耦 |
| **可观测性** | 运行时指标 / Trace 追踪 / OpenTelemetry 遥测 / **AgentMonitor 实时监控** / 异常检测 |
| **记忆系统** | 情景记忆（SQLite + FTS5 + HNSW 混合检索）+ **HashEmbedding 双哈希向量化** + **SDK Compressor LLM 驱动压缩** + **重要性衰减** |
| **RAG** | **SDK RAGStore + RAGReranker + MMRReranker** + PDF / DOCX / CSV / HTML / Markdown 文档加载 |
| **安全体系** | 沙箱 ACL / 安全护栏（**SDK RuleEngine**） / **CommandGuard 命令护栏** / **InputSanitizer 输入消毒** / 审计日志 / **API Key OS Keyring 加密** |
| **HITL** | 工具确认中断 + 预算超限中断 + 自动批准 |
| **成本追踪** | 预算管理 + **SDK PricingCalculator 统一定价表**（含 DeepSeek / Qwen / GLM / Mistral / Cohere） |
| **结构化提取** | **StructuredExtractor LLM 驱动**（情感分析 / 分类 / 摘要 / NER 预定义 Schema） |
| **多模态** | 图片 / 音频 / 视频消息构建 + **MultimodalFusion 多模态融合** + **截图分析** |
| **模型路由** | **ModelRouter 智能路由**（根据任务类型 + 输入复杂度生成模型建议） |
| **Agent 自适应** | **AdaptiveLearningService** 用户画像 + 交互学习 + 规则提取 |
| **代码审查** | **CodeReviewService** LLM 驱动的自动化代码审查 |
| **Sub-Agent** | **SubAgentIsolationService** 并行隔离执行 + 资源配额 |
| **工具增强** | 内置终端（多 Tab）+ 浏览器预览 + 多文件编辑 + 自动测试生成 + Repo Wiki |
| **i18n** | 中英文切换（共享翻译字典，主进程 + 渲染进程统一引用） |

## SDK 集成架构

AELA 深度集成 `@agentprimordia/sdk` v1.0.0，分五个阶段完成：

| 阶段 | 内容 | 状态 |
|------|------|------|
| **Phase 1** | 替换 14 个自研服务为 SDK 原生实现（Agent / Provider / Tool / Memory / RAG / Security / Cost / Planning / Guardrail 等） | ✅ 完成 |
| **Phase 2** | 集成 12 项 SDK 独有能力（SDKEnhancementsService：结构化输出 / 多模态融合 / 批量请求 / A/B 测试 / 评估套件 / 流式管道 / 动态编排 / 插件热加载 / Worker 线程池 / 可视化工具 / Agent 监控 / 缓存统计） | ✅ 完成 |
| **Phase 3** | RAGService 集成 RAGStore + RAGReranker + MMRReranker；OrchestrationService 集成 GroupChat / Debate / Supervisor；AgentService 集成 SpeculativeExecutor + CachedProvider | ✅ 完成 |
| **Phase 4** | 高价值模块集成：DAGBuilder / CircuitBreaker / Retry / RateLimiter / BatchProcessor / StructuredExtractor / ReasoningEngine / LLMSummarizer / Compressor / HashEmbedding / CommandGuard / InputSanitizer / PDF / DOCX Loader | ✅ 完成 |
| **Phase 5** | SDK 新能力闭环接入：(1) 记忆系统读写闭环 — AgentService.runStream() 执行前通过 hybridSearchScored 检索 Top-5 相关记忆注入系统提示词；(2) 安全体系接入执行链路 — GuardrailService 输入检查 + after_llm 输出检查，SecurityService before_tool 命令注入防护 + 路径穿越检测 + ACL 权限检查；(3) ContextWindow 实际调用 — 测量 token 使用量 + 动态压缩；(4) ModelRouter 接入 — 根据任务类型生成模型建议；(5) SDKToolsView UI 面板 | ✅ 完成 |

## 项目结构

```
src/
├── main/                       # Electron 主进程 (40+ 服务)
│   ├── index.ts                # 主进程入口（服务初始化 + DI 容器注册 + IPC 注册）
│   ├── secretStore.ts           # API Key 加密 (Electron safeStorage)
│   ├── ipc/
│   │   ├── index.ts            # IPC 处理器注册入口（DI 容器路由）
│   │   └── handlers/           # 26 个 IPC 处理器文件（按功能域拆分）
│   ├── sdk/                    # SDK 适配器（ABTest / Batch / EvalSuite）
│   └── services/               # 40+ 服务
│       ├── ServiceContainer.ts # DI 容器（统一生命周期 + 依赖注入）
│       ├── AgentService.ts     # 核心 Agent 编排（ReAct + Hook + 注入链）
│       ├── AgentHookFactory.ts # Hook 工厂（创建 10 个 HookPoint）
│       ├── AgentConfigService  # Agent 自定义配置管理
│       ├── ProviderManager     # 多模型 Provider 管理
│       ├── ToolManager         # 工具管理（内置 + MCP + Skill + 缓存）
│       ├── PromptBuilder       # 三层提示词构建器
│       ├── PromptService       # 模板引擎 + Few-Shot 示例选择器
│       ├── OrchestrationService# 多 Agent 编排（4 模式 + GroupChat / Debate / Supervisor）
│       ├── MemoryService       # 情景记忆（SQLite + FTS5 + HNSW 混合检索）
│       ├── SqliteMemoryStore   # SQLite 底层存储（FTS5 全文 + HNSW 向量）
│       ├── SecurityService     # 安全沙箱（ACL + 命令注入防护 + 路径穿越检测）
│       ├── GuardrailService    # 安全护栏（输入/输出双向检查）
│       ├── ModelRouter         # 模型智能路由
│       ├── RAGService          # RAG 管道（文档切分 + 混合检索 + 重排序）
│       ├── ReasoningService    # 独立推理引擎
│       ├── ResilienceService   # 弹性执行（熔断 + 重试 + Fallback）
│       ├── SDKEnhancementsService # 12 项 SDK 增强能力封装
│       ├── CostTrackerService  # 成本追踪与预算管理
│       ├── ContextWindowService# 上下文窗口管理
│       ├── ObservabilityService# 运行时指标与事件总线
│       ├── TerminalService     # 内置终端（多 Tab + 命令历史）
│       ├── HookConfigService   # 用户 Hooks 配置（10 个生命周期 Hook 点）
│       ├── PreviewService      # 浏览器预览窗口
│       ├── TestGenService      # 自动测试生成
│       ├── RepoWikiService     # 仓库 Wiki 生成
│       ├── CodeReviewService   # 代码审查
│       ├── SubAgentIsolationService # Sub-Agent 并行隔离
│       ├── ImageToCodeService  # 图片转代码
│       ├── AdaptiveLearningService # Agent 自适应学习
│       ├── ScreenshotAnalysisService # 截图分析
│       └── ...                 # Audit / Planning / Reflection / HITL / Multimodal 等
├── preload/                    # 预加载层（contextBridge ~55 API 分组）
├── renderer/                   # React 应用
│   └── src/
│       ├── stores/             # Zustand slice 架构（7 个切片）
│       │   ├── viewStore.ts    # 视图路由
│       │   ├── configStore.ts  # 配置 + 主题 + 语言 + 字体
│       │   ├── messagesStore.ts# 消息列表
│       │   ├── skillStore.ts   # 技能管理
│       │   ├── streaming.ts    # 流式状态
│       │   ├── automationStore.ts # 自动化任务
│       │   └── dialog.ts       # 对话框
│       ├── components/         # 30+ 视图组件
│       │   ├── settings/       # 设置页子组件（12 个 Tab 面板）
│       │   ├── orchestration/  # 编排子 Tab（5 个）
│       │   ├── chat/           # 聊天子组件（10+ 个）
│       │   └── shared/         # 共享组件
│       ├── i18n/               # i18n 系统
│       └── styles/index.css    # 全局样式（CSS 变量主题）
└── shared/                     # 共享类型
    ├── types.ts                # 全局类型定义（Re-exports）
    ├── ipcChannels.ts          # IPC 通道常量（~200 通道）
    ├── sdkTypes.ts             # SDK 类型定义
    └── i18n/                   # 共享 i18n 字典（zh / en，index.ts 桶文件 + dict/lang/translate 子模块）
```

## 架构概览

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
│  │         ServiceContainer DI 容器（40+ 服务统一管理）         │  │
│  └──┬──────────────────────────────────────────────────────┬──┘  │
│     │  IPC 处理器注册（26 个 handler 文件，~200 通道）       │      │
│     ▼                                                      │      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │      │
│  │Agent     │  │Orchest.  │  │Memory    │  │Security  │   │      │
│  │Service   │  │Service   │  │Service   │  │+Guardrail│   │      │
│  │(Hook     │  │(Pipeline │  │(SQLite + │  │(ACL + 注入│   │      │
│  │ Factory) │  │ DAG Chat)│  │ FTS5+HNSW│  │ 防护)    │   │      │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────────┘   │      │
│       │                                                    │      │
│  ┌────▼────────────────────────────────────────────────┐   │      │
│  │ @agentprimordia/sdk v1.0.0                          │   │      │
│  │ ReActAgent / Provider / Tool / MCP / HookManager    │   │      │
│  │ RAGStore / RAGReranker / Memory / HNSW / HashEmbed  │   │      │
│  │ Orchestration / DAG / GroupChat / Debate / Supervisor│  │      │
│  │ Security / Guardrail / CommandGuard / InputSanitizer│   │      │
│  │ SpeculativeExecutor / CachedProvider / SelfTuner    │   │      │
│  │ CircuitBreaker / Retry / RateLimiter / BatchProc    │   │      │
│  │ StructuredExtractor / ReasoningEngine / Compressor  │   │      │
│  │ AgentMonitor / MultimodalFusion / WorkerPool / ...  │   │      │
│  └─────────────────────────────────────────────────────┘   │      │
└────────────────────────────────────────────────────────────────────┘
```

## 安全说明

### API Key 存储

AELA 使用 Electron **safeStorage**（OS 级密钥链）加密存储 LLM API Key:

- **macOS**: Keychain
- **Windows**: DPAPI（绑定用户账户）
- **Linux**: libsecret（GNOME Keyring / KWallet）

存盘格式前缀:
- `enc:v1:` — 加密格式（推荐）
- `b64:` — 降级格式（无 OS Keyring，明文等价，**不推荐**）
- 无前缀 — 旧版本遗留数据（首次启动会被自动加密）

### 其他安全机制

- `contextIsolation: true` + `nodeIntegration: false`
- Shell 命令三级风险评估（`safe` / `moderate` / `dangerous`）
- 沙箱 ACL 控制 Agent 对资源访问（`none` / `read` / `write` / `execute` / `all`）
- **CommandGuard**：命令白 / 黑名单 + 参数黑名单 + Shell 元字符检测
- **InputSanitizer**：空字节清除 / Unicode 规范化 / 长度限制 / 模式过滤
- **GuardrailService**：输入/输出双向检查 — Prompt 注入检测 / PII 脱敏 / 话题限制 / 敏感词过滤
- **SecurityService**：before_tool hook 中执行命令注入防护 + 路径穿越检测 + ACL 权限检查
- 审计日志（`logs/audit.jsonl`）

## SDK 依赖

本项目依赖本地 AgentPrimordia SDK:

```
@agentprimordia/sdk: "file:../codecast/AgentPrimordia/sdk/typescript"
```

如需自定义路径，设置环境变量:

```bash
AELA_SDK_PATH=/path/to/sdk npm install
```

详见 [SDK集成架构文档.md](SDK集成架构文档.md) 与 [CODE_WIKI.md](CODE_WIKI.md)。

## 贡献

开发流程:
1. 修改代码后跑 `npm run typecheck && npm run lint && npm test` 确保全部通过
2. 新增功能请保持现有 slice 架构（viewStore / configStore / messagesStore / skillStore / streaming / automationStore / dialog）
3. 新增服务请在 `ServiceContainer` 中注册，使用 `SERVICE_TOKENS` 常量
4. 新增 IPC 通道请在 `src/shared/ipcChannels.ts` 中定义常量
5. 测试覆盖率目标：核心服务 ≥ 60%

## 许可证

[MIT](LICENSE)

---

Powered by Electron + React + TypeScript + Vite + Zustand + `@agentprimordia/sdk`
