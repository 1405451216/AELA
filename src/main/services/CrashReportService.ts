// AELA — 崩溃报告服务
// 使用 Electron 内置 crashReporter + 主进程错误捕获
// 配合 electron-log 记录运行时日志
//
// 未来可集成 Sentry 获取远程崩溃报告：
//   npm install @sentry/electron
//   import { init } from '@sentry/electron'
//   init({ dsn: 'YOUR_DSN' })

import { app, crashReporter } from 'electron'
import log from 'electron-log'
import { join } from 'node:path'
import { appendFileSync } from 'node:fs'

export class CrashReportService {
  private logPath: string
  private crashDir: string

  constructor() {
    // 配置日志文件路径
    this.logPath = join(app.getPath('userData'), 'aela-main.log')
    this.crashDir = join(app.getPath('userData'), 'crashes')
    log.transports.file.level = 'error'
    log.transports.file.resolvePathFn = () => this.logPath
  }

  /**
   * 初始化崩溃报告
   */
  init(): void {
    // 启动 Electron 崩溃报告器
    // 在生产模式下自动上传 minidump 到 Electron 默认服务器
    // 可配置 submitURL 指向自建崩溃收集服务
    try {
      crashReporter.start({
        productName: 'AELA',
        companyName: 'AELA',
        submitURL: '', // 留空 = 仅本地存储 minidump，不上传
        uploadToServer: false, // 生产环境可设为 true 并配置 submitURL
        compress: true,
      })
      log.info('[CrashReporter] Started — crash dumps saved to', this.crashDir)
    } catch (err) {
      log.error('[CrashReporter] Failed to start:', err)
    }

    // 注意: uncaughtException/unhandledRejection 处理器已在 index.ts 中注册（更早阶段捕获）
  }

  /**
   * 报告错误（记录到日志文件）
   * 未来可扩展为上传到 Sentry/自建服务
   */
  reportError(type: string, error: Error): void {
    const timestamp = new Date().toISOString()
    const entry = `[${timestamp}] [${type}] ${error.name}: ${error.message}\nStack: ${error.stack ?? 'N/A'}\n\n`
    
    try {
      appendFileSync(this.logPath, entry)
    } catch {
      // 如果连日志写入都失败，只能 stderr
      process.stderr.write(entry)
    }

    // 同时通过 electron-log 记录
    log.error(`[${type}]`, error)

    // 未来：上传到 Sentry
    // if (this.sentryEnabled) {
    //   Sentry.captureException(error)
    // }
  }

  /**
   * 手动上报错误（供 IPC 调用）
   */
  reportManualError(message: string, stack?: string): void {
    const error = new Error(message)
    if (stack) error.stack = stack
    this.reportError('manual-report', error)
  }

  /**
   * 获取崩溃日志路径（供 UI 展示）
   */
  getLogPath(): string {
    return this.logPath
  }

  /**
   * 获取崩溃 dump 目录
   */
  getCrashDir(): string {
    return this.crashDir
  }

  /**
   * 停止服务
   */
  stop(): void {
    // crashReporter 无显式 stop 方法
    log.info('[CrashReporter] Service stopped')
  }
}
