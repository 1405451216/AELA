import type { ContentBlock } from './stream'

export interface Workspace {
  id: string
  name: string
  path: string
  createdAt: string
  lastOpenedAt: string
}

export interface Session {
  id: string
  title: string
  workspaceId: string | null
  modelConfigId: string | null
  systemPrompt: string
  activeSkillIds: string[]
  createdAt: string
  updatedAt: string
  messageCount: number
  parentId?: string | null
  /** 分支点消息 ID（仅分支会话有值） */
  branchMessageId?: string | null
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  contentBlocks?: ContentBlock[]
  toolCalls?: ToolCallInfo[]
  toolResult?: ToolResultInfo
  metrics?: MessageMetrics
  createdAt: string
  /** base64 dataURL for attached image (image/* only) */
  image?: string
}

export interface ToolCallInfo {
  id: string
  name: string
  arguments: string
}

export interface ToolResultInfo {
  toolCallId: string
  content: string
  isError: boolean
}

export interface MessageMetrics {
  totalTurns: number
  totalTools: number
  duration: number
  llmLatency: number
  toolLatency: number
}
