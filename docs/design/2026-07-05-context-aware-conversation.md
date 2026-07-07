# AELA 上下文感知智能对话设计

> 日期：2026-07-05
> 状态：已确认

## 1. 设计理念

> **Agent 不应该等用户描述问题，它应该已经看到了问题。**

核心范式转变：用户从"我需要去告诉 Agent 发生了什么"变为"Agent 已经知道了，只需要确认下一步"。

## 2. 系统架构

```
┌──────────────────────────────────────────────────────────────────┐
│  Renderer Process (React)                                          │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Editor Context Bridge │  │  Chat Interface                   │ │
│  │  - 活跃文件/选中追踪   │  │  - 智能输入辅助 (@file, #error)  │ │
│  │  - 终端输出监听       │  │  - 内嵌 Agent 活动卡片           │ │
│  │  - Git diff 监听      │  │  - 内容块流式渲染               │ │
│  │  - LSP 诊断监听       │  │  - 消息虚拟化                    │ │
│  └──────────┬───────────┘  └───────────────┬──────────────────┘ │
│             │           ContextBridge         │                     │
│             └───────────────┬────────────────┘                     │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ IPC (context:sync / context:change)
┌─────────────────────────────┼──────────────────────────────────────┐
│  Main Process               ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  ContextCollector (新增)                                      │ │
│  │  - 聚合编辑器/终端/Git/LSP 实时状态                           │ │
│  │  - 生成 System Context Block                                  │ │
│  │  - 上下文变化时触发 Agent 预推理                              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  AgentHookFactory (扩展)                                      │ │
│  │  - before_tool/after_tool → 推送 activity events               │ │
│  │  - before_llm/after_llm → 推送 LLM 调用轮次                   │ │
│  │  - 新增 IPC: agent:activity                                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  SessionStore (扩展)                                          │ │
│  │  - branchFrom(sessionId, messageId) → 会话分支                │ │
│  │  - editMessage(messageId, content) → 历史编辑                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 上下文感知层

### 3.1 自动感知的上下文

| 来源 | 数据 | 注入时机 |
|------|------|----------|
| Monaco Editor | 当前文件路径、光标位置、选中文本 | 用户发送消息时 |
| 终端面板 | 最近 N 条 Shell 命令及输出 | 工具调用前 |
| Git 状态 | 未暂存文件列表、diff 摘要 | 上下文变化时 |
| LSP 诊断 | TypeScript/ESLint 错误列表 | Agent 推理前 |
| 文件树 | 项目结构、最近修改文件 | Session 初始化时 |

### 3.2 上下文注入机制

```
Agent Send Message
       │
       ▼
ContextCollector.gather()
       │
       ├── 轻量上下文（每条消息携带）
       │   ├── activeFile: { path, cursorLine }
       │   └── terminalTail: last 3 commands
       │
       └── 重度上下文（仅 change 时触发）
           ├── gitStatus: { modifiedFiles, diff }
           ├── diagnostics: { errors, warnings }
           └── projectStructure: file tree
```

### 3.3 智能输入辅助

在 InputBox 中实现：

- `@filename` → 模糊匹配当前工作区文件，插入文件路径+内容
- `#error` → 引用 LSP 诊断面板第一条错误
- `#terminal` → 引用最近终端输出
- `Ctrl+.` → 对当前选中代码触发快速修复 Agent（类似 Cursor Quick Fix）

### 3.4 实现模块

**新增文件**：
- `src/main/services/ContextCollector.ts` — 上下文聚合服务
- `src/preload/api/context.ts` — 上下文 API 桥接
- `src/renderer/src/components/chat/ContextBar.tsx` — 上下文指示器 UI
- `src/renderer/src/components/chat/SmartInput.tsx` — 智能输入辅助
- `src/renderer/src/stores/contextStore.ts` — 上下文状态管理

## 4. 对话体验层

### 4.1 Agent 活动内嵌展示

在 Assistant MessageBubble 中内联显示 Agent 执行过程：

