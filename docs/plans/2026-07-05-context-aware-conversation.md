# 上下文感知智能对话实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现 AELA 上下文感知智能对话体验 — Agent 自动感知编辑上下文、流式响应渲染优化、Agent 活动内联展示、对话控制（中断/编辑/分支）。

**Architecture:** 三层叠加：ContextCollector（主进程聚合编辑器/终端/Git/LSP 状态）→ AgentHookFactory（扩展 hook 推送 activity 事件）→ Renderer（contentBlock 分块渲染 + 虚拟化 + 智能输入辅助）。

**Tech Stack:** Electron 33, React 18, Zustand, TypeScript 5.6, react-window（虚拟化）

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/main/services/ContextCollector.ts` | 主进程：聚合编辑上下文，生成 ContextBlock |
| `src/main/ipc/context.ts` | IPC 注册：context:sync / context:change |
| `src/preload/api/context.ts` | Preload桥接：expose context API |
| `src/renderer/src/stores/contextStore.ts` | 渲染进程：上下文状态管理 |
| `src/renderer/src/stores/activityStore.ts` | 渲染进程：Agent 活动事件管理 |
| `src/renderer/src/components/chat/ToolCallCard.tsx` | 内嵌工具执行卡片 |
| `src/renderer/src/components/chat/ActivityTimeline.tsx` | Agent 活动时间线容器 |
| `src/renderer/src/components/chat/SmartInput.tsx` | 智能输入辅助（@file, #error） |
| `src/renderer/src/components/chat/ContextBar.tsx` | 上下文指示器 UI |
| `src/renderer/src/components/chat/VirtualMessageList.tsx` | 虚拟化消息列表 |

### 修改文件

| 文件 | 变更 |
|------|------|
| `src/main/services/AgentHookFactory.ts` | 扩展 hook：推送 activity events via IPC |
| `src/main/services/AgentStreamProcessor.ts` | 内联 activity events |
| `src/main/services/AgentService.ts` | 新增 AbortSignal 支持 |
| `src/renderer/src/stores/streaming.ts` | 数据模型：string → contentBlock[] |
| `src/renderer/src/stores/messagesStore.ts` | 新增 editMessage / branchFrom |
| `src/renderer/src/components/MessageBubble.tsx` | 分块渲染 + ToolCallCard 内联 |
| `src/renderer/src/components/ChatView.tsx` | 集成 VirtualMessageList + ContextBar |
| `src/renderer/src/components/InputBox.tsx` | 集成 SmartInput |
| `src/shared/types/stream.ts` | 新增 ActivityEvent, ContentBlock 类型 |

---

## Phase 1: 流式渲染优化

### Task 1: streamingStore 数据模型升级

**Files:**
- Modify: `src/renderer/src/stores/streaming.ts`
- Create: `test/stores/streaming.test.ts`

- [ ] **Step 1: 添加 ContentBlock 类型**

修改 `src/shared/types/stream.ts`，追加：

```typescript
export interface ContentBlock {
  id: string
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'blockquote' | 'tool_call'
  content: string
  metadata?: {
    language?: string
    toolName?: string
    toolId?: string
    isError?: boolean
  }
}

export interface ActivityEvent {
  id: string
  type: 'tool_start' | 'tool_end' | 'reasoning' | 'context_update' | 'agent_thought'
  toolName?: string
  toolId?: string
  duration?: number
  isError?: boolean
  content?: string
  turn?: number
  files?: string[]
  diagnostics?: number
  timestamp: string
}
```

- [ ] **Step 2: 写 failing test**

创建 `test/stores/streaming.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useStreamingStore } from '../../src/renderer/src/stores/streaming'

