// AELA Desktop — Electron 主进程入口
// Solo 模式 AI 编码助手桌面应用
//
// 职责（精简后）：
//   1. Electron 应用生命周期管理
//   2. 全局错误处理
//   3. 单实例锁
//   4. 调用 ServiceBootstrap 初始化服务
//   5. 调用 WindowManager 创建窗口
//   6. 注册 IPC 处理器
//   7. 设置 Shell 确认回调
//
// 服务实例化逻辑已拆分至 bootstrap/ServiceBootstrap.ts
// 窗口管理逻辑已拆分至 bootstrap/WindowManager.ts

import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { appendFileSync } from 'node:fs'
import { registerIPC } from './ipc'
import { showShellConfirmDialog } from './utils/shellConfirm'
import type { ShellConfirmRequest, ShellConfirmResponse } from '@shared/types'
import { bootstrapServices } from './bootstrap/ServiceBootstrap'
import { WindowManager } from './bootstrap/WindowManager'
import type { ServiceContainer } from './services/ServiceContainer'
import { SERVICE_TOKENS } from './services/ServiceContainer'
import type { AutoUpdateService } from './services/AutoUpdateService'

// ===== 路径常量 =====
// Electron 原生支持 asar 路径（loadFile / preload 均可透明读取归档内文件）
// 因此保留 .asar 后缀，不要剥离——剥离后路径指向不存在的物理目录，导致窗口加载失败
const APP_ROOT = app.getAppPath()

// ===== 日志 =====
const logPath = join(app.getPath('userData'), 'aela-main.log')
function log(msg: string): void {
  const line = '[' + new Date().toISOString() + '] ' + msg + '\n'
  try { appendFileSync(logPath, line) } catch { /* ignore */ }
}
log('APP_ROOT=' + APP_ROOT)

// ===== 全局错误处理 =====
// 由 CrashReportService 接管，此处仅保留早期阶段日志（CrashReportService 在 bootstrap 中初始化）
process.on('unhandledrejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason))
  log(`[unhandledrejection] ${err.message}\n${err.stack ?? ''}`)
})

process.on('uncaughtexception', (error: Error) => {
  log(`[uncaughtexception] ${error.message}\n${error.stack ?? ''}`)
})

// ===== 窗口管理器 =====
const windowManager = new WindowManager({
  appRoot: APP_ROOT,
  isDev: !app.isPackaged,
  log,
})

// ===== 服务容器引用（在 whenReady 中赋值，供 before-quit 清理） =====
let containerRef: ServiceContainer | null = null

// ===== 单实例锁 =====
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    windowManager.focus()
  })
}

// ===== 应用就绪 =====
app.whenReady().then(async () => {
  const startupMark = '[perf] app.whenReady'
  log(startupMark)
  console.time(startupMark)

  // ===== 初始化所有服务（实例化 + 依赖注入 + 容器注册） =====
  const t0 = performance.now()
  log('bootstrapping services...')
  const { container, agentService } = await bootstrapServices(() => windowManager.get(), log)
  containerRef = container
  const t1 = performance.now()
  log(`services bootstrapped in ${(t1 - t0).toFixed(0)}ms`)

  // ===== 启动所有服务（按注册顺序调用 start()） =====
  const t2 = performance.now()
  log('starting all services...')
  await container.startAll()
  const t3 = performance.now()
  log(`all services started in ${(t3 - t2).toFixed(0)}ms`)

  // ===== 注册 IPC 处理器 =====
  const t4 = performance.now()
  log('registering IPC handlers...')

  // dev 模式下启用 IPC 监控（必须在 registerIPC 之前注入）
  let ipcMonitor: import('./services/IpcMonitorService').IpcMonitorService | null = null
  if (!app.isPackaged) {
    ipcMonitor = new (await import('./services/IpcMonitorService')).IpcMonitorService(100)
    ;(await import('./utils/ipcHelpers')).setIpcMonitor(ipcMonitor)
    log('[dev] IPC monitor enabled')
  }

  registerIPC(container)
  const t5 = performance.now()
  log(`IPC handlers registered in ${(t5 - t4).toFixed(0)}ms`)

  // ===== 设置 Shell 命令确认回调 =====
  agentService.setShellConfirmCallback(async (request: ShellConfirmRequest): Promise<ShellConfirmResponse> => {
    return showShellConfirmDialog(request, windowManager.get())
  })

  // ===== 创建主窗口 =====
  const t6 = performance.now()
  log('calling createWindow...')
  windowManager.create()
  // dev 模式下将 IPC monitor 绑定到主窗口（推送日志）
  if (ipcMonitor) {
    const win = windowManager.get()
    if (win) ipcMonitor.attachTo(win.webContents)
  }
  const t7 = performance.now()
  log(`createWindow returned in ${(t7 - t6).toFixed(0)}ms`)

  // ===== 启动自动更新定时检查 =====
  const autoUpdateService = container.get<AutoUpdateService>(SERVICE_TOKENS.AUTO_UPDATE_SERVICE)
  if (autoUpdateService) {
    autoUpdateService.setMainWindow(windowManager.get())
    autoUpdateService.startPeriodicCheck()
    log('auto-update service started')
  }

  // ===== 启动完成性能报告 =====
  const totalMs = performance.now() - t0
  const memUsage = process.memoryUsage()
  console.timeEnd(startupMark)
  log(`[perf] === STARTUP COMPLETE: ${totalMs.toFixed(0)}ms ===`)
  log(`[perf] Memory: RSS=${(memUsage.rss / 1024 / 1024).toFixed(1)}MB Heap=${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`)
  log(`[perf] Breakdown: bootstrap=${(t1 - t0).toFixed(0)}ms start=${(t3 - t2).toFixed(0)}ms ipc=${(t5 - t4).toFixed(0)}ms window=${(t7 - t6).toFixed(0)}ms`)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.create()
    }
  })
})

// 关闭时清理 — 统一调用 stopAll()
app.on('before-quit', async () => {
  log('before-quit: cleaning up...')
  if (containerRef) {
    await containerRef.stopAll()
    log('before-quit: all services stopped')
  }
})

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
