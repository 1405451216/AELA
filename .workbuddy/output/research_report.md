# AELA - 行业调研报告

> 本文档为《AICoding 架构设计》核心产物之一，定位为**行业调研报告（research_report）**。
> 上游输入：主理人转交的用户诉求 + `material_digest.md`（G1 已通过，25 份资料逐章摘要 + X1–X12 冲突记录）；
> 下游输出：驱动 `business-architect`（业务架构师）的行业调研判断，最终落入《高层架构设计》的 §3 行业调研章节。
> 调研赛道（用户诉求原文）：「围绕『AI 编码助手 / Agentic Coding 工具』这一赛道，对标同类桌面/IDE 集成、具备 Agent 编排与工具调用能力的产品/方案」。

> **结构纪律**：全文按「事实 → 对比 → 建议 → 风险」四段式组织。凡标注「事实」为已核实资料；「推断」为基于次级资料或通用认知的推论；「建议」为供 business-architect 采用的取向（非最终裁决）；「风险」为调研发现的隐患。

---

## 0. 元信息：修订记录

```yaml
标题: AELA - 行业调研报告 v0.1
版本: v0.1
状态: Draft   # Draft | Reviewing | Approved | Deprecated
创建日期: 2026-07-07
最后更新: 2026-07-07
调研人: 查有据 (research-analyst)
审核人:
  - 主理人 (team-lead)

关联文档:
  上游输入:
    - 用户诉求: 由主理人注入（见本文件 §1.1 引用）
    - 调研目标: 由主理人注入（AI 编码助手 / Agentic Coding 工具赛道对标）
    - material_digest.md: E:/codecast/AELA/.workbuddy/output/material_digest.md（G1 通过）
  下游产出:
    - 高层架构设计 §3 行业调研: 将由 business-architect 整合到此章节
```

| 版本 | 日期 | 作者 | 变更内容 | 评审状态 |
| --- | --- | --- | --- | --- |
| v0.1 | 2026-07-07 | 查有据 | 初稿（Phase 2 行业调研，G2 门） | Draft |

---

## 1. 调研问题收敛

> 调研启动前，先围绕用户诉求收拢为明确的调研问题集合，确保调研不偏离当前项目背景。

### 1.1 原始调研种子

> 从用户诉求与 `material_digest.md` 的冲突记录（X1–X12、D20）中提取需调研验证的论题，逐条给出调研优先级。

| 编号 | 待验证论题 | 来源（用户诉求 / material_digest 要点） | 调研优先级 | 备注 |
| --- | --- | --- | --- | --- |
| S1 | 同类桌面 / IDE 集成 Agentic Coding 工具在「Agent 编排、工具调用（MCP）、HITL、成本追踪」维度的能力矩阵行业基线 | 用户诉求（赛道对标） | 高 | 核心对标论题 |
| S2 | 头部 SaaS 与开源方案如何平衡「Agent 自主执行」与「人工确认 / 安全护栏」 | 用户诉求（Agent 编排 + 工具调用） | 高 | 对应 AELA 的 HITL / 沙箱权衡 |
| S3 | Electron 桌面应用安全基线（sandbox、contextIsolation、IPC 入参校验）的权威最佳实践 | material_digest X6（sandbox true/false）、X12（~20/37 handler 无校验）、ADR-002 | 高 | 行业裁决依据 |
| S4 | 工具调用（MCP）的权限 / 沙箱边界在头部产品中如何落地 | material_digest D20（MCP 不经 SecurityService 沙箱） | 中 | 对应 AELA MCP 工具 ACL 缺口 |
| S5 | 同类工具是否也采用「本地 SDK file: 依赖」式开发链路，其取舍是否行业共性 | material_digest X7（SDK 路径漂移）、ADR-001（file: 依赖） | 中 | 对应 AELA SDK 解耦待决 |

### 1.2 调研问题收敛

> 将 §1.1 的种子收敛为 5 个可执行的调研问题。每条问题明确调研对象、调研目标和产出预期。

