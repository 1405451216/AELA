# 后台常驻 Agent 设计

> 日期：2026-07-05
> 状态：已确认
> Phase: P0

## 1. 设计理念

> Agent 不应等用户发现并描述问题，它应该在后台持续监控、主动修复、通知确认。

## 2. 架构

### 核心组件

| 组件 | 职责 |
|------|------|
| `BackgroundAgentService`（主进程） | 订阅变更事件，检测问题，触发修复，管理 diff |
| `FileWatcher` | chokidar 监听工作区（排除 `node_modules/.git/build/dist`） |
| `TerminalWatcher` | 继承 TerminalService 输出，检测错误模式 |
| `DiagnosticWatcher` | 订阅 LSP 诊断变化 |
| `MicroAgent` | 轻量循环 Agent（5s 超时、单文件修复、只读+受限写） |
| `DiffStore`（渲染进程） | 管理 diff 列表，接受/撤销操作 |
| `DiffCard`（UI 组件） | Chat 中的 diff 卡片，接受/拒绝操作 |

### 安全机制

| 机制 | 实现 |
|------|------|
| 沙箱执行 | MicroAgent 在独立 Session 中运行 |
| 超时控制 | 5s Agent 超时、10s 全局超时 |
| 范围限制 | 单次只能修改触发文件 + 最多 1 个关联文件 |
| 预算控制 | 每小时 Token 上限（复用 CostTracker） |
| 撤销机制 | CheckpointService 修复前自动创建 checkpoint |
| 用户确认 | diffCard pending → accepted/rejected 后才算完成 |

## 3. 事件流

### 触发源

| 事件 | 来源 | 检测逻辑 |
|------|------|----------|
| 文件保存 | FileWatcher | 检查 LSP 诊断 |
| 终端输出 | TerminalWatcher | 正则匹配错误模式 |
| Git 变更 | Git status | 关联文件潜在问题 |
| LSP 诊断 | DiagnosticWatcher | TS/ESLint 错误 |

### 状态机

```
[触发事件] → BackgroundAgentService
     │
     ├─ 检测到问题 → 收集上下文 → MicroAgent.run()
     │                       │
     │                       ├─ 修复成功 → DiffCard(pending)
     │                       ├─ 超时 → Toast notification
     │                       └─ 不需要修复 → 静默
     │
     └─ 无问题 → 结束


DiffCard 状态:
pending → accepted (用户确认，Checkpoint 应用)
      → rejected (用户拒绝，回滚修改)
```

## 4. MicroAgent 设计

### 工具集（精简权限）

```
✅ read_file, list_files, search_codebase
✅ edit_file（仅限触发文件 + 1 关联文件）
❌ delete_file, execute_command, write_file（新建）
❌ MCP 工具
```

### 执行约束

- 5s Agent 超时
- 单次最多 1 个文件修改
- Token 上限 2000 tokens/run
- 每小时运行上限 20 次

### 修复协议

MicroAgent 接收结构化 prompt：
```
你是一个精准的修复 Agent。任务：修复以下文件的诊断错误。
约束：只修改当前文件，不新建文件，不删除文件，不执行命令。
时限：5 秒内完成。

文件: {filePath}
错误: {diagnostics}
上下文: {最近 50 行代码}
```

## 5. 文件结构

```
src/main/services/BackgroundAgentService.ts  — 核心服务
src/main/services/MicroAgent.ts              — 轻量修复 Agent
src/renderer/src/components/chat/DiffCard.tsx — diff 接受/拒绝卡片
src/renderer/src/stores/diffStore.ts         — diff 状态管理
test/services/BackgroundAgentService.test.ts
test/services/MicroAgent.test.ts
```

## 6. IPC 通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `bg-agent:status` | 主→渲染 | 运行状态变化 |
| `bg-agent:diff` | 主→渲染 | 推送 pending diff |
| `bg-agent:accept` | 渲染→主 | 用户接受修改 |
| `bg-agent:reject` | 渲染→主 | 用户拒绝修改 |

## 7. 实施计划

### Phase 1: BackgroundAgentService 核心（2-3 天）
- chokidar 配置 + TerminalWatcher 集成
- MicroAgent 基础修复 loop
- Checkpoint 集成

### Phase 2: DiffCard UI（1-2 天）
- diffStore + DiffCard 组件
- IPC 通道注册
- Toast 通知集成

### Phase 3: 触发源集成（1-2 天）
- LSP DiagnosticWatcher
- Git 变更监听
- 错误模式正则

总计: 4-7 天
