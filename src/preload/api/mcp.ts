// MCP API（含 MCP 资源）
import { invoke, IPC_CHANNELS } from './_shared'
import type { MCPServerConfig, MCPServerStatus, MCPResourceInfo } from '@shared/types'

export const mcpApi = {
  list: (): Promise<MCPServerConfig[]> => invoke(IPC_CHANNELS.MCP_LIST),
  add: (server: Omit<MCPServerConfig, 'id' | 'createdAt'>): Promise<MCPServerConfig> =>
    invoke(IPC_CHANNELS.MCP_ADD, server),
  update: (id: string, partial: Partial<MCPServerConfig>): Promise<MCPServerConfig | undefined> =>
    invoke(IPC_CHANNELS.MCP_UPDATE, id, partial),
  delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.MCP_DELETE, id),
  connect: (id: string): Promise<MCPServerStatus> => invoke(IPC_CHANNELS.MCP_CONNECT, id),
  disconnect: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.MCP_DISCONNECT, id),
  status: (): Promise<MCPServerStatus[]> => invoke(IPC_CHANNELS.MCP_STATUS),
}

export const mcpResourceApi = {
  list: (serverId: string): Promise<MCPResourceInfo[]> => invoke(IPC_CHANNELS.MCP_LIST_RESOURCES, serverId),
  read: (serverId: string, uri: string): Promise<string> => invoke(IPC_CHANNELS.MCP_READ_RESOURCE, serverId, uri),
}
