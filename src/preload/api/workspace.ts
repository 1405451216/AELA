// 工作区 API
import { invoke, IPC_CHANNELS } from './_shared'
import type { Workspace, FileTreeNode } from '@shared/types'

export const workspaceApi = {
  list: (): Promise<Workspace[]> => invoke(IPC_CHANNELS.WORKSPACE_LIST),
  add: (): Promise<Workspace | null> => invoke(IPC_CHANNELS.WORKSPACE_ADD),
  remove: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.WORKSPACE_REMOVE, id),
  open: (path: string): Promise<boolean> => invoke(IPC_CHANNELS.WORKSPACE_OPEN_FOLDER, path),
  readFile: (filePath: string): Promise<string> => invoke(IPC_CHANNELS.WORKSPACE_READ_FILE, filePath),
  fileTree: (rootPath: string): Promise<FileTreeNode> => invoke(IPC_CHANNELS.WORKSPACE_FILE_TREE, rootPath),
  search: (rootPath: string, query: string, options?: { extension?: string }): Promise<Array<{ path: string; line: number; content: string }>> =>
    invoke(IPC_CHANNELS.WORKSPACE_SEARCH, rootPath, query, options),
}
