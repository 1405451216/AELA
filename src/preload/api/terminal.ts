// 终端与预览 API（terminal, terminalExt, preview）
import { invoke, ipcRenderer, IPC_CHANNELS } from './_shared'
import type { IpcRendererEvent } from './_shared'
import type { TerminalTabInfo, TerminalCommandHistoryEntry } from '@shared/types'

export const terminalApi = {
  create: (opts?: { cwd?: string; shell?: string }): Promise<string> => invoke(IPC_CHANNELS.TERMINAL_CREATE, opts),
  destroy: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.TERMINAL_DESTROY, id),
  input: (id: string, data: string): Promise<boolean> => invoke(IPC_CHANNELS.TERMINAL_INPUT, id, data),
  resize: (id: string, cols: number, rows: number): Promise<boolean> => invoke(IPC_CHANNELS.TERMINAL_RESIZE, id, cols, rows),
  list: (): Promise<string[]> => invoke(IPC_CHANNELS.TERMINAL_LIST),
  onData: (id: string, callback: (data: string) => void): (() => void) => {
    const channel = `terminal:data:${id}`
    const handler = (_event: IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onExit: (id: string, callback: (exitCode: number) => void): (() => void) => {
    const channel = `terminal:exit:${id}`
    const handler = (_event: IpcRendererEvent, code: number) => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
}

export const terminalExtApi = {
  listTabs: (): Promise<TerminalTabInfo[]> => invoke(IPC_CHANNELS.TERMINAL_LIST_TABS),
  commandHistory: (terminalId?: string, limit?: number): Promise<TerminalCommandHistoryEntry[]> =>
    invoke(IPC_CHANNELS.TERMINAL_COMMAND_HISTORY, terminalId, limit),
  runCommand: (command: string, opts?: { cwd?: string; timeout?: number }): Promise<{ stdout: string; stderr: string; exitCode: number | null }> =>
    invoke(IPC_CHANNELS.TERMINAL_RUN_COMMAND, command, opts),
}

export const previewApi = {
  open: (url: string): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_OPEN, url),
  close: (): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_CLOSE),
  navigate: (url: string): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_NAVIGATE, url),
  reload: (): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_RELOAD),
  goBack: (): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_GO_BACK),
  goForward: (): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_GO_FORWARD),
  getUrl: (): Promise<string> => invoke(IPC_CHANNELS.PREVIEW_GET_URL),
  devtools: (): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_DEVTOOLS),
  updateBounds: (bounds: { x: number; y: number; width: number; height: number }): Promise<boolean> => invoke(IPC_CHANNELS.PREVIEW_UPDATE_BOUNDS, bounds),
  onUrlChanged: (callback: (url: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, url: string) => callback(url)
    ipcRenderer.on('preview:url-changed', handler)
    return () => ipcRenderer.removeListener('preview:url-changed', handler)
  },
  onTitleChanged: (callback: (title: string) => void): (() => void) => {
    const handler = (_event: IpcRendererEvent, title: string) => callback(title)
    ipcRenderer.on('preview:title-changed', handler)
    return () => ipcRenderer.removeListener('preview:title-changed', handler)
  },
}