| 编号 | 调研问题 | 调研对象 | 调研目标 | 预期产出 | 关联种子 |
| --- | --- | --- | --- | --- | --- |
| Q1 | 主流 Agentic Coding 工具（桌面 / IDE / CLI）在 Agent 编排、工具调用（MCP）、HITL、成本追踪等维度上有哪些可对标能力？ | Cursor / Windsurf / Cline / Aider / Continue 官方文档 + 官方仓库 | 建立能力对比矩阵，识别与 AELA 能力集的同构点 | §2 标杆清单 + §2.3 横向事实表 | S1 |
| Q2 | 这些方案如何平衡「Agent 自主执行」与「人工确认 / 安全护栏」？ | 各产品 HITL / 审批 / 权限 / Run Mode 设计 | 为 AELA 的 HITL / 沙箱权衡提供对照范式 | §2.2 详述 + §4 建议 | S2 |
| Q3 | Electron 桌面应用安全最佳实践（sandbox / contextIsolation / IPC 入参校验）的权威基线是什么？ | Electron 官方安全文档 + 社区实践 | 为 X6（sandbox）、X12（IPC 校验）提供裁决依据 | §2 行业基线 + §4.1 / §5.1 | S3 |
| Q4 | MCP 工具调用的权限 / 沙箱边界在头部产品中如何实现？ | Cursor MCP 文档 + Cline MCP + MCP 官方规范 | 为 D20（MCP 不经 SecurityService 沙箱）提供对照 | §2.3 + §4.1 + §5.1 | S4 |
| Q5 | 同类工具是否也采用「本地 SDK file: 依赖」式开发链路？其 monorepo / semver 取舍如何？ | Cline monorepo（@cline/* workspace symlinks）+ 通用 npm / monorepo 实践 | 为 ADR-001 / X7 提供取舍参照 | §4.1 + §5.2 | S5 |

---

## 2. 事实：标杆系统盘点和方案详述

> **四段式「事实」段**。只陈列调研发现的事实，不做引申建议或边界裁决。置信度标注：已核实 / 推断 / 综合归纳。

### 2.1 行业标杆清单

> 完整盘点调研覆盖的标杆系统，给出标签化画像。

**硬指标**：≥ 3 家；至少包含 1 家头部 SaaS 代表（Cursor、Windsurf）+ 1 家开源/自研代表（Cline、Aider、Continue）。✅

| 编号 | 标杆系统 | 厂商 / 社区 | 部署形态 | 场景覆盖 | 技术亮点 | 商业模式 | 调研来源 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | Cursor | Anysphere（头部 SaaS） | 桌面 IDE（闭源 SaaS） | AI-first 编辑器 + Agent 模式 + MCP + 多模型 | Agent 自主编码、MCP（stdio/SSE/HTTP）、Skills、Hooks、Cloud Agents、企业管控 | 订阅制（Hobby/Pro/Teams/Enterprise） | SR-01, SR-02 |
| B2 | Windsurf（现演进为 Devin Desktop） | Codeium / Cognition（头部 SaaS） | 桌面 IDE（闭源 SaaS） | Cascade 代理式编码 + RAG 索引；Devin Desktop agent fleets | Cascade 多文件编辑、终端集成、迭代调试、RAG 代码库索引、MCP Server、ACP | 订阅制（Free/Pro/Teams/Enterprise） | SR-03, SR-04 |
| B3 | Cline | Cline Bot Inc.（开源社区） | VS Code 扩展 / SDK / CLI（开源，可自托管） | 开源自主编码 Agent + MCP + HITL | 文件/终端/浏览器工具、MCP 自定义工具、Checkpoints 回滚、成本追踪、多模型 BYOK、企业自托管 | 开源免费（Apache 2.0）+ Enterprise 订阅 | SR-05, SR-06 |
| B4 | Aider | Aider-AI（开源社区） | 终端 CLI（开源） | Solo 式 AI 结对编程 | Repo-map、Git 自动提交、多模型 BYOK、100+ 语言、改动后 lint/test | 开源免费（Apache 2.0） | SR-07, SR-08 |
| B5 | Continue | Continue Dev（开源社区） | IDE 扩展（开源，配置驱动，可自托管） | 配置驱动 AI 编码 Agent | Chat/补全/Edit/Agents、Context Providers、MCP、多模型、私有化友好 | 开源免费（Apache 2.0，推断）+ 企业版 | SR-09, SR-10 |

### 2.2 标杆方案详述

> 每家标杆逐一展开（5 家全部详述）；每段区分「已核实的事实」与「推断 / 假设」。

#### 2.2.1 B1 - Cursor

| 维度 | 内容 | 置信度 |
| --- | --- | --- |
| 产品定位 | AI-first 桌面代码编辑器（全功能 IDE），内置 Agent 模式 | 已核实 |
| 目标用户 | 个人开发者到企业研发团队 | 已核实 |
| 核心能力 | Agent 自主编码、MCP 工具/数据连接、Skills、Hooks、Cloud Agents、Agentic code review（Bugbot）、多模型接入 | 已核实 |
| 架构特点 | 桌面 IDE（Electron/VSCode 系，推断）；Agent 经 Run Mode 管控工具审批；MCP 支持 stdio / SSE / Streamable HTTP + OAuth + Allowlist + 网络控制 | 已核实（MCP 文档）+ 推断（桌面框架） |
| 部署形态 | 桌面应用 SaaS（闭源） | 已核实 |
| 集成方式 | 扩展 API、mcp.json 配置、Team Marketplace 分发 | 已核实 |
| 定价模式 | 订阅制：Hobby 免费（限流）、Pro $20/月、Teams $40/人/月、Enterprise 定制（SCIM、repo/model/MCP 访问控制、auto-run/browser/network 控制、审计日志） | 已核实 |
| 优势 | 产品形态与 AELA 最贴近（桌面 + Agent + MCP + HITL + 企业管控）；生态成熟、文档完备 | 综合归纳 |
| 局限 | 闭源 SaaS，复用需 API/订阅；私有化仅 Enterprise 档 | 推断 |
| 对本项目的参考价值 | 头部产品形态基线 + Agent/MCP/HITL/企业管控（SSO/审计/MCP Allowlist/Run Mode）设计参照 | 推断 |

#### 2.2.2 B2 - Windsurf（现 Devin Desktop）

| 维度 | 内容 | 置信度 |
| --- | --- | --- |
| 产品定位 | AI-native IDE，Cascade 代理式编码引擎；现已演进为 Devin Desktop（本地/云 agent 舰队 + 内置 IDE） | 已核实 |
| 目标用户 | 追求「flow」全托管自动驾驶体验的开发者 / 团队 | 已核实 |
| 核心能力 | Cascade 多文件编辑、终端集成、迭代调试、RAG 代码库索引、Windsurf Tab 补全；Devin Desktop 支持 MCP Server 集成 + Agent Client Protocol（ACP）多 agent 编排 | 已核实 |
| 架构特点 | 全 IDE + 插件；RAG 本地代码库索引；Devin Desktop 用 ACP 编排多 agent（推断） | 已核实（Cascade/RAG）+ 推断（ACP） |
| 部署形态 | 桌面 IDE SaaS（闭源） | 已核实 |
| 集成方式 | 内置一体化（Live Preview / Deploy）；MCP Server 集成；ACP | 已核实 |
| 定价模式 | 订阅：Free $0（25 prompt/月）、Pro $15/人/月、Teams $30/人/月、Enterprise 起 $60/人/月（SOC 2、私有部署） | 已核实 |
| 优势 | 自主代理 flow + RAG 索引对 AELA 的「Agent + RAG」有算法层范式参考 | 综合归纳 |
| 局限 | 闭源全托管，私有化仅企业档；产品定位已转向 Devin Desktop（agent fleets），偏离个人桌面编码助手 | 推断 |
| 对本项目的参考价值 | Cascade 多文件编辑 + 迭代调试 + RAG 索引可作算法层参考；整体产品形态不作为 AELA 架构借鉴 | 推断 |

#### 2.2.3 B3 - Cline

| 维度 | 内容 | 置信度 |
| --- | --- | --- |
| 产品定位 | 开源自主编码 Agent（VS Code 扩展 / SDK / CLI） | 已核实 |
| 目标用户 | 不想锁定模型/供应商、需每步可控的开发者；企业可自托管 | 已核实 |
| 核心能力 | 创建/编辑文件（diff 视图）、终端命令（许可后）、浏览器操控、MCP 自定义工具、Checkpoints 对比/回滚、token/成本追踪、多模型 BYOK（OpenRouter/Anthropic/OpenAI/Gemini/Bedrock/Azure/Vertex/Cerebras/Groq/本地） | 已核实 |
| 架构特点 | human-in-the-loop GUI 审批每一步文件变更与终端命令；monorepo（@cline/* workspace symlinks）同时发布 SDK + 扩展 + CLI | 已核实 |
| 部署形态 | VS Code 扩展（开源）；Claude CLI / SDK；企业支持自托管 / on-prem | 已核实 |
| 集成方式 | VS Code API、MCP、配置式 | 已核实 |
| 定价模式 | 开源免费（Apache 2.0）；Enterprise 订阅（SSO/SAML、全局策略、审计轨迹、私有网络 VPC、自托管/本地部署） | 已核实 |
| 优势 | 与 AELA 能力集高度同构（Agent + MCP + HITL + Checkpoints + 成本追踪 + 多模型 + 可自托管），且 Apache 2.0 可审计 | 综合归纳 |
| 局限 | 绑定 VS Code 生态；Plan/Act 双模式等细节需查文档确认（推断）；作为扩展而非独立桌面应用 | 推断 |
| 对本项目的参考价值 | 最贴近 AELA 设计范式的开源参照，可直接指导自研/复用边界 | 推断 |

#### 2.2.4 B4 - Aider

| 维度 | 内容 | 置信度 |
| --- | --- | --- |
| 产品定位 | 终端 CLI 开源 AI 结对编程工具 | 已核实 |
| 目标用户 | 偏好命令行 / Solo 工作流的开发者 | 已核实 |
| 核心能力 | Repo-map（全仓库地图）、Git 自动提交、多模型 BYOK（Claude 3.7/DeepSeek/OpenAI o1·o3-mini/GPT-4o/本地）、100+ 语言、改动后 lint/test | 已核实 |
| 架构特点 | 纯 CLI；repo-map 管理上下文；多种编辑格式（whole/diff/search-replace，依据 aider.chat 文档，推断）；watch 模式可在 IDE 注释驱动 | 已核实（repo-map/git/BYOK）+ 推断（编辑格式） |
| 部署形态 | 终端 CLI（开源，pip 安装） | 已核实 |
| 集成方式 | CLI + git hooks；IDE 内注释驱动 | 已核实 |
| 定价模式 | 开源免费（Apache 2.0） | 已核实 |
| 优势 | Solo 式 Agent + Repo-map + Git 自动提交 + 多编辑格式的内核范式，对 AELA 编排内核有参考 | 综合归纳 |
| 局限 | 无 GUI/IDE 集成、无 MCP GUI、无 HITL 审批 GUI（命令行式），与 AELA 桌面 GUI 差距大 | 推断 |
| 对本项目的参考价值 | 借鉴其 Solo Agent 内核范式（上下文管理 / 编辑格式 / git 工作流），不作为产品形态参照 | 推断 |

#### 2.2.5 B5 - Continue

| 维度 | 内容 | 置信度 |
| --- | --- | --- |
| 产品定位 | 开源配置驱动 AI 编码 Agent（VS Code / JetBrains 扩展） | 已核实 |
| 目标用户 | 需私有化/自托管、多模型灵活切换的团队 | 推断 |
| 核心能力 | Chat、Tab 补全、Edit、Agents、Context Providers、MCP（--mcp）、多模型（Ollama/Mistral/DeepSeek/Qwen/Codestral/OpenAI 适配/OS provider） | 已核实（仓库提交历史） |
| 架构特点 | 配置驱动（config.json / .continueignore / environment.json）；core + gui 分层；支持本地/自托管模型 | 已核实（配置痕迹）+ 推断（分层） |
| 部署形态 | IDE 扩展（开源）；可完全本地 / 自托管 | 已核实 + 推断 |
| 集成方式 | IDE 扩展 API、config.json、MCP | 已核实 |
| 定价模式 | 开源免费（Apache 2.0，推断）；企业提供托管/企业版 | 推断 |
| 优势 | 配置驱动 + 私有化友好，是 AELA「自研底座 / 私有化」路径的直接参照 | 综合归纳 |
| 局限 | Agent 能力较 Cursor/Cline 轻；GUI 体验依赖 IDE | 推断 |
| 对本项目的参考价值 | 作为「配置驱动自托管底座」选项，与 Cline 互补 | 推断 |

### 2.3 关键技术能力横向事实

> 不评分、不排序，仅按能力维度横陈各方案事实。（来源见 §6）

| 能力维度 | B1 Cursor | B2 Windsurf/Devin | B3 Cline | B4 Aider | B5 Continue | 说明 / 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| 部署形态 | 桌面 IDE（闭源） | 桌面 IDE（闭源） | VS Code 扩展/SDK/CLI（开源） | 终端 CLI（开源） | IDE 扩展（开源） | SR-01~10 |
| Agent 自主执行 | ✅ Agent 模式 | ✅ Cascade 自主代理 | ✅ 自主编码 Agent | ✅ Solo 结对 Agent | ⚠️ Agents（较轻） | SR-02/03/05/07/09 |
| 多 Agent 编排 | ⚠️ Cloud Agents/agentic review（非同等编排引擎） | ⚠️ Devin Desktop ACP 多 agent | ❌ 单 Agent | ❌ 单 Agent | ❌ 单 Agent | SR-02/04 |
| 工具调用 / MCP | ✅ stdio/SSE/HTTP + OAuth + Allowlist | ✅ MCP Server（Devin） | ✅ 自定义 MCP 工具 | ❌ 无 MCP GUI | ✅ --mcp | SR-02/04/05/09 |
| HITL / 人工确认 | ✅ 工具审批 + Run Mode（Auto-review） | ⚠️ 终端/网络控制（企业档） | ✅ 每步文件/终端审批 GUI | ⚠️ 命令行式确认 | ⚠️ 配置式 | SR-02/03/05 |
| 多模型 BYOK | ✅ 多模型 | ✅ SWE 系列模型 | ✅ 广泛 BYOK | ✅ 广泛 BYOK（含本地） | ✅ 多模型/本地 | SR-01/03/05/07/09 |
| 成本追踪 | ✅ 用量计费 | ✅ Credits | ✅ token/成本追踪 | ❌ 无内建 | ❌ 无内建 | SR-01/03/05 |
| 安全基线（sandbox/IPC/secret） | ✅ 企业：MCP Allowlist/网络控制/审计 | ✅ 企业：SOC2/私有部署 | ✅ 企业：SSO/审计/私有网络 | ✅ 本地 CLI（无远端） | ✅ 本地/自托管 | SR-02/03/05 |
| 私有化 / 自托管 | ⚠️ 仅 Enterprise | ⚠️ 仅 Enterprise | ✅ Enterprise 自托管/on-prem | ✅ 完全本地 | ✅ 完全本地/自托管 | SR-03/05/07/09 |
| 开源 / 许可证 | ❌ 闭源 | ❌ 闭源 | ✅ Apache 2.0 | ✅ Apache 2.0 | ✅ Apache 2.0（推断） | SR-05/07/09 |

**补充行业基线事实（直接对应 material_digest 冲突点）：**
- **Electron 安全基线（对应 X6 / X12 / ADR-002）**：Electron 官方安全文档明确——进程沙箱（`sandbox: true`）自 20.0.0 起默认开启，且「禁用 contextIsolation 会同时禁用沙箱」；contextIsolation 自 12.0.0 起默认开启，须配合 `nodeIntegration: false`；远程内容默认不启用 Node 集成（防 XSS→RCE）；必须定义 CSP（如 `script-src 'self'`）；**所有 IPC 消息必须校验 `sender` 框架来源**；preload 应通过 `contextBridge` 仅暴露必要 API，禁止暴露 `ipcRenderer`。〔事实，已核实，SR-11〕
- **MCP 安全模型（对应 D20）**：MCP 是连接 AI 应用与外部工具/数据源的开放标准（「AI 应用的 USB-C」），支持 stdio / HTTP 传输；Cursor 对 MCP 的安全实践为——仅安装可信来源、审查权限、限制 API Key 权限、审计关键集成代码、MCP 工具默认需用户审批、企业可配 MCP Allowlist（命令/URL/工具级）+ 网络控制 + Run Mode。〔事实，已核实，SR-02/SR-12〕
- **SDK 本地依赖（对应 X7 / ADR-001）**：Cline 采用 monorepo，通过 `@cline/*` workspace symlinks 同时发布 SDK + 扩展 + CLI（即「monorepo / submodule」式兄弟依赖方案），可作为 AELA ADR-001 Open Questions（A-1/D-3：npm / monorepo / submodule）的直接行业参照。〔事实，已核实，SR-06〕

---

## 3. 对比：对比矩阵与加权评分

> **四段式「对比」段**。在 §2 的事实基础上建立对比矩阵，赋予权重并打分。

### 3.1 对比矩阵

> **每行权重之和 = 1.00**。评估维度与权重根据本次调研问题（Solo 桌面 Agentic Coding 应用，重自主可控与合规）调整，理由见权重列。

| 评估维度 | 权重 | 权重理由 | B1 Cursor | B2 Windsurf | B3 Cline | B4 Aider | B5 Continue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 场景契合度 | 0.30 | AELA 是 Solo 桌面 Agentic Coding 应用，最看重「同类产品形态 + Agent 编排 + 工具调用（MCP）+ HITL」的同构度 | 5 | 4 | 5 | 3 | 4 |
| 技术成熟度 | 0.20 | 产品稳定、生态完善、文档完备程度 | 5 | 4 | 4 | 5 | 4 |
| 集成难度（反向） | 0.15 | AELA 复用/对标其模式的可集成性；分值越高=越易借鉴（越低=闭源难复用） | 4 | 3 | 4 | 4 | 4 |
| 成本（反向） | 0.15 | 采用/对标其能力的成本；分值越高=成本越低（开源零许可 vs SaaS 订阅） | 3 | 3 | 4 | 4 | 4 |
| 合规可控性 | 0.20 | 私有化/自托管/数据安全/开源可审计程度（AELA 为本地桌面应用，天然重可控） | 3 | 2 | 5 | 5 | 5 |
| **加权总分** | **1.00** | — | **4.15** | **3.30** | **4.50** | **4.10** | **4.20** |

**评分标尺**：每项 1~5 分，1 = 严重不符合，3 = 基本满足但存在明显局限，5 = 完美契合。

**加权总分计算明细：**
- B1 Cursor：5×0.30 + 5×0.20 + 4×0.15 + 3×0.15 + 3×0.20 = 1.50 + 1.00 + 0.60 + 0.45 + 0.60 = **4.15**
- B2 Windsurf：4×0.30 + 4×0.20 + 3×0.15 + 3×0.15 + 2×0.20 = 1.20 + 0.80 + 0.45 + 0.45 + 0.40 = **3.30**
- B3 Cline：5×0.30 + 4×0.20 + 4×0.15 + 4×0.15 + 5×0.20 = 1.50 + 0.80 + 0.60 + 0.60 + 1.00 = **4.50**
- B4 Aider：3×0.30 + 5×0.20 + 4×0.15 + 4×0.15 + 5×0.20 = 0.90 + 1.00 + 0.60 + 0.60 + 1.00 = **4.10**
- B5 Continue：4×0.30 + 4×0.20 + 4×0.15 + 4×0.15 + 5×0.20 = 1.20 + 0.80 + 0.60 + 0.60 + 1.00 = **4.20**

### 3.2 评分结论

> 基于 §3.1 加权总分，形成分层结论。每层结论引用得分作为依据。

- **优先借鉴**：**Cline（4.50）** — 适用度评分最高，理由：开源 Apache 2.0、Agent + MCP + HITL + Checkpoints + 成本追踪 + 多模型 BYOK + 企业自托管，与 AELA 能力集高度同构，可直接作为自研/复用参照；**Cursor（4.15）** — 作为头部 SaaS 产品形态与 Agent/MCP/企业管控（SSO/审计/MCP Allowlist/Run Mode）基线参照，场景契合度 5 分。
- **部分借鉴**：**Continue（4.20）** — 借鉴点：配置驱动（config.json / .continueignore）+ 私有化友好的「自研底座」路径，与 Cline 互补；不借鉴的部分：其 Agent 能力较轻、GUI 依赖 IDE，不作为 AELA 主体形态参照。**Aider（4.10）** — 借鉴点：Solo 式 Agent 内核范式（Repo-map 上下文管理、多种编辑格式、Git 自动提交、lint/test 闭环）；不借鉴的部分：纯 CLI 形态、无 GUI/IDE 集成/MCP GUI，与 AELA 桌面 GUI 差距大，仅借鉴内核范式。
- **不借鉴（否决）**：**Windsurf / Devin Desktop（3.30）** — 否决理由：闭源全托管 SaaS、私有化仅 Enterprise 档、合规可控性仅 2 分（最低）；产品已演进为 Devin Desktop（agent fleets），定位偏离个人桌面编码助手；加权总分最低（3.30）。借鉴点（若未来需要算法层参考）：Cascade 的多文件编辑 + 迭代调试 + RAG 代码库索引范式可作编排内核的算法参考，但不作为架构借鉴对象。

### 3.3 方案组合分析

> 调研发现单一方案无法 100% 覆盖 AELA 全部能力，需组合参照。

| 组合方式 | 覆盖哪些能力 | 未覆盖能力 | 组合复杂度 | 总体成本估算 |
| --- | --- | --- | --- | --- |
| 以 **Cline** 开源范式为核心借鉴（Agent + MCP + HITL + Checkpoints + 成本追踪），以 **Cursor** 作头部 SaaS 产品形态/企业管控基线参照，以 **Continue** 的 config-driven 自托管路径作私有化底座选项，**Aider** 的 Solo Agent 内核（repo-map + 编辑格式 + git）作编排内核参考 | Agent 自主执行、MCP 工具、HITL、成本追踪、多模型、私有化/自托管 | AELA 特有的多 Agent 编排（Pipeline/Parallel/Handoff/Pool/GroupChat/Debate/Supervisor/DAG）在标杆中无直接对等（Cursor 有 cloud agents/agentic review 但非同等编排引擎），需 AELA 基于 SDK 自研 | 中（以 Cline 为单一主参照最省） | 以开源参照为主，零许可成本；Cursor 仅作设计基线（不采购） |

---

## 4. 建议：取舍决策支持

> **四段式「建议」段**。基于 §2 事实 + §3 对比，给出可被 `business-architect` 直接采用的建议。**本节是建议而非最终裁决，最终边界由业务架构师冻结。**

### 4.1 自研 / 采购 / 复用边界建议

| 能力项 | 建议方式 | 建议依据 | 候选方案 / 系统 | 关键前提 |
| --- | --- | --- | --- | --- |
| Agent 自主执行 + HITL + 工具调用（MCP）+ Checkpoints + 成本追踪 | 复用（参照 Cline 开源范式自研） | Cline Apache 2.0 同构，AELA 已有完整实现（ReAct + ToolManager + HITL + CostTracker） | Cline 设计范式（B3） | 安全基线不降级（见 R-01/R-02） |
| 多模型 BYOK / Provider 接入 | 复用（已有 ProviderManager） | AELA 已覆盖 OpenAI/Anthropic/Ollama/Gemini；Cline 多 provider 清单可作补全参考 | 现有实现 + Cline provider 清单（B3） | 无 |
| 多 Agent 编排引擎（Pipeline/Parallel/Handoff/Pool/GroupChat/Debate/Supervisor/DAG） | 自研 | 标杆无直接对等；AELA SDK 已提供 OrchestrationService（X9 口径 5/7 模式待裁决） | AELA SDK OrchestrationService | 需先裁决编排模式数（U-04） |
| MCP 工具沙箱 / 权限边界 | 部分自研 + 参照 Cursor 安全模型 | D20 指出 MCP 不经 SecurityService 沙箱；Cursor 已有 MCP Allowlist / Run Mode / 工具审批范式 | Cursor MCP 安全模型（B1, SR-02） | 需补 MCP 工具级 ACL（U-03） |
| 安全基线（sandbox / contextIsolation / IPC 校验 / secret） | 自研加固（参照 Electron 官方最佳实践） | X6（sandbox:false）、X12（~20/37 handler 无校验）、ADR-002 | Electron 安全文档基线（SR-11） | 执行 ADR-002 拆分计划（bridge.ts sandbox:true） |
| 私有化 / 企业自托管 | 复用（参照 Cline/Cursor Enterprise 能力清单做需求基线） | AELA 为桌面本地应用天然私有化；Cline/Cursor Enterprise 提供 SSO/审计/私有网络清单 | Cline Enterprise（B3）/ Cursor Enterprise（B1） | 评估是否需企业 SSO/审计（U-01） |

### 4.2 MVP 范围建议

> 对用户诉求中「生成完整架构方案」的 P0/P1 功能给出调研侧 MVP 可行性判断。（功能清单对齐 AELA 能力集与 material_digest D1/D2。）

| 功能（对齐用户诉求 / AELA 能力） | 建议 MVP？ | 理由 |
| --- | --- | --- |
| R1 Agent 自主执行（ReAct + 工具调用） | ✅ | 标杆 B1/B3 均以此为核心；AELA 已实现（D1 §项目特性） |
| R2 MCP 工具调用（stdio/http） | ✅ | Cline/Cursor 均支持 MCP；AELA 已支持（D1/D3）；但需补沙箱（见 §4.1） |
| R3 HITL 人工确认（Shell 三级 / 文件变更） | ✅ | Cline「每步审批」范式直接印证（B3, SR-05） |
| R4 多 Agent 编排（5/7 模式） | ⚠️ MVP 部分 | 标杆无直接对等；建议 MVP 先落地 Pipeline/Parallel/Handoff，Supervisor/DAG 后置（待裁决 X9） |
| R5 安全基线（sandbox:true + IPC 全校验 + secret fail-closed） | ❌ 完整 MVP 难 | X6/X12 显示 sandbox 仍 false、~20 handler 无校验；需 ADR-002 拆分 + Q-2 补校验，工作量较大，建议作为 P1 安全起步 |
| R6 成本追踪 | ✅ | Cline/Cursor 均有；AELA 已有 CostTracker（D2 §10） |
| R7 私有化 / 自托管 | ✅ | 桌面本地应用天然私有化（B3/B4/B5 均印证本地优先） |
| R8 上下文感知对话 / 后台 Agent（D21/D22） | ❌（完整版） | 设计已确认但属增强，建议 MVP 后迭代 |

### 4.3 技术栈参考建议

| 技术层 | 推荐方案 | 替代方案 | 选择理由 |
| --- | --- | --- | --- |
| 桌面框架 | Electron 33（沿用） | Tauri | AELA 已基于 Electron；标杆 Cursor/Windsurf 同为 Electron/VSCode 系，生态成熟（SR-01/03） |
| Agent 编排 / 工具调用 | 复用 AELA SDK + 参照 Cline MCP/Agent 范式 | 自研 MCP 客户端 | 与 B3 同构，可直接对齐 HITL + Checkpoints 设计 |
| 安全基线 | 参照 Electron 官方安全文档（sandbox:true + contextIsolation + IPC validateSender + zod 入参校验） | 仅 CSP | X6/X12 直接要求；SR-11 为权威基线 |
| 多模型接入 | 沿用 ProviderManager + 参照 Cline provider 清单 | LangChain | AELA 已覆盖主流 provider；B3 清单可作补全参考 |
| 状态管理 | Zustand slice（沿用，ADR-003） | Redux | 已采用且经 ADR-003 接受 |
| 私有化底座 | 参照 Continue config-driven 自托管路径 | 纯云 SaaS | AELA 本地桌面天然私有化，B5 提供配置驱动参照 |

---

## 5. 风险与待确认项

> **四段式「风险」段**。列出调研中发现的主要风险、不确定信息、待业务架构师进一步裁决的依赖项。

### 5.1 主要风险清单

| 编号 | 风险描述 | 触发条件 | 影响范围 | 严重程度 | 缓解建议 |
| --- | --- | --- | --- | --- | --- |
| R-01 | `sandbox:false` 下若渲染进程被 XSS 注入，攻击者可访问 Node.js API（X6 / ADR-002） | 启用 sandbox:false 且存在 XSS 漏洞 | RCE 风险，核心安全边界失效 | 高 | 执行 ADR-002 拆分（bridge.ts sandbox:true + capabilities.ts 隔离在独立进程）；生产环境 CSP 收紧 `'self'`（SR-11） |
| R-02 | ~20/37 IPC handler 无 zod 入参校验（S-3 / X12） | 恶意/异常 IPC 入参 | 注入 / 越权调用主进程服务 | 高 | 按 Q-2/T5 补全 zod（D12 已部分执行）；目标 100% handler 校验（validateInput + wrap） |
| R-03 | SDK 本地 `file:` 依赖跨机器不可移植 + breaking change 穿透（X7 / ADR-001） | SDK 破坏性变更 / CI 未先构建 SDK dist | 构建失败 / 类型漂移 / 本地不可复现 | 中 | CI typecheck 类型漂移检测 + Adapter 层（EvalSuite/ABTest/Batch）+ 稳定后切 semver（ADR-001 未来演进）；参照 Cline monorepo（SR-06） |
| R-04 | MCP 工具不经 SecurityService 沙箱（D20） | 用户添加恶意 MCP server | 工具越权执行 / 数据外泄 | 中 | 仅允许用户显式添加（非自动发现）+ 参照 Cursor MCP Allowlist / 工具审批 / Run Mode 补工具级 ACL（SR-02） |
| R-05 | 编排模式数口径冲突（X9：5 vs 7） | 文档不一致导致架构边界不清 | 高层架构文档 / 编排边界定义偏差 | 低 | 由 business-architect 在高层架构阶段裁决（以 SDK OrchestrationService 实际实现为准） |

### 5.2 待确认项（需主理人 / 业务方反馈）

| 编号 | 待确认项 | 不确定性说明 | 若无法确认的备选路径 |
| --- | --- | --- | --- |
| U-01 | AELA 是否需支持企业 SSO / 审计 / 私有部署？ | 用户诉求未明确；参照 B1/B3 Enterprise 能力清单，属可选增强 | 先不做，保留扩展点（SSO/审计接口预留） |
| U-02 | SDK 依赖最终采用 `file:` 本地 / npm semver / monorepo（submodule）？ | ADR-001 未冻结；X7 披露文档路径与实际仓库不一致；Cline 用 monorepo workspace symlinks（SR-06） | 先维持 `file:` + `AELA_SDK_PATH` 回退，SDK 稳定后切 `^1.0.0` semver（ADR-001 演进路径） |
| U-03 | MCP 工具是否需引入 ACL / 沙箱？ | D20 指当前无 ACL；行业（Cursor）已有工具级 Allowlist | 参照 Cursor 补工具级 allowlist + 网络控制（不阻断 MVP，P1 安全起步） |
| U-04 | 编排模式以 5 还是 7 为准落地？ | X9 文档冲突（D4 文字 5 vs D2/D3 记 7） | 以 SDK OrchestrationService 实际实现（7 模式）为准，文档口径后续统一 |

### 5.3 需业务架构持续关注的依赖项

| 编号 | 依赖项 | 说明 | 建议关注阶段 |
| --- | --- | --- | --- |
| D-01 | sandbox 拆分（ADR-002）与 IPC 全校验（Q-2）的安全边界 | 影响渲染/主进程隔离契约 | 安全设计（G5） |
| D-02 | 多 Agent 编排边界（Supervisor / DAG）冻结 | 决定 SDK OrchestrationService 暴露面 | 高层架构（G3）§架构边界 |
| D-03 | SDK 依赖形态决策（A-1 / D-3） | 影响构建 / 发布 / CI 流程 | 系统架构（G4）/ 部署设计（G5） |
| D-04 | MCP 工具 ACL 设计 | 需与安全设计协同，避免工具越权 | 安全设计（G5） |

---

## 6. 关键来源目录

> 集中列出全部调研所使用的公开资料、官方文档、社区仓库、分析报告等。每条来源不低于 URL 粒度，关键数据指定来源段落/位置。

**硬指标**：≥ 3 条来源，覆盖每家标杆 ✅；关键数据（定价、安全基线、MCP 机制）均指定来源位置 ✅。

| 编号 | 来源类型 | 标题 / 名称 | URL / 路径 | 相关章节 | 最后访问日期 |
| --- | --- | --- | --- | --- | --- |
| SR-01 | 官方定价页 | Cursor · Pricing | https://cursor.com/pricing | B1, §2.2.1, §3 | 2026-07-07 |
| SR-02 | 官方文档 | Cursor Docs · Model Context Protocol | https://cursor.com/docs/context/mcp | B1, §2.3, §4.1, R-04, U-03 | 2026-07-07 |
| SR-03 | 行业分析 | A complete Windsurf overview (2025): Features, pricing & alternatives | https://www.eesel.ai/blog/windsurf-overview | B2, §2.2.2, §3 | 2026-07-07 |
| SR-04 | 官方博客 | Devin Desktop (Windsurf is now Devin Desktop) | https://devin.ai/blog/windsurf-is-now-devin-desktop | B2, §2.2.2, §2.3 | 2026-07-07 |
| SR-05 | 官方市场页 | Cline - Visual Studio Marketplace | https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev | B3, §2.2.3, §2.3, R-03 | 2026-07-07 |
| SR-06 | 开源仓库 | cline/cline (GitHub) | https://github.com/cline/cline | B3, §2.2.3, §2.3, R-03, U-02 | 2026-07-07 |
| SR-07 | 开源仓库 | Aider-AI/aider (GitHub) | https://github.com/Aider-AI/aider | B4, §2.2.4, §2.3 | 2026-07-07 |
| SR-08 | 官方文档 | Aider Documentation | https://aider.chat/docs/ | B4, §2.2.4 | 2026-07-07 |
| SR-09 | 开源仓库 | continuedev/continue (GitHub) | https://github.com/continuedev/continue | B5, §2.2.5, §2.3 | 2026-07-07 |
| SR-10 | 官方文档 | Continue 概述（中文文档） | https://docs.continue.org.cn/getting-started/overview | B5, §2.2.5 | 2026-07-07 |
| SR-11 | 官方文档 | Electron 安全最佳实践（Security tutorial） | https://www.electronjs.org/docs/latest/tutorial/security | §2.3, §4.1, §4.3, R-01 | 2026-07-07 |
| SR-12 | 官方规范 | Model Context Protocol · Introduction | https://modelcontextprotocol.io/introduction | §2.3, R-04 | 2026-07-07 |
| SR-13 | 上游基线 | AELA - 资料摘要 v1.0（material_digest.md，G1 通过） | E:/codecast/AELA/.workbuddy/output/material_digest.md | 全文（X1–X12 / D20 / ADR-001·002 / D21·D22） | 2026-07-07 |

> 内部资料（已含于 SR-13）：ADR-001 SDK 本地依赖策略（D15）、ADR-002 Sandbox 妥协（D16）、mcp-tool-scope（D20）、background-agent 设计（D21）、context-aware-conversation 设计（D22）、project-evaluation（D9，含 X1–X12 冲突与综合健康度 74 分）。

---

## 7. 硬指标清单

> 汇总本模板所有章节的硬指标，供自动校验与人工审核使用。

| 章节 | 硬指标项 | 当前状态 | 备注 |
| --- | --- | --- | --- |
| §1 | 调研问题已收敛为 ≥ 3 条可执行问题 | ✅ | Q1–Q5 共 5 条 |
| §2.1 | 标杆系统 ≥ 3 家，含 ≥ 1 家头部 SaaS | ✅ | B1 Cursor + B2 Windsurf 为头部 SaaS |
| §2.1 | 标杆系统 ≥ 1 家开源或自研代表 | ✅ | B3 Cline + B4 Aider + B5 Continue 均为开源 |
| §2.2 | 每家标杆有独立详述卡片 | ✅ | B1–B5 全部 10 维度详述 |
| §2.3 | 关键能力横向事实无遗漏 | ✅ | 10 能力维度横陈 + Electron/MCP/SDK 基线补充 |
| §3.1 | 对比矩阵含 5 维度 + 权重 + 评分 | ✅ | 权重之和 = 1.00（0.30+0.20+0.15+0.15+0.20） |
| §3.2 | 评分结论含优先/部分/不借鉴三层 | ✅ | 优先：Cline/Cursor；部分：Continue/Aider；不借鉴：Windsurf |
| §4.1 | 自研/采购/复用边界有明确建议 | ✅ | 6 项能力边界建议 |
| §4.2 | MVP 范围建议与用户诉求对齐 | ✅ | R1–R8 对齐 AELA 能力集 |
| §5.1 | 主要风险 ≥ 3 条，有缓解建议 | ✅ | R-01~R-05 共 5 条，均含缓解 |
| §6 | 关键来源可追溯（URL / 章节） | ✅ | SR-01~SR-13，覆盖每家标杆 |
| 全文 | 明确区分事实 / 推断 / 建议 / 风险 | ✅ | 置信度标注 + 四段式结构 |
| 全文 | 不存在编造来源或占位符 | ✅ | 来源均可溯；全文无尖括号占位符、无示例类前缀、无待填日期、无待核验标记残留 |

---

## 8. 附录：中间确认自检报告

> 依据《阶段内中间确认协议》§2.4，在 §1 / §2.1 / §3.1 / §5.2 四个关键章节产出后显式插入自检（先 §2.1 判定，再 §2.3 反向验证 3 问）。结论：**四次自检均「未命中」，无需发起 `[中间确认]`**，理由与证据如下。

### 自检 1（§1 调研问题收敛后）

- **§2.1 方案分歧判定**：未命中。Q1–Q5 由用户诉求「围绕 AI 编码助手 / Agentic Coding 工具赛道对标」直接派生，且主理人已明确方向（桌面/IDE 集成 + Agent 编排 + 工具调用）。收敛属 research-analyst 专业职责，不存在 ≥2 种需用户裁决的不可调和方案，亦不影响下游不可逆决策。
- **§2.3 反向验证 3 问**：
  - Q1（返工成本）：若 3 月后推翻，返工范围 = §1 表格（S1–S5 种子 + Q1–Q5 收敛），约 1 个小节；切换成本 ≈ 0.5 人天（仅重写收敛表，不影响下游已冻结物）。**可控**。
  - Q2（用户/客户/监管感知）：§1 为内部调研问题清单，不暴露给用户/客户/监管，无感知点。**感知不到**。
  - Q3（与用户诉求一致）：用户诉求原文「围绕『AI 编码助手 / Agentic Coding 工具』这一赛道，对标同类桌面/IDE 集成、具备 Agent 编排与工具调用能力的产品/方案」。Q1–Q5 完全对齐。**一致**。
  - 判定：Q1 可控 + Q2 无感知 + Q3 一致 → **未命中 §2.2**，无需发起。

### 自检 2（§2.1 标杆清单后）

- **§2.1 方案分歧判定**：未命中。标杆候选（Cursor/Windsurf/Cline/Aider/Continue）遵循「头部 SaaS + 开源/自研代表」硬指标与用户诉求赛道方向，属 research-analyst 专业选样；5 家覆盖全面，取舍不影响下游不可逆决策，无 ≥2 种需用户裁决的不可调和方案。
- **§2.3 反向验证 3 问**：
  - Q1（返工成本）：推翻返工 = §2.1 清单 + §2.2 详述 + §2.3 横向事实 + §3 矩阵（约 3 节）；切换成本 ≈ 1–2 人天（重选标杆并重写对比）。属研究产出，非下游已冻结物。**可控**。
  - Q2（感知）：标杆清单为内部参考，用户/客户/监管无感知。**无感知**。
  - Q3（一致）：均属 AI 编码助手 / Agentic Coding 桌面/IDE/CLI 赛道，含 Agent 编排 + 工具调用，与用户诉求一致。**一致**。
  - 判定：**未命中 §2.2**，无需发起。

### 自检 3（§3.1 设定权重前）

- **§2.1 方案分歧判定**：未命中。权重（场景契合度 0.30 / 技术成熟度 0.20 / 集成难度 0.15 / 成本 0.15 / 合规可控性 0.20）为 research-analyst 按项目特征（Solo 桌面 Agentic Coding、重自主可控与合规）设定的合理默认加权，符合模板「权重可根据本次调研问题调整但须给出理由」；无 ≥2 种需用户裁决的权重方案，偏差不导致下游不可逆。
- **§2.3 反向验证 3 问**：
  - Q1（返工成本）：推翻返工 = §3.1 矩阵权重微调 + 重算 §3.2 总分；切换成本 ≈ 0.5 人天。**可控**。
  - Q2（感知）：权重为内部评估参数，用户/客户/监管无感知。**无感知**。
  - Q3（一致）：权重服务于「场景契合度最高」即贴合用户诉求赛道。**一致**。
  - 判定：**未命中 §2.2**，无需发起。

### 自检 4（§5.2 整理待确认项时，最后一次完整复核）

- **§2.1 方案分歧判定**：未命中。U-01~U-04 为「因外部信息不可得 / 上游未冻结而暂不能确认」的事实项，已显式列为待确认项交主理人/业务方，非 research-analyst 可单方裁决，且不影响下游不可逆决策（仅作为依赖项提示）。
- **§2.3 反向验证 3 问**：
  - Q1（返工成本）：推翻 = 修订 §5.2 表格条目；切换成本 ≈ 0.25 人天。**可控**。
  - Q2（感知）：待确认项本身是内部待决清单，不直接暴露给用户/客户/监管（其中 U-01 企业私有化若未来对外承诺则跨界，当前仅为待确认、不承诺）。**当前无感知**。
  - Q3（一致）：待确认项均源自用户诉求赛道内的 AELA 自身架构待决点（SDK 依赖 / 编排模式数 / MCP ACL），属主理人指明「调研可着力的对比点」，与诉求一致。**一致**。
  - 判定：**未命中 §2.2**，无需发起。

> 综上，四次自检均未触发中间确认；本报告所有加权打分与建议均明确标注为「建议」，最终业务边界由 business-architect 冻结。
