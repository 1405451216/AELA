// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatView from '../../src/renderer/src/components/ChatView'
import { useAppStore } from '../../src/renderer/src/stores/app'
import { useStreamingStore } from '../../src/renderer/src/stores/streaming'

// Mock window.aela API（ChatView 强依赖）
const mockAela = {
  agent: {
    runStream: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(true),
    pause: vi.fn().mockResolvedValue(true),
    resume: vi.fn().mockResolvedValue(true),
    status: vi.fn().mockResolvedValue('idle'),
    onStreamEvent: vi.fn().mockReturnValue(vi.fn()),
  },
  session: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'sess-1', title: '新任务' }),
    delete: vi.fn().mockResolvedValue(true),
    getMessages: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(null),
    setActiveSkills: vi.fn().mockResolvedValue(null),
  },
  workspace: {
    add: vi.fn().mockResolvedValue(null),
    open: vi.fn().mockResolvedValue(true),
  },
  model: {
    list: vi.fn().mockResolvedValue([]),
  },
  config: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue({}),
  },
  fileChange: {
    list: vi.fn().mockResolvedValue([]),
    accept: vi.fn().mockResolvedValue(undefined),
    reject: vi.fn().mockResolvedValue(undefined),
  },
  hitl: {
    onPendingAdded: vi.fn().mockReturnValue(vi.fn()),
    resume: vi.fn().mockResolvedValue(true),
  },
  skill: {
    list: vi.fn().mockResolvedValue({ skills: [] }),
  },
}

beforeEach(() => {
  ;(globalThis as any).window.aela = mockAela
  // 重置 store 到默认状态
  useAppStore.setState({
    messages: [],
    currentSession: null,
    currentModelConfig: null,
    currentWorkspace: null,
    currentView: 'chat',
    error: null,
    skills: [],
    appConfig: null,
  })
  useStreamingStore.setState({
    isStreaming: false,
    streamingContent: '',
    streamEvents: [],
  })
  // 清理 sessionStorage
  sessionStorage.clear()
})

describe('ChatView 组件', () => {
  it('组件能正常渲染（不崩溃）', () => {
    const { container } = render(<ChatView />)
    expect(container).toBeInstanceOf(HTMLElement)
  })

  it('欢迎页包含 AELA Hero Logo（SVG 组件）', () => {
    const { container } = render(<ChatView />)
    // AELA Hero Logo 是 SVG 组件，不再使用文本
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('存在输入 textarea', () => {
    render(<ChatView />)
    const textarea = document.querySelector('textarea')
    expect(textarea).not.toBeNull()
  })

  it('配置模型后显示发送按钮', async () => {
    // 必须先配置模型，发送按钮才可用
    useAppStore.setState({
      currentModelConfig: {
        id: 'model-1',
        name: 'Test Model',
        provider: 'test',
        model: 'test-model',
        apiKey: 'sk-test',
        baseUrl: 'https://example.com',
        createdAt: new Date().toISOString(),
      },
    })
    render(<ChatView />)
    const sendButton = document.querySelector('button[title]')
    expect(sendButton).not.toBeNull()
  })

  it('包含模型选择入口（配置模型后可点击）', async () => {
    useAppStore.setState({
      currentModelConfig: {
        id: 'model-1',
        name: 'Test Model',
        provider: 'test',
        model: 'test-model',
        apiKey: 'sk-test',
        baseUrl: 'https://example.com',
        createdAt: new Date().toISOString(),
      },
    })
    render(<ChatView />)
    // 配置模型后 InputBox 中应有按钮可点击
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
