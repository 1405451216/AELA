// AELA — 自动更新服务
// 使用 electron-updater 实现应用自动更新
// 配合 electron-log 记录更新日志
// 支持 GitHub Releases 发布渠道

import { app, dialog } from 'electron'
import type { BrowserWindow } from 'electron'
import type { UpdateInfo } from 'electron-updater'
import type ElectronLog from 'electron-log'
import { lazyRequire } from '../utils/nativeRequire'

// electron-updater 类型定义与运行时 API 不完全匹配，使用显式接口
interface AutoUpdaterExt {
  logger: typeof ElectronLog
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: 'checking-for-update', listener: () => void): void
  on(event: 'update-available', listener: (info: UpdateInfo) => void): void
  on(event: 'update-not-available', listener: (info: UpdateInfo) => void): void
  on(event: 'download-progress', listener: (progress: { percent: number; transferred: number; total: number }) => void): void
  on(event: 'update-downloaded', listener: (info: UpdateInfo) => void): void
  on(event: 'error', listener: (err: Error) => void): void
  checkForUpdates(): Promise<unknown>
  quitAndInstall(): void
}

// 延迟加载 CJS 模块（ESM + asar 环境兼容）
let _autoUpdater: AutoUpdaterExt | null = null
function getAutoUpdater(): AutoUpdaterExt {
  if (!_autoUpdater) {
    const electronUpdater = lazyRequire<typeof import('electron-updater')>('electron-updater')
    _autoUpdater = electronUpdater.autoUpdater as unknown as AutoUpdaterExt
  }
  return _autoUpdater
}

let _log: typeof ElectronLog | null = null
function getLog(): typeof ElectronLog {
  if (!_log) {
    _log = lazyRequire<typeof ElectronLog>('electron-log')
  }
  return _log
}

// 配置日志级别
const log = getLog()
log.transports.file.level = 'info'
log.transports.console.level = !app.isPackaged ? 'debug' : 'info'

export class AutoUpdateService {
  private mainWindow: BrowserWindow | null = null
  private isChecking = false
  private setupDone = false

  constructor(private opts: { log: (msg: string) => void }) {
    // 不在此处初始化 autoUpdater — 需要 app 模块就绪
  }

  /**
   * 设置主窗口引用（用于发送更新通知到渲染进程）
   */
  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win
  }

  /**
   * 延迟初始化 electron-updater 事件监听
   * 需要 app 模块就绪后才能调用
   */
  private ensureSetup(): void {
    if (this.setupDone) return
    this.setupDone = true

    const updater = getAutoUpdater()
    updater.logger = log
    updater.autoDownload = !process.env.AELA_SKIP_AUTO_UPDATE
    updater.autoInstallOnAppQuit = true

    // 检查到新版本
    updater.on('checking-for-update', () => {
      this.opts.log('[AutoUpdate] Checking for update...')
      this.notifyRenderer('checking-for-update', null)
    })

    // 有可用更新
    updater.on('update-available', (info: UpdateInfo) => {
      this.opts.log(`[AutoUpdate] Update available: ${info.version}`)
      this.notifyRenderer('update-available', { version: info.version, releaseNotes: info.releaseNotes })
    })

    // 当前版本是最新的
    updater.on('update-not-available', (info: UpdateInfo) => {
      this.opts.log('[AutoUpdate] App is up to date')
      this.notifyRenderer('update-not-available', { version: info.version })
    })

    // 下载进度
    updater.on('download-progress', (progress) => {
      this.opts.log(`[AutoUpdate] Downloading: ${Math.round(progress.percent)}%`)
      this.notifyRenderer('download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      })
    })

    // 下载完成
    updater.on('update-downloaded', (info: UpdateInfo) => {
      this.opts.log(`[AutoUpdate] Update downloaded: ${info.version}`)
      this.notifyRenderer('update-downloaded', { version: info.version })
      this.promptInstall()
    })

    // 错误处理
    updater.on('error', (err: Error) => {
      this.opts.log(`[AutoUpdate] Error: ${err.message}`)
      this.notifyRenderer('update-error', { message: err.message })
    })
  }

  /**
   * 手动检查更新
   */
  async checkForUpdates(): Promise<void> {
    this.ensureSetup()
    if (this.isChecking) return
    if (!app.isPackaged) {
      this.opts.log('[AutoUpdate] Skipping check in dev mode')
      return
    }
    this.isChecking = true
    try {
      await getAutoUpdater().checkForUpdates()
    } catch (err) {
      this.opts.log(`[AutoUpdate] Check failed: ${(err as Error).message}`)
    } finally {
      this.isChecking = false
    }
  }

  /**
   * 下载并安装更新（已下载后调用）
   */
  quitAndInstall(): void {
    this.ensureSetup()
    getAutoUpdater().quitAndInstall()
  }

  /**
   * 提示用户安装更新
   */
  private async promptInstall(): Promise<void> {
    if (!this.mainWindow) return

    const result = await dialog.showMessageBox(this.mainWindow, {
      type: 'info',
      title: '更新已下载',
      message: 'AELA 已下载新版本',
      detail: '是否立即重启应用以完成更新？',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
    })

    if (result.response === 0) {
      // 用户选择立即重启
      setImmediate(() => this.quitAndInstall())
    }
  }

  /**
   * 向渲染进程发送更新通知
   */
  private notifyRenderer(event: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('aela-auto-update', { event, data })
    }
  }

  /**
   * 启动定时检查（每 4 小时检查一次）
   */
  startPeriodicCheck(): void {
    this.ensureSetup()
    // 启动后 30 秒首次检查
    setTimeout(() => this.checkForUpdates(), 30_000)
    // 每 4 小时检查一次
    setInterval(() => this.checkForUpdates(), 4 * 60 * 60 * 1000)
  }
}
