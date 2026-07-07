import { useState, useCallback } from 'react'
import { useAppStore } from '../../stores/app'
import { useStreamingStore } from '../../stores/streaming'
import type { StreamEvent, ChatMessage, FileChangeRecord, HITLInterruptRequest } from '@shared/types'
import type { SubAgentState } from './SubAgentPanel'
import { randomUUID } from '../../utils'

export interface UseStreamEventsReturn {
  fileChanges: FileChangeRecord[]
  setFileChanges: React.Dispatch<React.SetStateAction<FileChangeRecord[]>>
  hitlRequest: HITLInterruptRequest | null
  setHitlRequest: React.Dispatch<React.SetStateAction<HITLInterruptRequest | null>>
  subAgents: SubAgentState[]
  setSubAgents: React.Dispatch<React.SetStateAction<SubAgentState[]>>
  handleStreamEvent: (event: StreamEvent) => void
  clearState: () => void
}

export function useStreamEvents(): UseStreamEventsReturn {
  const addMessage = useAppStore(s => s.addMessage)
  const setError = useAppStore(s => s.setError)
  const appendStreamingContent = useStreamingStore(s => s.appendToken)
  const resetStreamingContent = useStreamingStore(s => s.resetStreamingContent)
  const setStreaming = useStreamingStore(s => s.setStreaming)

  const [fileChanges, setFileChanges] = useState<FileChangeRecord[]>([])
  const [hitlRequest, setHitlRequest] = useState<HITLInterruptRequest | null>(null)
  const [subAgents, setSubAgents] = useState<SubAgentState[]>([])

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'token':
        // 走缓冲路径 — 每 16ms 批量 flush 到 streamingContent
        appendStreamingContent(event.content)
        break
      case 'tool_call':
        useStreamingStore.getState().addStreamEvent(event)
        break
      case 'tool_result':
        useStreamingStore.getState().addStreamEvent(event)
        break
      // ===== 子 Agent 事件 =====
      case 'sub_agent_start':
        setSubAgents(prev => [
          ...prev,
          {
            id: event.agentId,
            name: event.agentName,
            status: 'running',
            content: '',
            toolCalls: [],
          },
        ])
        break
      case 'sub_agent_token':
        setSubAgents(prev =>
          prev.map(a =>
            a.id === event.agentId
              ? { ...a, content: a.content + event.content }
              : a
          )
        )
        break
      case 'sub_agent_tool_call':
        setSubAgents(prev =>
          prev.map(a =>
            a.id === event.agentId
              ? {
                  ...a,
                  toolCalls: [
                    ...a.toolCalls,
                    { name: event.toolName, args: event.toolArgs, isPending: true },
                  ],
                }
              : a
          )
        )
        break
      case 'sub_agent_tool_result':
        setSubAgents(prev =>
          prev.map(a => {
            if (a.id !== event.agentId) return a
            const updatedToolCalls = [...a.toolCalls]
            for (let i = updatedToolCalls.length - 1; i >= 0; i--) {
              if (updatedToolCalls[i].name === event.toolName && updatedToolCalls[i].isPending) {
                updatedToolCalls[i] = {
                  ...updatedToolCalls[i],
                  result: event.result,
                  isError: event.isError || false,
                  isPending: false,
                }
                break
              }
            }
            return { ...a, toolCalls: updatedToolCalls }
          })
        )
        break
      case 'sub_agent_done':
        setSubAgents(prev =>
          prev.map(a =>
            a.id === event.agentId
              ? { ...a, status: 'done' as const, metrics: event.metrics as SubAgentState['metrics'] }
              : a
          )
        )
        break
      // ===== 原有事件 =====
      case 'done': {
        // 立即 flush 缓冲, 确保所有 token 都写入 streamingContent
        useStreamingStore.getState().flush()
        const content = useStreamingStore.getState().streamingContent
        if (content) {
          const assistantMsg: ChatMessage = {
            id: randomUUID(),
            sessionId: useAppStore.getState().currentSession?.id || '',
            role: 'assistant',
            content,
            metrics: event.metrics,
            createdAt: new Date().toISOString()
          }
          addMessage(assistantMsg)
        }
        resetStreamingContent()
        setStreaming(false)
        break
      }
      case 'error':
        // 错误时也要 flush 缓冲
        useStreamingStore.getState().flush()
        // event.error may be an Error object or a string — always coerce to string
        setError(typeof event.error === 'string' ? event.error : (event.error instanceof Error ? event.error.message : String(event.error)))
        setStreaming(false)
        break
    }
  }, [appendStreamingContent, resetStreamingContent, setStreaming, addMessage, setError])

  const clearState = useCallback(() => {
    setFileChanges([])
    setHitlRequest(null)
    setSubAgents([])
  }, [])

  return {
    fileChanges,
    setFileChanges,
    hitlRequest,
    setHitlRequest,
    subAgents,
    setSubAgents,
    handleStreamEvent,
    clearState,
  }
}
