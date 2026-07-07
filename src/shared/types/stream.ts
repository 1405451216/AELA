import type { MessageMetrics } from './session'
import type { ToolCallInfo, ToolResultInfo } from './session'

export interface SubAgentInfo {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  content: string
  toolCalls?: Array<{
    name: string
    args: string
    result?: string
    isError?: boolean
    isPending?: boolean
  }>
  metrics?: MessageMetrics
}

export type StreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_call'; toolCall: ToolCallInfo; turn: number }
  | { type: 'tool_result'; result: ToolResultInfo; turn: number }
  | { type: 'turn_end'; turn: number }
  | { type: 'done'; metrics: MessageMetrics }
  | { type: 'error'; error: string | Error }
  | { type: 'sub_agent_start'; agentId: string; agentName: string }
  | { type: 'sub_agent_token'; agentId: string; content: string }
  | { type: 'sub_agent_tool_call'; agentId: string; toolName: string; toolArgs: string }
  | { type: 'sub_agent_tool_result'; agentId: string; toolName: string; result: string; isError?: boolean }
   | { type: 'sub_agent_done'; agentId: string; metrics?: MessageMetrics }

export interface ContentBlock {
  id: string
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'blockquote' | 'tool_call'
  content: string
  metadata?: {
    language?: string
    toolName?: string
    toolId?: string
    isError?: boolean
  }
}

export interface ActivityEvent {
  id: string
  type: 'tool_start' | 'tool_end' | 'reasoning' | 'context_update' | 'agent_thought'
  toolName?: string
  toolId?: string
  duration?: number
  isError?: boolean
  content?: string
  turn?: number
  files?: string[]
  diagnostics?: number
  timestamp: string
}
