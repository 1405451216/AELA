# ADR-004: IPC Misc 拆分决策

| 字段 | 值 |
|------|-----|
| **状态** | 接受 (Accepted) — 已执行 |
| **日期** | 2026-07-01 |

## 上下文

`src/main/ipc/handlers/misc.ts` 在 SDK Phase 1-4 集成过程中膨胀至 **964 行 / 154 个 `ipcMain.handle` 注册**，承载 MCP 管理、遥测、调试器、终端、预览、Wiki、测试生成、代码审查等 20+ 个不同域的职责，是全应用 50%+ 通道的"兜底"文件。

## 决策

将 `misc.ts` 按 IPC 通道域拆分为 15 个独立的 handler 文件。

## 拆分映射

| 新文件 | 域 | 通道数 |
|--------|-----|--------|
| `handlers/mcp.ts` | MCP 管理 | 9 |
| `handlers/telemetry.ts` | 遥测 | 5 |
| `handlers/debugger.ts` | 调试器 | 6 |
| `handlers/terminal.ts` | 终端 | 8 |
| `handlers/preview.ts` | 预览 | 9 |
| `handlers/wiki.ts` | 仓库 Wiki | 4 |
| `handlers/multifile.ts` | 多文件编辑 | 3 |
| `handlers/testgen.ts` | 自动测试生成 | 3 |
| `handlers/hookConfig.ts` | Hook 配置 | 7 |
| `handlers/codeReview.ts` | 代码审查 | 3 |
| `handlers/subagent.ts` | Sub-Agent 隔离 | 4 |
| `handlers/screenshot.ts` | 截图分析 | 3 |
| `handlers/img2code.ts` | 图片转代码 | 5 |
| `handlers/resilience.ts` | 弹性/容错 | 4 |
| `handlers/toolLearning.ts` | 工具学习 | 9 |

### 保留在 misc.ts 的通道（约 60 个）

跨域/高频小通道留在 `misc.ts`：
- `config:*`、`metrics:*`、`cost:*`、`context-window:*`
- `prompt:*`（含 Few-Shot 权重）、`planning:*`、`reflection:*`
- `hitl:*`、`multimodal:*`、`adaptive:*`
- `agent-config:*`、`builtin-tools:*`、`tool-cache:*`、`rag:*`
- `anomaly:*`、`cost:analysis`、`metrics:trend`、`sdk:get-info`

## 理由

1. **单一职责**：每个 handler 文件对应一个域
2. **可维护性**：修改 MCP 管理器不影响遥测/终端代码
3. **可测试性**：小文件更易编写和维护单元测试
4. **可扩展性**：新增域只需添加文件 + 在 `ipc/index.ts` 注册

## 执行结果

- misc.ts：964 行 → 472 行（-51%）
- 新增 15 个 handler 文件
- `ipc/index.ts`：添加 15 个 register 调用
- 全量 `typecheck` / `lint` / `test` 通过
