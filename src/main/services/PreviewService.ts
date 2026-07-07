// 浏览器预览服务
// 使用 Electron BrowserView 在主窗口内嵌入网页预览
// 支持导航、前进后退、刷新、DevTools

import { BrowserView } from 'electron'
import type { BrowserWindow } from 'electron'

export class PreviewService {
  private view: BrowserView | null = null
  private getMainWindow: () => BrowserWindow | null
  private currentUrl: string = ''
  private boundsCallback: (() => { x: number; y: number; width: number; height: number }) | null = null

  constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow
  }

  /**
   * 设置 bounds 计算回调（渲染进程通过 IPC 传递容器尺寸）
   */
  setBoundsCallback(cb: () => { x: number; y: number; width: number; height: number }): void {
    this.boundsCallback = cb
  }

  /**
   * 打开 URL 预览
   */
  open(url: string): boolean {
    const win = this.getMainWindow()
    if (!win) return false

    // 如果已有 view，先移除
    this.close()

    // 强制 https：防止 http:// 导致 MITM 攻击
    if (url.startsWith('http://')) {
      url = 'https://' + url.slice(7)
    } else if (!url.startsWith('https://') && !url.startsWith('file://')) {
      url = 'https://' + url
    }

    this.view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
      },
    })

    win.addBrowserView(this.view)

    // 设置初始 bounds
    this.updateBounds()

    this.view.webContents.loadURL(url)
    this.currentUrl = url

    // 监听导航事件更新 URL
    this.view.webContents.on('did-navigate', (_e, newUrl) => {
      this.currentUrl = newUrl
      win.webContents.send('preview:url-changed', newUrl)
    })

    this.view.webContents.on('did-navigate-in-page', (_e, newUrl) => {
      this.currentUrl = newUrl
      win.webContents.send('preview:url-changed', newUrl)
    })

    this.view.webContents.on('page-title-updated', (_e, title) => {
      win.webContents.send('preview:title-changed', title)
    })

    return true
  }

  /** 生命周期停止方法，别名调用 close() */
  stop(): void {
    this.close()
  }

  /**
   * 关闭预览
   */
  close(): void {
    const win = this.getMainWindow()
    if (this.view && win) {
      win.removeBrowserView(this.view)
      // BrowserView.webContents.destroy() 是 Electron 内部方法，类型定义中未公开
      ;(this.view.webContents as { destroy?: () => void }).destroy?.()
      this.view = null
      this.currentUrl = ''
    }
  }

  /**
   * 导航到新 URL
   */
  navigate(url: string): boolean {
    if (!this.view) return false
    // 与 open() 一致的协议校验，强制 https 防止 MITM
    if (url.startsWith('http://')) {
      url = 'https://' + url.slice(7)
    } else if (!url.startsWith('https://') && !url.startsWith('file://')) {
      url = 'https://' + url
    }
    this.view.webContents.loadURL(url)
    return true
  }

  /**
   * 刷新页面
   */
  reload(): void {
    this.view?.webContents.reload()
  }

  /**
   * 后退
   */
  goBack(): void {
    this.view?.webContents.goBack()
  }

  /**
   * 前进
   */
  goForward(): void {
    this.view?.webContents.goForward()
  }

  /**
   * 获取当前 URL
   */
  getUrl(): string {
    return this.currentUrl
  }

  /**
   * 打开/关闭 DevTools
   */
  toggleDevTools(): void {
    const wc = this.view?.webContents
    if (!wc) return
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools()
    } else {
      wc.openDevTools({ mode: 'detach' })
    }
  }

  /**
   * 更新 BrowserView 的 bounds（在窗口大小变化时调用）
   */
  updateBounds(): void {
    if (!this.view || !this.boundsCallback) return
    const bounds = this.boundsCallback()
    this.view.setBounds(bounds)
  }

  /**
   * 是否已激活
   */
  isActive(): boolean {
    return this.view !== null
  }
}
