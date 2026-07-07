# 安全沙箱可验证性设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

Agent 行为不可见、不可回溯，用户对自动化操作缺乏信任。

## 方案

**操作录像 + 渐进式权限 + 审计导出**，三管齐下建立"可验证的安全感"。

## 架构

```
Agent Action
  └── SandboxRecorder（新建）
        ├── 记录 → SQLite（recording_{run_id}.db）
        │     ├── action_log 表 { seq, type, payload, result, timestamp }
        │     └── replay_index 表 { frame_seq, summary }
        ├── 回放 → SandboxReplayView（新建 UI）
        │     ├── 时间轴 scrubber
        │     ├── 逐帧查看（命令/文件读写/API 调用）
        │     └── 一键回滚（逆向执行）
        └── 导出 → JSONL 文件（每条 action 一行）
```

## 操作录像

### 录制内容

| 操作类型 | 录制字段 |
|----------|----------|
| terminal.exec | { command, cwd, stdout, stderr, exitCode, duration } |
| file.read | { path, size, hash } |
| file.write | { path, size, hash_before, hash_after, diff_preview } |
| sdk.tool_call | { tool_name, arguments, result_summary } |
| llm.complete | { model, input_tokens, output_tokens, latency } |

### 存储

- **运行时 SQLite**：每个 Agent Run 一个 `recording_{run_id}.db`，存储在 `userData/sandbox-recordings/`
- **自动清理**：保留最近 30 天，超期自动归档到 `archive/` 目录
- **JSONL 导出**：用户可一键导出某次运行为 `.jsonl`，便于外部分享/审计

### 回放 UI

`SandboxReplayView`（新 View）：

- 左侧：时间轴 + 操作列表（按类型图标区分）
- 右侧：选中操作的详情面板（命令输出 / 文件 diff / 工具参数）
- 底部：播放控制（暂停/步进/速度调节）
- 顶部：回滚按钮（逆向执行，恢复文件/撤销命令）

## 渐进式权限

首次遇到敏感操作时弹窗确认：

| 敏感级别 | 操作 | 默认行为 |
|----------|------|----------|
| 低 | 读取项目文件 | 允许，记录 |
| 中 | 写入文件 / 执行测试命令 | 弹窗确认，记住选择 1 小时 |
| 高 | 执行 shell / 安装包 / 网络请求 | 每次确认，显示完整命令 |
| 极高 | 删除文件 / 修改 .git / 外发数据 | 永久确认 + 输入 "CONFIRM" |

**权限记忆**：用户选择"允许同类操作"后，写入 `PermissionMemory { pattern, scope, expiresAt }`，下次匹配到则自动放行。

## 审计导出

- 格式：JSONL（每行一条 action 记录）
- 内容：时间戳、操作类型、参数摘要、结果状态、风险级别
- 用途：合规审计、团队 review、事故回溯

## 文件变化

| 文件 | 变化 |
|------|------|
| `src/main/services/SandboxRecorder.ts` | **新建**：录制 + 查询 + 回滚 + 导出 |
| `src/main/services/PermissionManager.ts` | **新建**：渐进式权限 + 记忆 |
| `src/renderer/src/components/SandboxReplayView.tsx` | **新建**：回放 UI |
| `src/renderer/src/components/sandbox/PermissionDialog.tsx` | **新建**：权限确认弹窗 |
| `src/renderer/src/components/sandbox/ReplayTimeline.tsx` | **新建**：时间轴组件 |
| `src/main/ipc/handlers/sandbox.ts` | **新建**：`SANDBOX_LIST` / `SANDBOX_REPLAY` / `SANDBOX_EXPORT` / `SANDBOX_PERMISSION` IPC |
| `src/shared/types/sandbox.ts` | **新建**：`SandboxAction / PermissionRecord / RecordingSummary` |
| `AgentService.ts` | 扩展：每个 action 调用 `SandboxRecorder.record()` |
| `CommandGuard.ts` | 扩展：高敏感命令前调 `PermissionManager.check()` |

## 回滚实现

- 文件写操作：从 `hash_before` 恢复（内容寻址存储在 `userData/sandbox-snapshots/`）
- 命令执行：提供"撤销命令"（如 `git checkout -- .` 撤销文件变更）
- 不可逆操作（如 `rm`）：提前警告 + 快照备份

## 风险

- 录制性能开销 → 异步写入 SQLite，不阻塞 Agent 主循环
- 快照存储膨胀 → 仅保留写操作的前后快照，30 天自动清理
- 权限弹窗疲劳 → 提供"信任此项目"模式，降低已确认项目的弹窗频率

## 测试策略

1. 验证 Agent 操作被完整录制
2. 验证回放 UI 可逐帧查看
3. 验证文件回滚恢复原内容
4. 验证权限弹窗按级别触发
5. 验证 JSONL 导出格式正确
6. 验证 30 天自动清理
