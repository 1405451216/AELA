// 共享的 IPC 调用辅助函数与 ipcRenderer 导出
// 所有 namespace 模块通过此文件复用 invoke 封装

import type { IpcRendererEvent } from 'electron'
import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { IPCResponse } from '@shared/types'

/**
 * 类型安全的 IPC 调用辅助函数。
 * 统一处理 IPCResponse 的 success/error 语义。
 */
export async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const resp = await ipcRenderer.invoke(channel, ...args) as IPCResponse<T>
  if (!resp.success) {
    throw new Error(resp.error || 'IPC call failed')
  }
  return resp.data as T
}

export { ipcRenderer, IPC_CHANNELS }
export type { IpcRendererEvent }
