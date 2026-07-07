// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import VoiceInput from '../../src/renderer/src/components/chat/VoiceInput'

class MockSpeechRecognition {
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onend: (() => void) | null = null
  onstart: (() => void) | null = null
  start() {}
  stop() {}
  abort() {}
  _emit(event: string, data?: any) {
    if (event === 'result' && this.onresult) this.onresult(data)
    if (event === 'error' && this.onerror) this.onerror(data)
    if (event === 'end' && this.onend) this.onend()
    if (event === 'start' && this.onstart) this.onstart()
  }
}

let createdInstances: MockSpeechRecognition[] = []
let MockConstructor: new () => MockSpeechRecognition

beforeEach(() => {
  createdInstances = []
  MockConstructor = class extends MockSpeechRecognition {
    constructor() {
      super()
      createdInstances.push(this)
    }
  } as any

  Object.defineProperty(window, 'webkitSpeechRecognition', {
    writable: true,
    configurable: true,
    value: MockConstructor,
  })
})

afterEach(() => {
  cleanup()
  delete (window as any).webkitSpeechRecognition
  delete (window as any).SpeechRecognition
})

function getInstance() {
  return createdInstances[createdInstances.length - 1]
}

describe('VoiceInput 组件', () => {
  it('组件能正常渲染（不崩溃）', () => {
    const { container } = render(
      <VoiceInput language="zh-CN" onResult={vi.fn()} />
    )
    expect(container).toBeInstanceOf(HTMLElement)
  })

  it('存在语音输入按钮', () => {
    render(<VoiceInput language="zh-CN" onResult={vi.fn()} />)
    const button = screen.getByLabelText('语音输入')
    expect(button).toBeInTheDocument()
  })

  it('点击按钮开始录音', () => {
    render(<VoiceInput language="zh-CN" onResult={vi.fn()} />)
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)
    expect(getInstance()).toBeDefined()
  })

  it('录音中按钮停止录音', () => {
    const stopSpy = vi.spyOn(MockSpeechRecognition.prototype, 'stop')
    render(<VoiceInput language="zh-CN" onResult={vi.fn()} />)
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)

    act(() => {
      getInstance()._emit('start')
    })

    const stopButton = screen.getByLabelText('停止录音')
    fireEvent.click(stopButton)
    expect(stopSpy).toHaveBeenCalledTimes(1)
    stopSpy.mockRestore()
  })

  it('识别到最终结果时调用 onResult', () => {
    const onResult = vi.fn()
    render(<VoiceInput language="zh-CN" onResult={onResult} />)
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)

    act(() => {
      getInstance()._emit('result', {
        results: {
          0: { 0: { transcript: '你好世界' }, isFinal: true },
          length: 1,
        },
        resultIndex: 0,
      })
    })

    expect(onResult).toHaveBeenCalledWith('你好世界')
  })

  it('识别到临时结果时调用 onInterim', () => {
    const onInterim = vi.fn()
    render(<VoiceInput language="zh-CN" onResult={vi.fn()} onInterim={onInterim} />)
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)

    act(() => {
      getInstance()._emit('result', {
        results: {
          0: { 0: { transcript: '你好' }, isFinal: false },
          length: 1,
        },
        resultIndex: 0,
      })
    })

    expect(onInterim).toHaveBeenCalledWith('你好')
  })

  it('权限被拒绝时显示错误', () => {
    render(<VoiceInput language="zh-CN" onResult={vi.fn()} />)
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)

    act(() => {
      getInstance()._emit('error', { error: 'not-allowed' })
    })

    expect(screen.getByText('麦克风权限被拒绝')).toBeInTheDocument()
  })

  it('未检测到语音时显示错误', () => {
    render(<VoiceInput language="zh-CN" onResult={vi.fn()} />)
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)

    act(() => {
      getInstance()._emit('error', { error: 'no-speech' })
    })

    expect(screen.getByText('未检测到语音')).toBeInTheDocument()
  })

  it('按钮被禁用时不启动录音', () => {
    render(<VoiceInput language="zh-CN" onResult={vi.fn()} disabled />)
    const button = screen.getByLabelText('语音输入') as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('浏览器不支持时不渲染任何内容', () => {
    delete (window as any).webkitSpeechRecognition
    delete (window as any).SpeechRecognition

    const { container } = render(
      <VoiceInput language="zh-CN" onResult={vi.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('设置正确的语言', () => {
    render(<VoiceInput language="en-US" onResult={vi.fn()} />)
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)
    expect(getInstance().lang).toBe('en-US')
  })

  it('组件卸载时停止录音', () => {
    const abortSpy = vi.spyOn(MockSpeechRecognition.prototype, 'abort')
    const { unmount } = render(
      <VoiceInput language="zh-CN" onResult={vi.fn()} />
    )
    const button = screen.getByLabelText('语音输入')
    fireEvent.click(button)

    act(() => {
      getInstance()._emit('start')
    })

    unmount()
    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })
})
