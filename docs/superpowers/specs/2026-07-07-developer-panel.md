# 开发者面板设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

错误只有 `console.error`，用户和开发者都看不到，线上故障难复现。

## 方案

快捷键 `Ctrl+Shift+D` 呼出全屏浮层面板（暗色主题，右侧 60% 宽度）。

## 4 个 Tab

| Tab | 内容 | 数据来源 |
|-----|------|----------|
| IPC 日志 | 实时调用流（channel/耗时/状态），点击展开 args/result JSON | `IpcMonitorService`（新建） |
| Agent 运行 | 最近 5 次运行工具调用树 | `OrchestrationReplay`（已有） |
| 性能 | Token 成本 / 延迟基线 / 模型分布 | `CostTrackerService`（已有） |
| 诊断导出 | 一键打包日志 + `git rev-parse HEAD`，下载 ZIP | 新建 util |

## IPC 监控实现

新建 `src/main/services/IpcMonitorService.ts`：在 `ipcMain.handle` 外层包 proxy，记录 `{ channel, args, startTime, endTime, error? }`，内存缓存最近 100 条，通过 `win.webContents.send('ipc:log', entry)` 推送渲染进程。

## 视觉

- 全屏浮层，左侧 40% 消息列表暗化预览，右侧 60% 面板
- 行级色标：绿色=成功，红色=错误，黄色=2s+ 慢请求
- monospace 小字体，顶部固定 Tab，底部固定"复制全部"

## 文件变化

| 文件 | 变化 |
|------|------|
| `src/main/services/IpcMonitorService.ts` | **新建** |
| `src/main/ipc/index.ts` | 注册监控拦截器 |
| `src/renderer/src/components/DeveloperPanel.tsx` | **新建**：容器 + 快捷键监听 |
| `src/renderer/src/components/developer/IpcLogTab.tsx` | **新建** |
| `src/renderer/src/components/developer/AgentRunsTab.tsx` | **新建** |
| `src/renderer/src/components/developer/PerformanceTab.tsx` | **新建** |
| `src/renderer/src/components/developer/DiagnosticTab.tsx` | **新建** |

## 快捷键

`App.tsx` 加 `useEffect` 监听 `Ctrl+Shift+D`，`preventDefault`，toggle `showDevPanel`。优先级低于 Onboarding（引导中不呼出）。

## 风险

- IPC 拦截对性能的影响 → 仅 dev 模式启用（`!app.isPackaged`），生产环境空转
- 内存缓存 100 条 cap 防泄漏
- 诊断导出不上传任何内容到网络，仅本地打包

## 测试策略

1. 验证 `Ctrl+Shift+D` 切换面板显示
2. 验证 IPC 调用后日志 Tab 实时新增
3. 验证慢请求（>2s）行黄色高亮
4. 验证诊断导出 ZIP 包含 git rev
