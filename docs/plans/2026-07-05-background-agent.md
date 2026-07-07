# 后台常驻 Agent 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 实现后台常驻 Agent：监听文件/终端/Git/LSP 变更，自动检测问题，轻量 Agent 修复，Chat 中 DiffCard 确认。

**Architecture:** BackgroundAgentService（主进程）订阅多源事件 → MicroAgent 单文件修复 → Checkpoint 保存 → DiffCard（渲染进程）确认。

**Tech Stack:** chokidar, Electron Notification, Zustand, TypeScript

---

## Task 1: MicroAgent 轻量修复 Agent

**Files:**
- Create: `src/main/services/MicroAgent.ts`
- Create: `test/services/MicroAgent.test.ts`

- [ ] **Step 1: 写 failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('MicroAgent', () => {
  it('应返回修复 diff', async () => {
    // 验证 MicroAgent.run 返回 DiffResult
  })

  it('超时 5s 应终止', async () => {
    // 验证超时行为
  })

  it('无问题应返回 null', async () => {
    // 验证无需修复场景
  })
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run test/services/MicroAgent.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现 MicroAgent**

```typescript
// src/main/services/MicroAgent.ts
import type { ToolManager } from './ToolManager'
import type { ProviderManager } from './ProviderManager'

export interface MicroAgentResult {
  filePath: string
  originalContent: string
  fixedContent: string
  description: string
}

export class MicroAgent {
  private timeoutMs = 5000
  private maxTokens = 2000

  constructor(
    private providerManager: ProviderManager,
    private toolManager: ToolManager,
  ) {}

  async run(filePath: string, diagnostics: string): Promise<MicroAgentResult | null> {
    // 1. 读取文件
    // 2. 构建修复 prompt
    // 3. 调用 Provider 生成修复
    // 4. 解析结果返回 diff
    // 5. 超时控制
    return null
  }
}
```

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run test/services/MicroAgent.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/services/MicroAgent.ts test/services/MicroAgent.test.ts
git commit -m "feat: add MicroAgent for background file fixes"
```

## Task 2: BackgroundAgentService 核心

**Files:**
- Create: `src/main/services/BackgroundAgentService.ts`
- Create: `test/services/BackgroundAgentService.test.ts`
- Modify: `src/main/bootstrap/ServiceBootstrap.ts`

- [ ] **Step 1: 写 failing test**

```typescript
describe('BackgroundAgentService', () => {
  it('应订阅 TerminalService 输出', () => {})
  it('检测到错误应触发 MicroAgent', () => {})
  it('修复完成应推送 diff', () => {})
  it('超出预算应暂停', () => {})
})
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run test/services/BackgroundAgentService.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现 BackgroundAgentService**

核心结构：订阅 TerminalService 输出 → 正则匹配错误模式 → 收集上下文 → 触发 MicroAgent → 保存 checkpoint → 推送 diff。

- [ ] **Step 4: 注册到 ServiceBootstrap**

- [ ] **Step 5: Commit**

## Task 3: DiffCard UI + IPC

**Files:**
- Create: `src/renderer/src/components/chat/DiffCard.tsx`
- Create: `src/renderer/src/stores/diffStore.ts`
- Create: `test/components/DiffCard.test.tsx`
- Create: `src/main/ipc/bg-agent.ts`

- [ ] **Step 1: 写 failing test**

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 DiffCard + IPC**

- [ ] **Step 4: Commit**

## Task 4: 触发源集成

**Files:**
- Modify: `src/main/services/BackgroundAgentService.ts`
- Create: FileWatcher 集成
- 终端错误正则模式库

- [ ] **Step 1: FileWatcher 集成
- [ ] **Step 2: 终端错误模式（tsc失败/npm test失败/build失败）
- [ ] **Step 3: Commit

## Task 5: 验收测试

- [ ] 手动验证：保存含 TS 错误文件 → 触发 MicroAgent → 收到 DiffCard
- [ ] 验证超时 → Toast 通知
- [ ] 验证预算超限 → Agent 暂停
- [ ] 全量测试通过
