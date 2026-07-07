import type { WebContents } from 'electron'

export interface IpcLogEntry {
  seq: number
  channel: string
  args: unknown[]
  startTime: number
  endTime: number
  duration: number
  error: boolean
  result?: unknown
}

export type IpcLogListener = (entry: IpcLogEntry) => void

/**
 * IPC 监控服务 — 仅 dev 模式启用
 * 拦截 ipcMain.handle 调用，记录到内存环形缓冲区，推送到渲染进程
 */
export class IpcMonitorService {
  private buffer: IpcLogEntry[] = []
  private seqCounter = 0
  private listeners = new Set<IpcLogListener>()
  private targetWebContents: WebContents | null = null

  constructor(private maxSize = 100) {}

  /** 绑定到 BrowserWindow，用于推送事件 */
  attachTo(win: WebContents): void {
    this.targetWebContents = win
  }

  /** 记录一条 IPC 调用结果 */
  record(entry: Omit<IpcLogEntry, 'seq'>): void {
    const full: IpcLogEntry = { ...entry, seq: ++this.seqCounter }
    this.buffer.push(full)
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift()
    }
    // 通知所有监听器（渲染进程 UI）
    this.listeners.forEach(l => l(full))
    // 如果绑定了 webContents，直接发送
    if (this.targetWebContents && !this.targetWebContents.isDestroyed()) {
      this.targetWebContents.send('ipc:log', full)
    }
  }

  /** 获取所有日志 */
  getEntries(): IpcLogEntry[] {
    return [...this.buffer]
  }

  /** 清空日志 */
  clear(): void {
    this.buffer = []
  }

  /** 订阅实时日志 */
  subscribe(listener: IpcLogListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 慢请求阈值（毫秒） */
  static readonly SLOW_THRESHOLD = 2000
}
