# ADR-003: Zustand Slice 状态管理架构

| 字段 | 值 |
|------|-----|
| **状态** | 接受 (Accepted) |
| **日期** | 2026-07-01 |

## 上下文

AELA 渲染进程需要跨组件共享状态（当前视图、主题、会话、配置、消息等）。需要选择状态管理方案。

## 决策

采用 **Zustand + Slice 模式**，不使用 Redux 或 Context API。

## Slice 清单（`src/renderer/src/stores/`）

| Slice | 文件 | 职责 |
|------|------|------|
| viewStore | `viewStore.ts` | 当前视图、错误条 |
| configStore | `configStore.ts` | 全局配置 + 主题 + 当前会话/工作区/模型 |
| skillStore | `skillStore.ts` | Skills 缓存 + 扫描诊断日志 |
| automationStore | `automationStore.ts` | 自动化任务列表 |
| messagesStore | `messagesStore.ts` | 消息列表 + 流式内容 |
| streaming.ts | `streaming.ts` | token 流缓冲（独立，避免级联重渲染）|

## 关键决策

### 1. streaming.ts 独立于 messagesStore
**原因**：每 token 更新触发 messagesStore 变更 → 整 ChatView 重渲染。独立 streaming slice 让 token 更新只影响订阅了 streaming 的组件（`ChatView.tsx` 通过 `useStreamingStore` 订阅）。

### 2. 单一 facade 兼容层（`stores/app.ts`）
**原因**：早期遗留代码使用 `useAppStore` 全局 store。新代码应直接订阅具体 slice。`app.ts` 作为兼容层保留，注释明确警告。

### 3. 状态订阅优化
**现状**：Sidebar 等容器组件通过 `useAppStore` 订阅会拉取整个 store。
**改进**：容器组件应改用选择性订阅 `useAppStore(s => ({ currentView, ... }))`（P2 优化）。

## 理由

相比 Redux：Zustand 无 boilerplate、TypeScript 友好、支持选择性订阅。
相比 Context API：避免 Provider 嵌套地狱，跨切片更新更高效。
