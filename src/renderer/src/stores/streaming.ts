import { create, type StoreApi } from 'zustand'
import type { StreamEvent, ContentBlock } from '@shared/types'

/**
 * 流式状态切片 — 高性能设计:
 *
 * 核心优化: 用字符串缓冲数组 + 批量 flush 替代逐 token 字符串拼接,
 * 将 O(n²) 降至 O(n), 同时减少 Zustand 更新频率和 React 重渲染次数.
 *
 * 缓冲策略:
 * - 每个 token 推入 buffer 数组 (O(1) push)
 * - 每 FLUSH_INTERVAL_MS (16ms ≈ 1帧) 合并一次 buffer 到 streamingContent
 * - 手动 flush() 在关键节点 (done/error/stop) 立即同步
 */
const FLUSH_INTERVAL_MS = 16 // ~60fps, 平衡流畅度与性能

interface StreamingState {
  isStreaming: boolean
  setStreaming: (streaming: boolean) => void
  streamingContent: string
  contentBlocks: ContentBlock[]
  /** 追加 token 到缓冲 (内部使用, 由 useStreamEvents 调用) */
  appendToken: (content: string) => void
  /** 手动将缓冲 flush到 streamingContent */
  flush: () => void
  resetStreamingContent: () => void
  streamEvents: StreamEvent[]
  addStreamEvent: (event: StreamEvent) => void
  clearStreamEvents: () => void
}

/** 模块级缓冲 + 定时器, 不放在 store 中避免序列化 */
const tokenBuffer: string[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushScheduled = false

/** 事件缓冲 — 批量追加 streamEvents 避免频繁扩组 */
const eventBuffer: StreamEvent[] = []
let eventFlushTimer: ReturnType<typeof setTimeout> | null = null
let eventFlushScheduled = false

const EVENT_FLUSH_INTERVAL_MS = 32 // 事件频率低于 token，32ms 足够

function scheduleFlush(api: StoreApi<StreamingState>) {
  if (flushScheduled) return
  flushScheduled = true
  flushTimer = setTimeout(() => {
    if (tokenBuffer.length > 0) {
      const chunk = tokenBuffer.join('')
      tokenBuffer.length = 0
      api.setState((state) => ({
        streamingContent: state.streamingContent + chunk,
        contentBlocks: [...state.contentBlocks, ...parseBlocks(chunk, state.streamingContent.length)],
      }))
    }
    flushScheduled = false
    flushTimer = null
  }, FLUSH_INTERVAL_MS)
}

function scheduleEventFlush(api: StoreApi<StreamingState>) {
  if (eventFlushScheduled) return
  eventFlushScheduled = true
  eventFlushTimer = setTimeout(() => {
    if (eventBuffer.length > 0) {
      const events = eventBuffer.splice(0, eventBuffer.length)
      api.setState((state) => ({ streamEvents: [...state.streamEvents, ...events] }))
    }
    eventFlushScheduled = false
    eventFlushTimer = null
  }, EVENT_FLUSH_INTERVAL_MS)
}

let blockIdCounter = 0

function parseBlocks(text: string, existingLength: number): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const segments = text.split('\n\n')
  let offset = existingLength
  for (const seg of segments) {
    if (!seg.trim()) continue
    const headingMatch = seg.match(/^#{1,6}\s+(.*)$/s)
    if (headingMatch) {
      blocks.push({
        id: `block-${++blockIdCounter}`,
        type: 'heading',
        content: headingMatch[1],
      })
    } else {
      blocks.push({
        id: `block-${++blockIdCounter}`,
        type: 'paragraph',
        content: seg,
      })
    }
    offset += seg.length + 2
  }
  return blocks
}

/** 立即同步所有缓冲内容到 store */
function flushNow(api: StoreApi<StreamingState>) {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (eventFlushTimer) {
    clearTimeout(eventFlushTimer)
    eventFlushTimer = null
  }
  flushScheduled = false
  eventFlushScheduled = false
  if (tokenBuffer.length > 0) {
    const chunk = tokenBuffer.join('')
    tokenBuffer.length = 0
    api.setState((state) => ({
      streamingContent: state.streamingContent + chunk,
      contentBlocks: [...state.contentBlocks, ...parseBlocks(chunk, state.streamingContent.length)],
    }))
  }
  if (eventBuffer.length > 0) {
    const events = eventBuffer.splice(0, eventBuffer.length)
    api.setState((state) => ({ streamEvents: [...state.streamEvents, ...events] }))
  }
}

export const useStreamingStore = create<StreamingState>((set, get, api) => ({
  isStreaming: false,
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  streamingContent: '',
  contentBlocks: [],
  appendToken: (content) => {
    tokenBuffer.push(content)
    scheduleFlush(api)
  },
  flush: () => flushNow(api),
  resetStreamingContent: () => {
    // 清空所有缓冲和定时器
    tokenBuffer.length = 0
    eventBuffer.length = 0
    blockIdCounter = 0
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
    if (eventFlushTimer) {
      clearTimeout(eventFlushTimer)
      eventFlushTimer = null
    }
    flushScheduled = false
    eventFlushScheduled = false
    set({ streamingContent: '', contentBlocks: [] })
  },
  streamEvents: [],
  addStreamEvent: (event) => {
    eventBuffer.push(event)
    scheduleEventFlush(api)
  },
  clearStreamEvents: () => {
    eventBuffer.length = 0
    if (eventFlushTimer) {
      clearTimeout(eventFlushTimer)
      eventFlushTimer = null
    }
    eventFlushScheduled = false
    set({ streamEvents: [] })
  },
}))
