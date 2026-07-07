// IPC 处理器共享辅助函数

import type { IPCResponse } from '@shared/types'
import { IpcMonitorService } from '../services/IpcMonitorService'

let monitor: IpcMonitorService | null = null

export function setIpcMonitor(service: IpcMonitorService | null): void {
  monitor = service
}

export function getIpcMonitor(): IpcMonitorService | null {
  return monitor
}

/**
 * 包装一个 IPC handler，自动捕获异常并转换为统一的 IPCResponse 格式。
 * dev 模式下同时记录调用耗时和状态到 IpcMonitorService。
 */
export async function wrap<T>(
  fn: () => Promise<T> | T,
  _channel?: string
): Promise<IPCResponse<T>> {
  const ch = _channel ?? 'unknown'
  const start = monitor ? performance.now() : 0
  try {
    const data = await fn()
    if (monitor) {
      monitor.record({ channel: ch, args: [], startTime: start, endTime: performance.now(), duration: performance.now() - start, error: false, result: data })
    }
    return { success: true, data }
  } catch (err) {
    if (monitor) {
      monitor.record({ channel: ch, args: [], startTime: start, endTime: performance.now(), duration: performance.now() - start, error: true })
    }
    let message: string
    if (err instanceof Error) {
      if (err.message.includes('ENOENT') || err.message.includes('EACCES') || err.message.includes('EPERM')) {
        message = '文件操作失败: 路径不存在或权限不足'
      } else if (err.message.startsWith('路径穿越')) {
        message = err.message
      } else {
        message = err.message
      }
    } else if (typeof err === 'string') {
      message = err
    } else {
      message = String(err)
    }
    return { success: false, error: message }
  }
}