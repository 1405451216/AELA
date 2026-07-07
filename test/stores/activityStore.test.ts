import { describe, it, expect, beforeEach } from 'vitest'
import { useActivityStore } from '../../src/renderer/src/stores/activityStore'

describe('activityStore', () => {
  beforeEach(() => useActivityStore.getState().clear())

  it('addActivity 添加事件', () => {
    useActivityStore.getState().addActivity({
      id: '1', type: 'tool_start', toolName: 'read_file', timestamp: ''
    })
    expect(useActivityStore.getState().activities.length).toBe(1)
  })

  it('updateActivity 更新已有事件', () => {
    const store = useActivityStore.getState()
    store.addActivity({ id: '1', type: 'tool_start', toolName: 'read_file', timestamp: '' })
    store.updateActivity('1', { type: 'tool_end', duration: 12, isError: false })
    const act = useActivityStore.getState().activities[0]
    expect(act.type).toBe('tool_end')
    expect(act.duration).toBe(12)
  })

  it('clear 清空事件', () => {
    useActivityStore.getState().addActivity({ id: '1', type: 'tool_start', toolName: 'read_file', timestamp: '' })
    useActivityStore.getState().clear()
    expect(useActivityStore.getState().activities).toEqual([])
  })

  it('toggleExpanded 切换展开状态', () => {
    expect(useActivityStore.getState().isExpanded).toBe(true)
    useActivityStore.getState().toggleExpanded()
    expect(useActivityStore.getState().isExpanded).toBe(false)
  })
})
