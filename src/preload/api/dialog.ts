// 原生对话框 API
import { invoke, IPC_CHANNELS } from './_shared'

export interface OpenDialogOptions {
  properties: string[]
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export const dialogApi = {
  showOpenDialog: async (options: OpenDialogOptions): Promise<string[] | null> => {
    return invoke(IPC_CHANNELS.DIALOG_SHOW_OPEN, options)
  },
}
