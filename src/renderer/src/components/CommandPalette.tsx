// AELA — 命令面板组件
// 由 Cmd+P / Ctrl+P 触发，模糊搜索并执行命令
// 支持键盘导航（↑↓ 选择、Enter 执行、Esc 关闭）

import { useState, useMemo, useRef, useEffect } from 'react'
import { commandRegistry, type Command } from '../commands/commandRegistry'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 模糊搜索结果
  const results = useMemo(() => {
    if (!open) return []
    return commandRegistry.search(query).slice(0, 20) // 限制最多 20 条
  }, [query, open])

  // 重置状态
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      // 延迟聚焦，确保 DOM 已渲染
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // 选中索引重置（搜索结果变化时）
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = results[selectedIndex]
      if (cmd) {
        cmd.run()
        onClose()
      }
    }
  }

  // 滚动到选中项
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!open) return null

  const categoryLabels: Record<Command['category'], string> = {
    navigation: '导航',
    action: '操作',
    settings: '设置',
    agent: 'Agent',
  }

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-50 bg-black/40 flex-start"
        onClick={onClose}
      />
      {/* 命令面板容器 */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-50 w-[560px] max-w-[90vw] bg-bg-secondary border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="text-text-muted text-base">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入命令名称..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
          />
          <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-surface">
            ESC
          </span>
        </div>
        {/* 搜索结果 */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              未找到匹配的命令
            </div>
          ) : (
            results.map((cmd, index) => (
              <button
                key={cmd.id}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  cmd.run()
                  onClose()
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-surface-active text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {/* 图标 */}
                <span className="text-base w-5 text-center shrink-0">
                  {cmd.icon || '○'}
                </span>
                {/* 标签 */}
                <span className="flex-1 text-sm truncate">{cmd.label}</span>
                {/* 分类 */}
                <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded bg-surface shrink-0">
                  {categoryLabels[cmd.category]}
                </span>
                {/* 快捷键 */}
                {cmd.shortcut && (
                  <span className="text-[10px] text-text-muted shrink-0">
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-muted">
          <span>↑↓ 导航</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </>
  )
}