describe('streamingStore contentBlocks', () => {
  beforeEach(() => {
    useStreamingStore.getState().resetStreamingContent()
  })

  it('appendToken 后 flush 应生成 contentBlocks', () => {
    const { appendToken, flush } = useStreamingStore.getState()
    appendToken('## Hello\n')
    appendToken('```ts\nconst x = 1\n```\n')
    appendToken('World')
    flush()
    const blocks = useStreamingStore.getState().contentBlocks
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks[0].type).toBe('heading')
  })

  it('resetStreamingContent 应清除所有 blocks', () => {
    useStreamingStore.getState().appendToken('test')
    useStreamingStore.getState().flush()
    useStreamingStore.getState().resetStreamingContent()
    expect(useStreamingStore.getState().contentBlocks).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npx vitest run test/stores/streaming.test.ts
```
Expected: FAIL — `contentBlocks` 不存在

- [ ] **Step 4: 实现 streamingStore 升级**

修改 `src/renderer/src/stores/streaming.ts` 核心变更：

```typescript
// 新增状态
contentBlocks: ContentBlock[]

// 新增方法
appendToken: (content: string) => void  // 保留兼容，内部追加到 currentBlock
flush: () => void                       // 闭合当前 block 并推入 blocks 数组
// resetStreamingContent 增加清空 contentBlocks
```

核心 flush 逻辑（增量解析）：
```typescript
function flush(api) {
  if (tokenBuffer.length > 0) {
    const chunk = tokenBuffer.join('')
    tokenBuffer.length = 0
    // 检测完整 Markdown 结构，闭合当前 block
    const { blocks, remaining } = parseIncremental(api.getState().contentBlocks, chunk)
    api.setState({ contentBlocks: blocks })
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx vitest run test/stores/streaming.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/stores/streaming.ts test/stores/streaming.test.ts src/shared/types/stream.ts
git commit -m "feat: upgrade streaming store to contentBlock model"
```

---

### Task 2: MessageBubble 分块渲染

**Files:**
- Modify: `src/renderer/src/components/chat/MessageBubble.tsx` (或其实际路径)

- [ ] **Step 1: 确认当前 MessageBubble 位置**

```bash
find src/renderer/src/components/chat -type f
```

- [ ] **Step 2: 修改渲染逻辑**

将 `content` 字符串替换为 `contentBlocks.map(block => <BlockRenderer key={block.id} block={block} />)`。

实现 `BlockRenderer` 子组件：
```tsx
function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': return <MarkdownHeader content={block.content} />
    case 'code': return <CodeHighlight code={block.content} language={block.metadata?.language} />
    case 'paragraph': return <Paragraph content={block.content} />
    case 'tool_call': return <ToolCallCard block={block} />
    default: return <pre>{block.content}</pre>
  }
}
```

- [ ] **Step 3: 兼容性处理**

旧消息（string content）自动包装为单 paragraph block：
```tsx
const blocks: ContentBlock[] = message.contentBlocks?.length
  ? message.contentBlocks
  : [{ id: 'legacy', type: 'paragraph', content: message.content }]
```

- [ ] **Step 4: 运行现有测试确认无回归**

```bash
npm test
```
Expected: 无新增失败

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/chat/
git commit -m "feat: render message contentBlocks incrementally"
```

---

## Phase 2: Agent 活动内联

### Task 3: ToolCallCard 组件

**Files:**
- Create: `src/renderer/src/components/chat/ToolCallCard.tsx`
- Create: `test/components/ToolCallCard.test.tsx`

- [ ] **Step 1: 写 failing test**

```tsx
import { render, screen } from '@testing-library/react'
import ToolCallCard from '../../src/renderer/src/components/chat/ToolCallCard'

it('renders tool name and success status', () => {
  render(<ToolCallCard block={{ id: '1', type: 'tool_call', content: 'read_file', metadata: { toolName: 'read_file' } }} status="success" duration={12} />)
  expect(screen.getByText('read_file')).toBeInTheDocument()
  expect(screen.getByText('✅')).toBeInTheDocument()
})

it('renders running spinner', () => {
  render(<ToolCallCard block={{ id: '2', type: 'tool_call', content: 'execute_command', metadata: { toolName: 'execute_command' } }} status="running" />)
  expect(screen.getByText('🔄')).toBeInTheDocument()
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run test/components/ToolCallCard.test.tsx
```
Expected: FAIL

- [ ] **Step 3: 实现 ToolCallCard**

```tsx
interface ToolCallCardProps {
  block: ContentBlock
  status?: 'pending' | 'running' | 'success' | 'error'
  duration?: number
}

export default function ToolCallCard({ block, status = 'success', duration }: ToolCallCardProps) {
  const icon = status === 'running' ? '🔄' : status === 'error' ? '❌' : '✅'
  const name = block.metadata?.toolName || 'tool'
  return (
    <div className={`tool-call-card tool-call-${status}`}>
      <span className="tool-icon">{icon}</span>
      <span className="tool-name">{name}</span>
      {duration !== undefined && <span className="tool-duration">{duration}ms</span>}
    </div>
  )
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run test/components/ToolCallCard.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/chat/ToolCallCard.tsx test/components/ToolCallCard.test.tsx
git commit -m "feat: add ToolCallCard inline component"
```

---

### Task 4: activityStore + AgentHookFactory 扩展

**Files:**
- Create: `src/renderer/src/stores/activityStore.ts`
- Modify: `src/main/services/AgentHookFactory.ts`
- Create: `test/stores/activityStore.test.ts`

- [ ] **Step 1: 写 activityStore test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useActivityStore } from '../../src/renderer/src/stores/activityStore'

describe('activityStore', () => {
  beforeEach(() => useActivityStore.getState().clear())

  it('addActivity 添加事件', () => {
    useActivityStore.getState().addActivity({ id: '1', type: 'tool_start', toolName: 'read_file', timestamp: '' })
    expect(useActivityStore.getState().activities.length).toBe(1)
  })

  it('clear 清空事件', () => {
    useActivityStore.getState().addActivity({ id: '1', type: 'tool_start', toolName: 'read_file', timestamp: '' })
    useActivityStore.getState().clear()
    expect(useActivityStore.getState().activities).toEqual([])
  })
})
```

- [ ] **Step 2: 确认失败**

```bash
npx vitest run test/stores/activityStore.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现 activityStore**

```typescript
import { create } from 'zustand'
import type { ActivityEvent } from '@shared/types'

interface ActivityState {
  activities: ActivityEvent[]
  addActivity: (event: ActivityEvent) => void
  clear: () => void
  isExpanded: boolean
  toggleExpanded: () => void
}

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  addActivity: (event) => set((s) => ({ activities: [...s.activities, event] })),
  clear: () => set({ activities: [] }),
  isExpanded: true,
  toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
}))
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run test/stores/activityStore.test.ts
```
Expected: PASS

- [ ] **Step 5: 扩展 AgentHookFactory**

在 hook 回调中添加 IPC 推送：

```typescript
// AgentHookFactory.ts 中
hooks: {
  beforeTool: (ctx) => {
    sendActivity({
      id: randomUUID(),
      type: 'tool_start',
      toolName: ctx.toolCall?.name,
      timestamp: new Date().toISOString(),
    })
  },
  afterTool: (ctx) => {
    sendActivity({
      id: randomUUID(),
      type: 'tool_end',
      toolName: ctx.toolCall?.name,
      duration: ctx.duration,
      isError: ctx.result?.isError,
      timestamp: new Date().toISOString(),
    })
  },
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/stores/activityStore.ts src/main/services/AgentHookFactory.ts
git commit -m "feat: add activity tracking via Agent hooks"
```

---

## Phase 3: 上下文感知

### Task 5: ContextCollector 服务

**Files:**
- Create: `src/main/services/ContextCollector.ts`
- Create: `src/main/ipc/context.ts`
- Create: `test/services/ContextCollector.test.ts`

- [ ] **Step 1: 写 failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('ContextCollector', () => {
  it('collect 返回聚合上下文', async () => {
    // 测试路径验证
  })
})
```

- [ ] **Step 2: 实现 ContextCollector**

```typescript
export interface EditorContext {
  activeFile: string | null
  cursorLine: number
  selectedText: string
  openFiles: string[]
}

export interface ContextBlock {
  activeFile?: EditorContext
  terminalHistory: { command: string; output: string; timestamp: string }[]
  gitStatus?: { modified: string[]; untracked: string[] }
  diagnostics?: { errors: number; warnings: number; items: string[] }
}

export class ContextCollector {
  private editorContext: EditorContext = { activeFile: null, cursorLine: 0, selectedText: '', openFiles: [] }
  private terminalHistory: { command: string; output: string; timestamp: string }[] = []

  updateEditor(ctx: Partial<EditorContext>) {
    this.editorContext = { ...this.editorContext, ...ctx }
  }

  addTerminalOutput(cmd: string, output: string) {
    this.terminalHistory.push({ command: cmd, output, timestamp: new Date().toISOString() })
    if (this.terminalHistory.length > 20) this.terminalHistory.shift()
  }

  async collect(): Promise<ContextBlock> {
    return {
      activeFile: this.editorContext,
      terminalHistory: this.terminalHistory.slice(-5),
    }
  }
}
```

- [ ] **Step 3: 注册 IPC handler**

在 `src/main/ipc/context.ts` 暴露 `context:update` / `context:get` 通道。

- [ ] **Step 4: Commit**

```bash
git add src/main/services/ContextCollector.ts src/main/ipc/context.ts test/
git commit -m "feat: add ContextCollector service with IPC bridge"
```

---

### Task 6: SmartInput + ContextBar UI

**Files:**
- Create: `src/renderer/src/components/chat/SmartInput.tsx`
- Create: `src/renderer/src/components/chat/ContextBar.tsx`

实现 `@file` `#error` `#terminal` 快捷提示和当前上下文状态条。

---

## Phase 4: 对话控制

### Task 7: 优雅中断

**Files:**
- Modify: `src/main/services/AgentService.ts`
- Modify: `src/renderer/src/components/InputBox.tsx`

新增 AbortController 支持，Stop 按钮 → "停止中..." → "继续"/"重新生成"。

---

### Task 8: 历史编辑 + 会话分支

**Files:**
- Modify: `src/renderer/src/stores/messagesStore.ts` (或其实际 store)
- Create: 消息内联编辑 UI

---

## 执行顺序总结

```
Task 1 (streamingStore) → Task 2 (MessageBubble) → Task 3 (ToolCallCard) → Task 4 (activityStore + hooks) → Task 5 (ContextCollector) → Task 6 (SmartInput) → Task 7 (中断) → Task 8 (编辑/分支)
```

每个 Task 独立可验证，commit 后可单独回滚。
