// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import VoiceOutput from '../../src/renderer/src/components/chat/VoiceOutput'

beforeEach(() => {
  window.speechSynthesis.cancel = vi.fn()
  window.speechSynthesis.speak = vi.fn()
})

afterEach(() => {
  cleanup()
})

describe('VoiceOutput 组件', () => {
  it('组件能正常渲染（不崩溃）', () => {
    const { container } = render(
      <VoiceOutput text="你好世界" />
    )
    expect(container).toBeInstanceOf(HTMLElement)
  })

  it('存在朗读按钮', () => {
    render(<VoiceOutput text="你好世界" />)
    const button = screen.getByLabelText('朗读消息')
    expect(button).toBeInTheDocument()
  })

  it('点击按钮触发朗读', () => {
    render(<VoiceOutput text="你好世界" />)
    const button = screen.getByLabelText('朗读消息')
    fireEvent.click(button)
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1)
  })

  it('再次点击按钮停止朗读', () => {
    window.speechSynthesis.speak = vi.fn().mockImplementation((utterance: any) => {
      act(() => {
        if (utterance.onstart) utterance.onstart({} as SpeechSynthesisEvent)
      })
    })

    render(<VoiceOutput text="你好世界" />)
    const button = screen.getByLabelText('朗读消息')
    fireEvent.click(button)

    expect(button.getAttribute('aria-label')).toBe('停止朗读')

    fireEvent.click(button)
    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
  })

  it('设置了正确的语言', () => {
    render(<VoiceOutput text="Hello world" language="en-US" />)
    const button = screen.getByLabelText('朗读消息')
    fireEvent.click(button)

    expect(window.speechSynthesis.speak).toHaveBeenCalled()
    const callArgs = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.lang).toBe('en-US')
  })

  it('设置了正确的速率', () => {
    render(<VoiceOutput text="你好" rate={1.5} />)
    const button = screen.getByLabelText('朗读消息')
    fireEvent.click(button)

    const callArgs = (window.speechSynthesis.speak as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs.rate).toBe(1.5)
  })

  it('按钮被禁用时不渲染', () => {
    const { container } = render(
      <VoiceOutput text="你好世界" disabled />
    )
    expect(container.innerHTML).toBe('')
  })

  it('组件卸载时取消朗读', () => {
    const { unmount } = render(
      <VoiceOutput text="你好世界" />
    )
    unmount()
    expect(window.speechSynthesis.cancel).toHaveBeenCalled()
  })
})
