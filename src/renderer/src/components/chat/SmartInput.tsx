import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react'

interface MentionItem {
  id: string
  label: string
  detail?: string
  icon?: string
}

interface SmartInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  isStreaming?: boolean
  workspaceFiles?: string[]
  diagnostics?: { file: string; message: string; severity: 'error' | 'warning' }[]
  terminalHistory?: string[]
}

export default function SmartInput({
  value,
  onChange,
  onSend,
  isStreaming = false,
  workspaceFiles = [],
  diagnostics = [],
  terminalHistory = [],
}: SmartInputProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownItems, setDropdownItems] = useState<MentionItem[]>([])
  const [dropdownFilter, setDropdownFilter] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const detectTrigger = useCallback((text: string) => {
    const atMatch = text.match(/@(\S*)$/)
    if (atMatch) {
      return { type: 'file' as const, query: atMatch[1] }
    }
    const errorMatch = text.match(/#error\s*(\S*)$/i)
    if (errorMatch) {
      return { type: 'error' as const, query: errorMatch[1] }
    }
    const terminalMatch = text.match(/#terminal\s*(\S*)$/i)
    if (terminalMatch) {
      return { type: 'terminal' as const, query: terminalMatch[1] }
    }
    return null
  }, [])

  const updateDropdown = useCallback((text: string) => {
    const trigger = detectTrigger(text)
    if (!trigger) {
      setShowDropdown(false)
      return
    }

    let items: MentionItem[] = []
    if (trigger.type === 'file') {
      items = workspaceFiles
        .filter(f => !trigger.query || f.toLowerCase().includes(trigger.query.toLowerCase()))
        .slice(0, 8)
        .map(f => ({ id: f, label: f.split('/').pop() || f, detail: f, icon: '📄' }))
    } else if (trigger.type === 'error') {
      items = diagnostics
        .filter(d => d.severity === 'error')
        .filter(d => !trigger.query || d.file.toLowerCase().includes(trigger.query.toLowerCase()) || d.message.toLowerCase().includes(trigger.query.toLowerCase()))
        .slice(0, 8)
        .map((d, i) => ({ id: `err-${i}`, label: d.message.slice(0, 50), detail: d.file, icon: '❌' }))
    } else if (trigger.type === 'terminal') {
      items = [...new Set(terminalHistory)]
        .filter(cmd => !trigger.query || cmd.toLowerCase().includes(trigger.query.toLowerCase()))
        .slice(0, 8)
        .map((cmd, i) => ({ id: `term-${i}`, label: cmd, icon: '⌨️' }))
    }

    setDropdownItems(items)
    setDropdownFilter(trigger.query)
    setSelectedIndex(0)
    setShowDropdown(items.length > 0)
  }, [detectTrigger, workspaceFiles, diagnostics, terminalHistory])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    onChange(newVal)
    updateDropdown(newVal)
  }

  const insertItem = (item: MentionItem) => {
    const atMatch = value.match(/@(\S*)$/)
    const errorMatch = value.match(/#error\s*(\S*)$/i)
    const terminalMatch = value.match(/#terminal\s*(\S*)$/i)

    let newValue = value
    if (atMatch) {
      newValue = value.slice(0, value.length - atMatch[0].length) + `@${item.id} `
    } else if (errorMatch) {
      newValue = value.slice(0, value.length - errorMatch[0].length) + `#${item.id} `
    } else if (terminalMatch) {
      newValue = value.slice(0, value.length - terminalMatch[0].length) + `#${item.id} `
    }
    onChange(newValue)
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, dropdownItems.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' && dropdownItems[selectedIndex]) {
        e.preventDefault()
        insertItem(dropdownItems[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        setShowDropdown(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  useEffect(() => {
    if (!showDropdown) return
    const dropdown = dropdownRef.current
    if (!dropdown) return
    const selected = dropdown.children[selectedIndex] as HTMLElement | undefined
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, showDropdown])

  return (
    <div className="relative w-full">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="输入消息... 输入 @file 引用文件, #error 查看诊断, #terminal 查看终端"
        rows={2}
        disabled={isStreaming}
        className="w-full resize-none rounded-lg bg-bg-secondary border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent transition-all"
      />
      {showDropdown && dropdownItems.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-bg-secondary shadow-lg z-50"
        >
          {dropdownItems.map((item, i) => (
            <div
              key={item.id}
              onMouseDown={(e) => { e.preventDefault(); insertItem(item) }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                i === selectedIndex ? 'bg-accent/20 text-text-primary' : 'text-text-muted hover:bg-surface-hover'
              }`}
            >
              {item.icon && <span>{item.icon}</span>}
              <span className="font-mono truncate">{item.label}</span>
              {item.detail && item.detail !== item.label && (
                <span className="text-text-muted truncate ml-auto opacity-60">{item.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
