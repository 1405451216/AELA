import { describe, it, expect, beforeEach } from 'vitest'
import { useStreamingStore } from '../../src/renderer/src/stores/streaming'

describe('streamingStore contentBlocks', () => {
  beforeEach(() => {
    useStreamingStore.getState().resetStreamingContent()
  })

  it('appendToken + flush 应生成 contentBlocks', () => {
    const { appendToken, flush } = useStreamingStore.getState()
    appendToken('## Hello\n')
    appendToken('World')
    flush()
    const blocks = useStreamingStore.getState().contentBlocks
    expect(blocks.length).toBeGreaterThan(0)
  })

  it('resetStreamingContent 应清除 contentBlocks', () => {
    useStreamingStore.getState().appendToken('test')
    useStreamingStore.getState().flush()
    useStreamingStore.getState().resetStreamingContent()
    expect(useStreamingStore.getState().contentBlocks).toEqual([])
  })

  it('兼容旧 streamingContent 字段', () => {
    useStreamingStore.getState().appendToken('legacy content')
    useStreamingStore.getState().flush()
    expect(useStreamingStore.getState().streamingContent).toBe('legacy content')
  })
})
