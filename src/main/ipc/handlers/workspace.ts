// Workspace IPC handlers
// WORKSPACE_ADD, WORKSPACE_LIST, WORKSPACE_GET, WORKSPACE_OPEN, WORKSPACE_SET_ROOTS,
// WORKSPACE_READ_FILE, WORKSPACE_WRITE_FILE, WORKSPACE_FILE_TREE, WORKSPACE_SEARCH,
// WORKSPACE_REMOVE, WORKSPACE_OPEN_FOLDER

import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC_CHANNELS } from '@shared/types'
import type { Workspace } from '@shared/types'
import type { ConfigStore } from '../../services/ConfigStore'
import type { AgentService } from '../../services/AgentService'
import type { WorkspaceManager} from '../../services/WorkspaceManager';
import { setAllowedRoots } from '../../services/WorkspaceManager'
import { getSkillScanner } from '../../services/SkillScanner'
import {
  validateInput,
  workspaceReadFileSchema,
  workspaceOpenFolderSchema,
  workspaceFileTreeSchema,
  workspaceSearchSchema,
  workspaceIdSchema,
} from '../schemas'
import { wrap } from '../../utils/ipcHelpers'

// Need access to syncToolManager for workspace open
let syncToolManagerRef: (() => void) | null = null

export function setSyncToolManager(fn: () => void): void {
  syncToolManagerRef = fn
}

export function registerWorkspaceHandlers(params: {
  configStore: ConfigStore
  agentService: AgentService
  workspaceManager: WorkspaceManager
}): void {
  const { configStore, agentService, workspaceManager } = params

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST, async () => {
    return wrap(() => configStore.getWorkspaces())
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ADD, async () => {
    return wrap(async () => {
      const folderPath = await workspaceManager.selectFolder()
      if (!folderPath) return null

      const name = folderPath.split(/[/\\]/).pop() || 'workspace'
      const workspace: Workspace = {
        id: randomUUID(),
        name,
        path: folderPath,
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString()
      }
      configStore.addWorkspace(workspace)
      return workspace
    })
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE, async (_, id: string) => {
    const validation = validateInput(workspaceIdSchema, id)
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      configStore.removeWorkspace(id)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_FOLDER, async (_, path: string) => {
    const validation = validateInput(workspaceOpenFolderSchema, { path })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      // 设置 Agent 的工作区
      agentService.setWorkspace(path)
      // 同步设置环境变量，供 SkillScanner 等服务使用
      process.env['AELA_WORKSPACE_PATH'] = path
      // 更新允许读取的根目录列表，限制 WorkspaceManager 的文件访问范围
      const allWorkspaces = configStore.getWorkspaces()
      setAllowedRoots(allWorkspaces.map(w => w.path))
      // 工作区变更后重新扫描 skills（包含工作区级目录）
      getSkillScanner().scanAll().catch(err =>
        console.error('[SkillScanner] Rescan after workspace change failed:', err)
      )
      // 工作区变更后同步 toolManager 到所有编排服务
      syncToolManagerRef?.()
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_READ_FILE, async (_, filePath: string) => {
    const validation = validateInput(workspaceReadFileSchema, { filePath })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => workspaceManager.readFile(filePath))
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_FILE_TREE, async (_, rootPath: string) => {
    const validation = validateInput(workspaceFileTreeSchema, { rootPath })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => workspaceManager.getFileTree(rootPath))
  })

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SEARCH, async (_, rootPath: string, query: string, options?: { extension?: string }) => {
    const validation = validateInput(workspaceSearchSchema, { rootPath, query, options })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => workspaceManager.searchFiles(rootPath, query, options))
  })
}
