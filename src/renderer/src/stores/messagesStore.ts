// 消息状态切片（聊天主消息列表）
import { create } from 'zustand'
import type { ChatMessage } from '@shared/types'

interface MessagesState {
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (msg: ChatMessage) => void
  /**
   * 更新最后一条 assistant 消息的内容（流式输出场景下逐 token 调用）。
   * 不存在 assistant 消息时为 no-op。
   */
  updateLastAssistantMessage: (content: string) => void
  editMessage: (messageId: string, newContent: string) => void
  deleteAfter: (messageId: string) => void
  clearMessages: () => void
}

export const useMessagesStore = create<MessagesState>((set) => ({
  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  updateLastAssistantMessage: (content) =>
    set((state) => {
      const msgs = [...state.messages]
      const lastIdx = msgs.length - 1
      if (lastIdx < 0 || msgs[lastIdx].role !== 'assistant') {
        return state
      }
      msgs[lastIdx] = { ...msgs[lastIdx], content }
      return { messages: msgs }
    }),
  editMessage: (messageId, newContent) =>
    set((state) => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, content: newContent } : m
      ),
    })),
  deleteAfter: (messageId) =>
    set((state) => {
      const idx = state.messages.findIndex(m => m.id === messageId)
      if (idx < 0) return state
      return { messages: state.messages.slice(0, idx + 1) }
    }),
  clearMessages: () => set({ messages: [] }),
}))