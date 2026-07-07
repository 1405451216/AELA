import { describe, it, expect, beforeEach } from 'vitest'
import { useDiffStore } from '../../src/renderer/src/stores/diffStore'

describe('diffStore', () => {
  beforeEach(() => useDiffStore.getState().clearDiffs())

  it('addDiff 添加 diff', () => {
    useDiffStore.getState().addDiff({ id: '1', filePath: 'test.ts', description: 'fix', originalContent: 'a', fixedContent: 'b', checkpointId: 'c1', timestamp: '2024-01-01', triggerSource: 'terminal' })
    expect(useDiffStore.getState().diffs.length).toBe(1)
  })

  it('acceptDiff 接受 diff', () => {
    useDiffStore.getState().addDiff({ id: '1', filePath: 'test.ts', description: 'fix', originalContent: 'a', fixedContent: 'b', checkpointId: 'c1', timestamp: '2024-01-01', triggerSource: 'terminal' })
    useDiffStore.getState().acceptDiff('1')
    expect(useDiffStore.getState().diffs[0].status).toBe('accepted')
  })

  it('rejectDiff 拒绝 diff', () => {
    useDiffStore.getState().addDiff({ id: '1', filePath: 'test.ts', description: 'fix', originalContent: 'a', fixedContent: 'b', checkpointId: 'c1', timestamp: '2024-01-01', triggerSource: 'terminal' })
    useDiffStore.getState().rejectDiff('1')
    expect(useDiffStore.getState().diffs[0].status).toBe('rejected')
  })

  it('clear 清空 diffs', () => {
    useDiffStore.getState().addDiff({ id: '1', filePath: 'test.ts', description: 'fix', originalContent: 'a', fixedContent: 'b', checkpointId: 'c1', timestamp: '2024-01-01', triggerSource: 'terminal' })
    useDiffStore.getState().clearDiffs()
    expect(useDiffStore.getState().diffs).toEqual([])
  })
})
