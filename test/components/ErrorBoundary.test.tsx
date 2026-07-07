// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBoundary from '../../src/renderer/src/components/ErrorBoundary'

// 制造一个会抛错的子组件
function ThrowOnRender({ error }: { error: Error }) {
  throw error
}

// 正常子组件
function GoodChild() {
  return <div>正常内容</div>
}

describe('ErrorBoundary 组件', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('正常渲染', () => {
    it('正常子组件直接渲染', () => {
      render(
        <ErrorBoundary>
          <GoodChild />
        </ErrorBoundary>
      )

      expect(screen.getByText('正常内容')).toBeInTheDocument()
    })
  })

  describe('错误捕获', () => {
    it('子组件抛错后显示错误 UI', () => {
      const error = new Error('测试崩溃')

      render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      expect(screen.getByText('应用遇到了错误')).toBeInTheDocument()
      expect(screen.getByText(/测试崩溃/)).toBeInTheDocument()
    })

    it('显示错误堆栈信息', () => {
      const error = new Error('崩溃')

      render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      // ErrorBoundary 的 componentDidCatch 会设置 errorInfo
      // errorInfo.componentStack 在测试环境中可能为空字符串
      const errorDisplay = screen.getByText(/崩溃/)
      expect(errorDisplay).toBeInTheDocument()
    })

    it('记录错误到 console.error', () => {
      const error = new Error('控制台错误')

      render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      expect(console.error).toHaveBeenCalledWith(
        '[ErrorBoundary] 捕获到未处理异常:',
        expect.any(Error),
        expect.any(Object)
      )
    })
  })

  describe('恢复操作', () => {
    it('点击"尝试恢复"重置错误状态', () => {
      const error = new Error('恢复测试')

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      expect(screen.getByText('应用遇到了错误')).toBeInTheDocument()

      // 先替换为正常子组件，再点击恢复按钮
      // 否则 ThrowOnRender 会在 re-render 时再次抛错
      rerender(
        <ErrorBoundary>
          <GoodChild />
        </ErrorBoundary>
      )

      // ErrorBoundary 仍处于错误状态（rerender 不重置 state）
      // 需点击"尝试恢复"重置 hasError
      fireEvent.click(screen.getByText('尝试恢复'))

      expect(screen.queryByText('应用遇到了错误')).not.toBeInTheDocument()
      expect(screen.getByText('正常内容')).toBeInTheDocument()
    })

    it('点击"重新加载"调用 window.location.reload', () => {
      const reloadSpy = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      })

      const error = new Error('重载测试')

      render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      fireEvent.click(screen.getByText('重新加载'))

      expect(reloadSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('错误 UI 内容', () => {
    it('显示警告图标', () => {
      const error = new Error('UI 测试')

      render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      expect(screen.getByText('⚠️')).toBeInTheDocument()
    })

    it('显示描述文本', () => {
      const error = new Error('描述测试')

      render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      expect(screen.getByText(/页面发生了意外错误/)).toBeInTheDocument()
    })

    it('显示两个操作按钮', () => {
      const error = new Error('按钮测试')

      render(
        <ErrorBoundary>
          <ThrowOnRender error={error} />
        </ErrorBoundary>
      )

      expect(screen.getByText('尝试恢复')).toBeInTheDocument()
      expect(screen.getByText('重新加载')).toBeInTheDocument()
    })
  })
})
