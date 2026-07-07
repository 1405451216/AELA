export interface MCPServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'http'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  autoStart: boolean
  enabled: boolean
  createdAt: string
}

export interface MCPServerStatus {
  id: string
  name: string
  connected: boolean
  toolCount: number
  tools: MCPToolInfo[]
  error?: string
}

export interface MCPToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface MCPResourceInfo {
  uri: string
  name: string
  description?: string
  mimeType?: string
}
