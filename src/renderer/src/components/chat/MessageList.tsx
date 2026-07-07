// 消息列表虚拟化组件（T7 试点）
// 仅虚拟化历史消息列表；流式内容 / diff 卡片等尾部内容由 ChatView 在列表之外渲染。
// 采用 VariableSizeList + 基于内容长度的估值高度（pilot 阶段不引入 DOM 测量，降低复杂度）。

import { useEffect, useRef, useState, useCallback } from 'react'
import { VariableSizeList, type ListChildComponentProps } from 'react-window'
import type { ChatMessage } from '@shared/types'
import MessageBubble from './MessageBubble'
import ToolCallDisplay from './ToolCallDisplay'

interface MessageListProps {
  messages: ChatMessage[]
}

// 估值单条消息高度：基础高度 + 内容长度权重，超长截断（仅为估值，无需精确测量）
function estimateItemSize(msg: ChatMessage): number {
  const base = 96
  const len = msg.content?.length ?? 0
  return Math.min(base + Math.ceil(len / 2), 1400)
}

export default function MessageList({ messages }: MessageListProps) {
  const listRef = useRef<VariableSizeList>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  // 自适应容器高度（外层为 flex-1 区域），让虚拟列表填满可用空间
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setHeight(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 消息数量 / 内容变化后重置估值缓存，避免复用旧高度
  useEffect(() => {
    listRef.current?.resetAfterIndex(0)
  }, [messages])

  // 新消息到达时自动滚到底部
  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToItem(messages.length - 1, 'end')
    }
  }, [messages.length])

  const Row = useCallback(({ index, style }: ListChildComponentProps) => {
    const msg = messages[index]
    return (
      <div style={style} className="pb-4 px-1">
        <MessageBubble message={msg} />
        {msg.role === 'tool' && msg.toolResult && (
          <ToolCallDisplay
            toolCallId={msg.toolResult.toolCallId}
            content={msg.toolResult.content}
            isError={msg.toolResult.isError}
          />
        )}
      </div>
    )
  }, [messages])

  if (messages.length === 0) return null

  return (
    <div ref={wrapRef} className="flex-1 min-h-0 w-full">
      {height > 0 && (
        <VariableSizeList
          ref={listRef}
          height={height}
          width="100%"
          itemCount={messages.length}
          itemSize={(i) => estimateItemSize(messages[i])}
          itemData={messages}
          overscanCount={4}
          className="max-w-4xl mx-auto"
        >
          {Row}
        </VariableSizeList>
      )}
    </div>
  )
}