```
┌─────────────────────────────────────────────────────────────┐
│ 🤖 Assistant                                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔧 读取 src/index.ts          ✅ 120 行       2ms       │ │
│ │ 🔧 执行 npm test               ✅ 全部通过    3.2s      │ │
│ │ 💭 分析测试失败原因... → 定位到 handleRequest 函数       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ 已定位到问题根因，修复了 handleRequest 中的空指针异常：      │
│ ```diff                                                     │
│ - const result = data.items.find(x => x.id === id)          │
│ - return result.value                                       │
│ + const result = data.items.find(x => x.id === id)          │
│ + return result?.value ?? defaultValue                      │
│ ```                                                         │
└─────────────────────────────────────────────────────────────┘
```

**新增组件**：
- `src/renderer/src/components/chat/ToolCallCard.tsx` — 工具执行卡片
- `src/renderer/src/components/chat/ActivityTimeline.tsx` — 时间线容器

### 4.2 流式分块渲染

将流式 `string` 存储改为 `contentBlock[]` 分块数组：

```typescript
interface ContentBlock {
  id: string
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'tool_call'
  content: string
  metadata?: Record<string, unknown>
}
```

**修改文件**：
- `src/renderer/src/stores/streaming.ts` — 数据模型升级
- `src/renderer/src/components/chat/MessageBubble.tsx` — 分块渲染

### 4.3 消息虚拟化

超过 50 条消息时启用虚拟滚动。

**新增**：
- `src/renderer/src/components/chat/VirtualMessageList.tsx`

### 4.4 对话控制

| 功能 | 实现方式 |
|------|----------|
| 优雅中断 | `AbortSignal` → 等待当前工具完成 → 保存 partial message |
| 历史编辑 | `messagesStore.editMessage()` → invalidate 后续消息 |
| 消息分支 | `sessionsStore.branchFrom()` → 创建 fork session |

## 5. 数据流设计

### 5.1 上下文同步流程

```
Editor/Terminal/Git/LSP (Renderer)
    │ 用户操作触发
    ▼
ContextBridge (Renderer Preload)
    │ ipcRenderer.send('context:change', data)
    ▼
ContextCollector (Main)
    │ 聚合 → 去重 → 生成 ContextBlock
    ▼
AgentService.runStream()
    │ 注入 system prompt
    ▼
Agent 推理 + 工具调用
    │ 流式事件
    ▼
Renderer → 内联展示
```

### 5.2 Agent 活动事件流

```
AgentHookFactory (Main)
    │ hook 触发
    ▼
ipcMain.send('agent:activity', ActivityEvent)
    ▼
Renderer activityStore
    ▼
ToolCallCard / ActivityTimeline 渲染
```

### 5.3 ActivityEvent 类型

```typescript
type ActivityEvent =
  | { type: 'tool_start'; toolName: string; args: string; id: string }
  | { type: 'tool_end'; toolName: string; duration: number; isError: boolean; id: string }
  | { type: 'reasoning'; content: string; turn: number }
  | { type: 'context_update'; files: string[]; diagnostics: number }
  | { type: 'agent_thought'; thought: string }
```

## 6. 实施计划

### Phase 1: 流式渲染优化（1-2 天）
- streamingStore 升级 contentBlock[]
- MessageBubble 分块渲染
- 消息虚拟化列表

### Phase 2: Agent 内联活动（2-3 天）
- AgentHookFactory 扩展 activity 事件
- ToolCallCard 组件
- activityStore + ActivityTimeline
- IPC agent:activity 通道

### Phase 3: 上下文感知（2-3 天）
- ContextCollector 服务
- SmartInput (@file, #error, Ctrl+.)
- ContextBar UI
- 编辑器/终端/Git/LSP 桥接

### Phase 4: 对话控制（1-2 天）
- 优雅中断机制
- 历史消息编辑
- 会话分支

总计约 6-10 天开发量。

## 7. 成功指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 长响应渲染帧率 | <15fps (2000+ token) | ≥30fps |
| Agent 操作可见性 | 仅最终结果 | 每步可见 |
| 上下文手动粘贴次数 | 高 | 降低 70% |
| 中断恢复时间 | 立即终止（状态丢失） | <2s 优雅保存 |

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| ContextCollector 性能 | 增量更新 + debounce + 限制上下文大小 |
| contentBlock 兼容性 | 渐进增强：旧消息 string → 新消息 contentBlock |
| 虚拟化复杂度 | 仅在消息数>50 时启用 |
| IPC 事件过多 | 事件缓冲 + requestAnimationFrame 合并 |
