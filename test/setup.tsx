import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// 每个测试后自动清理 DOM
afterEach(() => {
  cleanup()
})

// 以下 mock 仅在 jsdom 环境下生效（node 环境无 window 对象）
if (typeof window !== 'undefined') {
  // Mock window.matchMedia（jsdom 不支持）
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  }

  // Mock window.location.reload（jsdom 不支持）
  if (!window.location.reload) {
    Object.defineProperty(window.location, 'reload', {
      writable: true,
      value: vi.fn(),
    })
  }

  // Mock SpeechSynthesisUtterance（jsdom 不支持）
  if (typeof (globalThis as any).SpeechSynthesisUtterance === 'undefined') {
    (globalThis as any).SpeechSynthesisUtterance = class MockSpeechSynthesisUtterance {
      text: string
      lang = ''
      rate = 1
      pitch = 1
      volume = 1
      voice: any = null
      onstart: any = null
      onend: any = null
      onerror: any = null
      onpause: any = null
      onresume: any = null
      onboundary: any = null
      onmark: any = null

      constructor(text?: string) {
        this.text = text || ''
      }
    }
  }

  // Mock window.speechSynthesis（jsdom 不支持）
  if (!window.speechSynthesis) {
    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
        pending: false,
        speaking: false,
        paused: false,
        onvoiceschanged: null,
      },
    })
  }
}
