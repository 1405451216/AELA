// AELA — @-mention 补全下拉
// 在 InputBox textarea 中检测 @ 字符，显示补全选项
// 支持 @file（文件搜索）、@memory（记忆检索）、@web（URL 引用）

import { useState, useEffect, useCallback } from 'react'
import type { MentionItem, MentionType } from '../commands/mentionSystem'
import { detectMentionInput } from '../commands/mentionSystem'

export interface MentionDropdownProps {
  /** 输入文本 */
  input: string
  /** 光标位置 */
  cursorPos: number
  /** 当前工作区 */
  workspace: { rootPath?: string; id?: string } | null
  /** 选中引用项时的回调 */
  onSelect: (item: MentionItem) => void
  /** 是否可见（由父组件控制） */
  visible: boolean
}

// 模拟数据 — 实际将通过 IPC 从主进程获取
const FILE_SUGGESTIONS = [
  { label: 'package.json', ref: 'package.json', icon: '📄' },
  { label: 'README.md', ref: 'README.md', icon: '📄' },
  { label: 'src/main/index.ts', ref: 'src/main/index.ts', icon: '📄' },
  { label: 'src/renderer/src/App.tsx', ref: 'src/renderer/src/App.tsx', icon: '📄' },
  { label: 'src/main/services/AgentService.ts', ref: 'src/main/services/AgentService.ts', icon: '📄' },
]

const MEMORY_SUGGESTIONS = [
  { label: '用户偏好：TypeScript strict 模式', ref: 'pref:ts-strict', icon: '🧠' },
  { label: '项目上下文：Electron + React 架构', ref: 'ctx:arch', icon: '🧠' },
  { label: '最近对话：ReAct Agent 调优', ref: 'conv:react-tune', icon: '🧠' },
]

const TYPE_SUGGESTIONS: Array<{ type: MentionType; label: string; icon: string; desc: string }> = [
  { type: 'file', label: 'file', icon: '📄', desc: '引用工作区文件' },
  { type: 'memory', label: 'memory', icon: '🧠', desc: '检索记忆库' },
  { type: 'web', label: 'web', icon: '🌐', desc: '引用网页 URL' },
]

export default function MentionDropdown({ input, cursorPos, onSelect, visible }: MentionDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [suggestions, setSuggestions] = useState<Array<{ label: string; ref: string; icon: string; type: MentionType; content: string }>>([])

  // 检测当前 @-mention 状态
  const mentionState = visible ? detectMentionInput(input, cursorPos) : null

  // 根据类型和查询生成建议
  useEffect(() => {
    if (!mentionState) {
      setSuggestions([])
      return
    }

    if (mentionState.type === '') {
      // 显示类型选择
      setSuggestions(TYPE_SUGGESTIONS.map(t => ({
        label: `${t.icon} @${t.label}`,
        ref: t.label,
        icon: t.icon,
        type: t.type,
        content: t.desc,
      })))
    } else if (mentionState.type === 'file') {
      // 文件搜索（模拟）
      const q = mentionState.query.toLowerCase()
      const filtered = FILE_SUGGESTIONS.filter(f =>
        f.label.toLowerCase().includes(q)
      )
      setSuggestions(filtered.map(f => ({
        label: f.label,
        ref: `file:${f.ref}`,
        icon: f.icon,
        type: 'file' as MentionType,
        content: `[文件: ${f.label}]\n（文件内容将通过 IPC 加载）`,
      })))
    } else if (mentionState.type === 'memory') {
      // 记忆搜索（模拟）
      const q = mentionState.query.toLowerCase()
      const filtered = MEMORY_SUGGESTIONS.filter(m =>
        m.label.toLowerCase().includes(q)
      )
      setSuggestions(filtered.map(m => ({
        label: m.label,
        ref: `memory:${m.ref}`,
        icon: m.icon,
        type: 'memory' as MentionType,
        content: `[记忆: ${m.label}]`,
      })))
    } else if (mentionState.type === 'web') {
      // Web URL — 只显示提示
      setSuggestions([{
        label: mentionState.query || '输入 URL...',
        ref: `web:${mentionState.query}`,
        icon: '🌐',
        type: 'web' as MentionType,
        content: `[网页引用: ${mentionState.query}]`,
      }])
    }
    setSelectedIndex(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionState?.type, mentionState?.query])

  // 键盘导航
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!mentionState || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && mentionState) {
      e.preventDefault()
      e.stopPropagation()
      const selected = suggestions[selectedIndex]
      if (selected) {
        onSelect({
          type: selected.type,
          label: selected.label,
          ref: selected.ref,
          content: selected.content,
          icon: selected.icon,
        })
      }
    } else if (e.key === 'Escape') {
      // 让父组件处理关闭
    }
  }, [mentionState, suggestions, selectedIndex, onSelect])

  useEffect(() => {
    if (mentionState && suggestions.length > 0) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleKeyDown, mentionState, suggestions.length])

  if (!mentionState || suggestions.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 z-40 w-[420px] max-w-[90vw] bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden">
      {/* 提示头 */}
      <div className="px-3 py-1.5 border-b border-border text-[10px] text-text-muted flex items-center gap-2">
        <span>💡</span>
        <span>
          {mentionState.type === '' ? '选择引用类型' :
           mentionState.type === 'file' ? '搜索文件...' :
           mentionState.type === 'memory' ? '搜索记忆...' :
           '输入网页 URL...'}
        </span>
      </div>
      {/* 建议列表 */}
      <div className="max-h-[240px] overflow-y-auto py-1">
        {suggestions.map((item, index) => (
          <button
            key={`${item.type}-${item.ref}-${index}`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => {
              onSelect({
                type: item.type,
                label: item.label,
                ref: item.ref,
                content: item.content,
                icon: item.icon,
              })
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? 'bg-surface-active text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover'
            }`}
          >
            <span className="text-sm w-5 text-center shrink-0">{item.icon}</span>
            <span className="flex-1 text-sm truncate">{item.label}</span>
            <span className="text-[10px] text-text-muted shrink-0">@{item.type}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
