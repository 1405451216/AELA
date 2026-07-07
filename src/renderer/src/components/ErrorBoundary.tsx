import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * 全局 Error Boundary — 捕获 React 组件树中的未处理异常
 * 防止单个组件崩溃导致整个应用白屏
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    // 输出到控制台便于调试
    console.error('[ErrorBoundary] 捕获到未处理异常:', error, errorInfo)
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-bg-primary text-text-primary">
          <div className="max-w-2xl mx-auto p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-2">应用遇到了错误</h1>
            <p className="text-text-secondary mb-6">
              页面发生了意外错误。你可以尝试重新加载页面或重置组件状态。
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-bg-tertiary text-left overflow-auto max-h-48">
                <p className="text-sm font-mono text-error-text">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-xs font-mono text-text-secondary mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="px-6 py-2 rounded-lg bg-bg-tertiary hover:opacity-80 transition-opacity"
              >
                尝试恢复
              </button>
              <button
                onClick={this.handleReload}
                className="px-6 py-2 rounded-lg bg-accent-primary text-white hover:opacity-80 transition-opacity"
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
