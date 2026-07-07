// IPC 处理器共享辅助函数

import type { IPCResponse } from '@shared/types'

/**
 * 包装一个 IPC handler，自动捕获异常并转换为统一的 IPCResponse 格式。
 *
 * 用法:
 *   ipcMain.handle(channel, async () => wrap(() => service.doSomething()))
 */
export async function wrap<T>(
  fn: () => Promise<T> | T
): Promise<IPCResponse<T>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (err) {
    let message: string
    if (err instanceof Error) {
      // 泛化错误消息，防止泄露内部路径等敏感信息
      if (err.message.includes('ENOENT') || err.message.includes('EACCES') || err.message.includes('EPERM')) {
        message = '文件操作失败: 路径不存在或权限不足'
      } else if (err.message.startsWith('路径穿越')) {
        message = err.message // 安全拦截消息可以透传
      } else {
        message = err.message
      }
    } else if (typeof err === 'string') {
      message = err
    } else {
      try { message = String(err) } catch { message = 'Unknown error' }
    }
    return { success: false, error: message }
  }
}