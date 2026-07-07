import { logError } from '../lib/logger'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalViewProps {
  /** 工作目录 */
  cwd?: string
  /** 指定 shell（留空使用系统默认） */
  shell?: string
  /** 终端关闭回调 */
  onClose?: () => void
  /** 嵌入模式（不显示标题栏） */
  embedded?: boolean
}

/**
 * 内置终端组件
 * 基于 xterm.js + 后端 TerminalService（child_process.spawn）
 */
export default function TerminalView({ cwd, shell, onClose, embedded }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const [status, setStatus] = useState<'initializing' | 'ready' | 'exited'>('initializing')
  const [error, setError] = useState<string | null>(null)

  // 初始化终端
  useEffect(() => {
    if (!containerRef.current) return

    let unmountData: (() => void) | null = null
    let unmountExit: (() => void) | null = null
    let dataDisposable: { dispose: () => void } | null = null

    const init = async () => {
      try {
        // 创建 xterm 实例
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 13,
          fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
          theme: {
            background: '#1e1e2e',
            foreground: '#cdd6f4',
            cursor: '#f5e0dc',
            selectionBackground: '#585b7055',
            black: '#45475a',
            red: '#f38ba8',
            green: '#a6e3a1',
            yellow: '#f9e2af',
            blue: '#89b4fa',
            magenta: '#f5c2e7',
            cyan: '#94e2d5',
            white: '#bac2de',
            brightBlack: '#585b70',
            brightRed: '#f38ba8',
            brightGreen: '#a6e3a1',
            brightYellow: '#f9e2af',
            brightBlue: '#89b4fa',
            brightMagenta: '#f5c2e7',
            brightCyan: '#94e2d5',
            brightWhite: '#a6adc8',
          },
          allowProposedApi: true,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)

        term.open(containerRef.current as HTMLElement)
        fitAddon.fit()

        termRef.current = term
        fitRef.current = fitAddon

        // 创建后端终端会话
        const id = await window.aela.terminal.create({ cwd, shell })
        terminalIdRef.current = id

        // 监听后端数据
        unmountData = window.aela.terminal.onData(id, (data: string) => {
          term.write(data)
        })

        // 监听退出
        unmountExit = window.aela.terminal.onExit(id, (code: number) => {
          term.write(`\r\n\x1b[33m[进程已退出，代码: ${code}]\x1b[0m\r\n`)
          setStatus('exited')
        })

        // 用户输入 → 后端
        dataDisposable = term.onData((data: string) => {
          if (terminalIdRef.current) {
            window.aela.terminal.input(terminalIdRef.current, data).catch((err) => logError('terminal.input', err))
          }
        })

        // 处理 Ctrl+C（返回 void，由 term.dispose() 统一清理）
        term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
          // Ctrl+Shift+C → 复制选中文本
          if (event.ctrlKey && event.shiftKey && event.key === 'C') {
            const selection = term.getSelection()
            if (selection) {
              navigator.clipboard.writeText(selection)
              return false
            }
          }
          // Ctrl+Shift+V → 粘贴
          if (event.ctrlKey && event.shiftKey && event.key === 'V') {
            navigator.clipboard.readText().then(text => {
              if (terminalIdRef.current) {
                window.aela.terminal.input(terminalIdRef.current, text).catch((err) => logError('terminal.inputText', err))
              }
            })
            return false
          }
          return true
        })

        setStatus('ready')
        term.focus()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '终端初始化失败')
        setStatus('exited')
      }
    }

    init()

    // 清理：显式释放所有监听器和终端资源
    return () => {
      unmountData?.()
      unmountExit?.()
      dataDisposable?.dispose()
      if (terminalIdRef.current) {
        window.aela?.terminal?.destroy?.(terminalIdRef.current).catch((err) => logError('terminal.destroy', err))
        terminalIdRef.current = null
      }
      termRef.current?.dispose()
      termRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 窗口大小变化时自动调整
  useEffect(() => {
    const handleResize = () => {
      if (fitRef.current && termRef.current) {
        try {
          fitRef.current.fit()
          if (terminalIdRef.current) {
            const cols = termRef.current.cols
            const rows = termRef.current.rows
            window.aela.terminal.resize(terminalIdRef.current, cols, rows).catch((err) => logError('terminal.resize', err))
          }
        } catch {
          // 忽略 resize 错误
        }
      }
    }

    const observer = new ResizeObserver(handleResize)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handleClose = useCallback(() => {
    if (terminalIdRef.current) {
      window.aela.terminal.destroy(terminalIdRef.current).catch((err) => logError('terminal.destroy', err))
      terminalIdRef.current = null
    }
    onClose?.()
  }, [onClose])

  if (embedded) {
    return (
      <div className="relative w-full h-full bg-[#1e1e2e]">
        <div ref={containerRef} className="w-full h-full" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg-secondary border-t border-border">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">终端</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            status === 'ready'
              ? 'bg-green-900/30 text-green-400'
              : status === 'exited'
              ? 'bg-red-900/30 text-red-400'
              : 'bg-yellow-900/30 text-yellow-400'
          }`}>
            {status === 'ready' ? '运行中' : status === 'exited' ? '已退出' : '初始化中'}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="text-text-muted hover:text-red-400 text-xs px-2 py-0.5 rounded hover:bg-surface-hover transition-colors"
          title="关闭终端"
        >
          ✕
        </button>
      </div>

      {/* 终端区域 */}
      <div className="flex-1 relative bg-[#1e1e2e]">
        <div ref={containerRef} className="w-full h-full" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
