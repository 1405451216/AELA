// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import InputBox from '../../src/renderer/src/components/InputBox'
import type { InputBoxProps } from '../../src/renderer/src/components/InputBox'
import { useAppStore } from '../../src/renderer/src/stores/app'

// 受控输入包装器 — 测试 state 更新逻辑
function ControlledInputBox(props: Partial<InputBoxProps>) {
  const [input, setInput] = useState('')
  const defaultProps: Partial<InputBoxProps> = {
    selectedMode: 'code',
    setSelectedMode: vi.fn(),
    showSkillPicker: false,
    setShowSkillPicker: vi.fn(),
    activeSkillIds: [],
    toggleSkill: vi.fn(),
    skills: [],
    currentModelConfig: null,
    onModelClick: vi.fn(),
    currentWorkspace: null,
    onSelectFolder: vi.fn(),
    input,
    setInput,
    isStreaming: false,
    onSend: vi.fn(),
    onStop: vi.fn(),
    recommendations: [],
    onRecommendation: vi.fn(),
    sendOnEnter: true,
    compact: false,
  }
  return <InputBox {...defaultProps} {...props} />
}

beforeEach(() => {
  ;(globalThis as any).window.aela = {
    config: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue({}) },
  }
  useAppStore.setState({
    currentModelConfig: null,
    currentWorkspace: null,
    skills: [],
    messages: [],
  })
})

describe('InputBox 组件', () => {
  it('组件能正常渲染（不崩溃）', () => {
    const { container } = render(<ControlledInputBox />)
    expect(container).toBeInstanceOf(HTMLElement)
  })

  it('存在输入 textarea', () => {
    render(<ControlledInputBox />)
    const textarea = document.querySelector('textarea')
    expect(textarea).not.toBeNull()
  })

  it('输入框 placeholder 文案存在', () => {
    render(<ControlledInputBox />)
    // 默认 code 模式对应 placeholder
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.placeholder).toBeTruthy()
  })

  it('输入文字后 textarea value 更新', () => {
    render(<ControlledInputBox />)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '测试输入内容' } })
    expect(textarea.value).toBe('测试输入内容')
  })

  it('存在模式切换控件（code / office 两个 pill 按钮）', () => {
    render(<ControlledInputBox />)
    // 模式切换容器是 bg-bg-secondary 的 rounded-full 容器，包含 2 个按钮
    const switcher = document.querySelector('[class*="bg-bg-secondary"][class*="rounded-full"]')
    expect(switcher).not.toBeNull()
    // 内部两个模式按钮
    expect(switcher!.children.length).toBe(2)
    // 每个按钮内含一个 SVG 图标
    Array.from(switcher!.children).forEach(child => {
      expect(child.querySelector('svg')).not.toBeNull()
    })
  })

  it('存在技能按钮', () => {
    render(<ControlledInputBox />)
    expect(screen.getByText('技能')).toBeInTheDocument()
  })

  it('存在模型选择入口', () => {
    render(<ControlledInputBox />)
    expect(screen.getByText('选择模型')).toBeInTheDocument()
  })

  it('sendOnEnter=true 时按 Enter 触发 onSend', () => {
    const onSend = vi.fn()
    render(<ControlledInputBox onSend={onSend} sendOnEnter />)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '冒烟测试' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('sendOnEnter=false 时按 Enter 不触发 onSend', () => {
    const onSend = vi.fn()
    render(<ControlledInputBox onSend={onSend} sendOnEnter={false} />)
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '冒烟测试' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('未配置模型时发送按钮禁用', () => {
    render(<ControlledInputBox currentModelConfig={null} />)
    // 发送按钮是输入框右侧第一个按钮，disabled 属性为 true
    const buttons = Array.from(document.querySelectorAll('button'))
    const sendButton = buttons.find(btn => btn.hasAttribute('disabled'))
    expect(sendButton).toBeTruthy()
  })

  it('配置模型后发送按钮可用', () => {
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
    render(
      <ControlledInputBox
        currentModelConfig={{
          id: 'model-1',
          name: 'Test Model',
          provider: 'test',
          model: 'test-model',
          apiKey: 'sk-test',
          baseUrl: 'https://example.com',
          createdAt: new Date().toISOString(),
        }}
      />
    )
    const buttons = Array.from(document.querySelectorAll('button'))
    const sendButton = buttons.find(btn => !btn.hasAttribute('disabled') && btn.querySelector('svg'))
    expect(sendButton).toBeTruthy()
  })
})
