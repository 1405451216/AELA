# ADR-002: Sandbox 妥协决策

| 字段 | 值 |
|------|-----|
| **状态** | 接受 (Accepted) — 带拆分计划 |
| **日期** | 2026-07-01 |

## 上下文

Electron 应用的安全最佳实践要求 preload 脚本启用 `sandbox: true`，限制渲染进程通过 preload 访问 Node.js API。AELA 当前配置为 `sandbox: false`。

## 决策

**当前状态（v0.1.x）：** 保留 `sandbox: false`

**原因（注释于 `src/main/index.ts:68`）：**
- preload 脚本（`src/preload/index.ts`）当前使用 `fs`、`path`、`child_process` 等 Node.js API
- 暴露的 `window.aela` API 通过 `contextBridge` 注册，需要 Node.js 能力

## 风险

`sandbox: false` 意味着如果渲染进程被 XSS 注入，攻击者可访问 Node.js API（文件系统执行任意命令）。

## 缓解措施

1. **CSP 已启用**（`src/main/index.ts:85-110`）：
   - 生产模式收紧到 `'self'`（无 `unsafe-inline`/`unsafe-eval`）
   - 禁止 `object-src`、`base-uri`、`frame-ancestors`
2. **contextIsolation: true** + **nodeIntegration: false**：渲染进程无法直接访问 Node.js
3. **外部链接隔离**：`setWindowOpenHandler` 强制走系统浏览器

## 拆分计划（v0.2.0）

将 preload 拆分为两层：

| 层 | 文件 | 职责 | Node 依赖 |
|----|------|------|----------|
| 纯桥接层 | `preload/bridge.ts` | 仅 `contextBridge.expose` + IPC 调用 | 无（可 sandbox:true）|
| 能力层 | `preload/capabilities.ts` | 文件操作等需 Node 的能力 | 需要 sandbox:false |

拆分后，纯桥接层启用 `sandbox: true`，能力层的 Node 访问被隔离在独立进程。
