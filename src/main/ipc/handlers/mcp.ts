// MCP 服务器管理 + MCP 资源 IPC handlers
// MCP_LIST, MCP_ADD, MCP_UPDATE, MCP_DELETE, MCP_CONNECT, MCP_DISCONNECT,
// MCP_STATUS, MCP_LIST_RESOURCES, MCP_READ_RESOURCE

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { MCPServerConfig } from '@shared/types'
import type { ConfigStore } from '../../services/ConfigStore'
import type { AgentService } from '../../services/AgentService'
import { wrap } from '../../utils/ipcHelpers'
import {
  validateInput,
  mcpIdSchema,
  mcpAddSchema,
  mcpResourceSchema,
} from '../schemas'
import { randomUUID } from 'crypto'

export function registerMcpHandlers(params: {
  configStore: ConfigStore
  agentService: AgentService
}): void {
  const { configStore, agentService } = params
  const toolManager = agentService.getToolManager()

  ipcMain.handle(IPC_CHANNELS.MCP_LIST, async () => {
    return wrap(() => configStore.getMCPServers())
  })

  ipcMain.handle(IPC_CHANNELS.MCP_ADD, async (_, server: Omit<MCPServerConfig, 'id' | 'createdAt'>) => {
    const validation = validateInput(mcpAddSchema, server)
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      const newServer: MCPServerConfig = {
        ...server,
        id: randomUUID(),
        createdAt: new Date().toISOString()
      }
      configStore.addMCPServer(newServer)
      return newServer
    })
  })

  ipcMain.handle(IPC_CHANNELS.MCP_UPDATE, async (_, id: string, partial: Partial<MCPServerConfig>) => {
    const validation = validateInput(mcpIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      configStore.updateMCPServer(id, partial)
      return configStore.getMCPServer(id)
    })
  })

  ipcMain.handle(IPC_CHANNELS.MCP_DELETE, async (_, id: string) => {
    const validation = validateInput(mcpIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      if (toolManager) await toolManager.disconnectMCP(id)
      configStore.deleteMCPServer(id)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.MCP_CONNECT, async (_, id: string) => {
    const validation = validateInput(mcpIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      const config = configStore.getMCPServer(id)
      if (!config || !toolManager) throw new Error('MCP server not found')
      return toolManager.connectMCP(config)
    })
  })

  ipcMain.handle(IPC_CHANNELS.MCP_DISCONNECT, async (_, id: string) => {
    const validation = validateInput(mcpIdSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      if (toolManager) await toolManager.disconnectMCP(id)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.MCP_STATUS, async () => {
    return wrap(() => toolManager?.getMCPStatus() ?? [])
  })

  // ===== MCP 资源 =====
  ipcMain.handle(IPC_CHANNELS.MCP_LIST_RESOURCES, async (_, serverId: string) => {
    const validation = validateInput(mcpIdSchema, { id: serverId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => toolManager?.listMCPResources(serverId) ?? [])
  })

  ipcMain.handle(IPC_CHANNELS.MCP_READ_RESOURCE, async (_, serverId: string, uri: string) => {
    const validation = validateInput(mcpResourceSchema, { serverId, uri })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => toolManager?.readMCPResource(serverId, uri) ?? '')
  })
}
