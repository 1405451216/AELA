// AELA — 窗口管理器
// 职责：BrowserWindow 创建 / CSP 配置 / 标题栏 / 外部链接 / 加载失败处理
// 从 index.ts 中拆出，降低入口文件复杂度

import { BrowserWindow, shell, session } from 'electron'
import { join } from 'node:path'

export interface WindowManagerOptions {
  appRoot: string
  isDev: boolean
  log: (msg: string) => void
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private readonly opts: WindowManagerOptions

  constructor(opts: WindowManagerOptions) {
    this.opts = opts
  }

  /**
   * 创建主窗口
   */
  create(): BrowserWindow | null {
    const { appRoot, isDev, log } = this.opts
    const t0 = performance.now()
    log('createWindow start')

    // 开发模式下预先设置 CSP，消除 Electron 的 "Insecure Content-Security-Policy" 警告
    // 生产模式不需要，因为 onHeadersReceived 已配置严格 CSP
    if (isDev) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self' data:; " +
              "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:*; " +
              "media-src 'self' blob:; " +
              "object-src 'none'; " +
              "base-uri 'self'; " +
              "frame-ancestors 'none';"
            ]
          }
        })
      })
    }

    try {
      log('preload path: ' + join(appRoot, 'out/preload/index.mjs'))
      this.mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        show: false,
        autoHideMenuBar: true,
        title: 'AELA',
        icon: join(appRoot, 'resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
        backgroundColor: '#1a1a2e',
        // 自定义标题栏：隐藏原生标题栏但保留原生窗口控制按钮（最小化/最大化/关闭）
        // Windows 使用 titleBarOverlay，macOS 使用 hiddenInset
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
        ...(process.platform !== 'darwin' ? {
          titleBarOverlay: {
            color: '#1a1a2e',
            symbolColor: '#94a3b8',
            height: 36,
          },
        } : {}),
        webPreferences: {
          preload: join(appRoot, 'out/preload/index.mjs'),
          // sandbox: true — preload 仅使用 ipcRenderer + contextBridge，无直接 Node.js API 调用
          // 启用沙箱可隔离渲染进程与 Chromium 内核，防止 XSS 升级为 RCE
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false
        }
      })

      this.mainWindow.on('ready-to-show', () => {
        this.mainWindow?.show()
      })

      // 加载失败时记录错误并强制显示窗口，避免窗口永久隐藏
      this.mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        log(`did-fail-load: errorCode=${errorCode}, desc=${errorDescription}, url=${validatedURL}`)
        // 强制显示窗口，让用户至少看到错误页面而不是什么都没有
        if (!this.mainWindow?.isVisible()) {
          this.mainWindow?.show()
        }
      })

      // 设置 CSP 内容安全策略（开发模式放宽以支持 Vite HMR）
      this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const scriptSrc = isDev
          ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
          : "script-src 'self'; "
        // 生产环境收紧 connect-src：仅允许 'self'，不开放 localhost
        const connectSrc = isDev
          ? "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:*; "
          : "connect-src 'self'; "
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self'; " +
              scriptSrc +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self' data:; " +
              connectSrc +
              "media-src 'self' blob:; " +
              "object-src 'none'; " +
              "base-uri 'self'; " +
              "frame-ancestors 'none';"
            ]
          }
        })
      })

      // 外部链接在系统浏览器中打开
      this.mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
      })

      // 开发环境加载 dev server，生产环境加载打包文件
      if (process.env['ELECTRON_RENDERER_URL']) {
        this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
      } else {
        this.mainWindow.loadFile(join(appRoot, 'out/renderer/index.html'))
      }
      log('createWindow done, mainWindow: ' + !!this.mainWindow)
    } catch (err) {
      log('createWindow ERROR: ' + err)
    }

    const t1 = performance.now()
    log(`[perf] createWindow: ${t1 - t0}ms`)

    return this.mainWindow
  }

  /**
   * 获取当前主窗口（可能为 null）
   */
  get(): BrowserWindow | null {
    return this.mainWindow
  }

  /**
   * 将窗口聚焦/恢复
   */
  focus(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) this.mainWindow.restore()
      this.mainWindow.focus()
    }
  }
}
