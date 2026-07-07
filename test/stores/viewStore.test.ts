import { describe, it, expect, beforeEach } from 'vitest'
import { useViewStore } from '../../src/renderer/src/stores/viewStore'

describe('viewStore', () => {
  beforeEach(() => {
    // 重置到初始状态
    useViewStore.setState({
      currentView: 'chat',
      error: null,
      loading: false,
    })
  })

  describe('初始状态', () => {
    it('默认视图为 chat', () => {
      expect(useViewStore.getState().currentView).toBe('chat')
    })

    it('error 初始为 null', () => {
      expect(useViewStore.getState().error).toBeNull()
    })

    it('loading 初始为 false', () => {
      expect(useViewStore.getState().loading).toBe(false)
    })
  })

  describe('setView', () => {
    it('切换到不同视图', () => {
      useViewStore.getState().setView('models')
      expect(useViewStore.getState().currentView).toBe('models')
    })

    it('切换到 settings 视图', () => {
      useViewStore.getState().setView('settings')
      expect(useViewStore.getState().currentView).toBe('settings')
    })

    it('切换到所有 ViewType 值', () => {
      const views = [
        'chat', 'models', 'mcp', 'settings', 'workspaces', 'skills',
        'automation', 'orchestration', 'rag', 'planning', 'terminal',
        'dashboard', 'hooks', 'preview', 'multifile', 'testgen', 'wiki',
        'agentconfig', 'codereview', 'subagent', 'img2code', 'memorySearch',
        'orchTemplates', 'observability', 'fewShotWeight', 'toolLearning',
        'securityPreset', 'sessionManager', 'adaptiveLearning',
        'screenshotAnalysis', 'resilience',
      ] as const

      for (const view of views) {
        useViewStore.getState().setView(view)
        expect(useViewStore.getState().currentView).toBe(view)
      }
    })
  })

  describe('setError', () => {
    it('设置错误消息', () => {
      useViewStore.getState().setError('网络错误')
      expect(useViewStore.getState().error).toBe('网络错误')
    })

    it('清除错误（传 null）', () => {
      useViewStore.getState().setError('临时错误')
      useViewStore.getState().setError(null)
      expect(useViewStore.getState().error).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('设置 loading 为 true', () => {
      useViewStore.getState().setLoading(true)
      expect(useViewStore.getState().loading).toBe(true)
    })

    it('设置 loading 为 false', () => {
      useViewStore.getState().setLoading(true)
      useViewStore.getState().setLoading(false)
      expect(useViewStore.getState().loading).toBe(false)
    })
  })

  describe('状态独立性', () => {
    it('切换视图不影响 error', () => {
      useViewStore.getState().setError('错误信息')
      useViewStore.getState().setView('models')
      expect(useViewStore.getState().error).toBe('错误信息')
    })

    it('设置 error 不影响 loading', () => {
      useViewStore.getState().setLoading(true)
      useViewStore.getState().setError('新错误')
      expect(useViewStore.getState().loading).toBe(true)
    })
  })
})
