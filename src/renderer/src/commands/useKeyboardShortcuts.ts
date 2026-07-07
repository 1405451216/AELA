// AELA — 键盘快捷键 Hook
// 在 App 根组件中调用一次，注册全局键盘快捷键
// 支持命令面板（Cmd+P / Ctrl+P）、侧边栏切换、导航等

import { useEffect, useState } from 'react'
import { useViewStore } from '../stores/viewStore'
import { commandRegistry, createNavigationCommand } from './commandRegistry'

// 快捷键修饰符前缀（跨平台）
const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
const MOD = isMac ? 'metaKey' : 'ctrlKey'

export interface KeyboardShortcut {
  key: string
  mod: boolean // 是否需要 Cmd/Ctrl
  shift?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts() {
  const setView = useViewStore(s => s.setView)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // 注册内置导航命令
  useEffect(() => {
    const navCommands = [
      createNavigationCommand('nav.chat', '对话', 'chat', setView),
      createNavigationCommand('nav.settings', '设置', 'settings', setView),
      createNavigationCommand('nav.skills', '技能管理', 'skills', setView),
      createNavigationCommand('nav.automation', '自动化任务', 'automation', setView),
      createNavigationCommand('nav.orchestration', '多 Agent 编排', 'orchestration', setView),
      createNavigationCommand('nav.dashboard', '仪表盘', 'dashboard', setView),
      createNavigationCommand('nav.terminal', '终端', 'terminal', setView),
      createNavigationCommand('nav.models', '模型配置', 'models', setView),
      createNavigationCommand('nav.mcp', 'MCP 服务器', 'mcp', setView),
      createNavigationCommand('nav.rag', 'RAG 管道', 'rag', setView),
      createNavigationCommand('nav.memory', '记忆搜索', 'memorySearch', setView),
      createNavigationCommand('nav.observability', '可观测性', 'observability', setView),
      createNavigationCommand('nav.resilience', '弹性容错', 'resilience', setView),
      createNavigationCommand('nav.sessionManager', '会话管理', 'sessionManager', setView),
    ]
    commandRegistry.registerAll(navCommands)

    // 注册动作命令
    commandRegistry.register({
      id: 'action.togglePalette',
      label: '打开命令面板',
      category: 'action',
      shortcut: isMac ? '⌘P' : 'Ctrl+P',
      run: () => setPaletteOpen(true),
    })
    commandRegistry.register({
      id: 'action.toggleSidebar',
      label: '切换侧边栏',
      category: 'action',
      shortcut: isMac ? '⌘B' : 'Ctrl+B',
      run: () => {
        // 触发自定义事件让 Sidebar 监听
        window.dispatchEvent(new CustomEvent('aela-toggle-sidebar'))
      },
    })
  }, [setView])

  // 全局键盘监听
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 命令面板：Cmd/Ctrl+P
      if (e[MOD] && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setPaletteOpen(prev => !prev)
        return
      }

      // 侧边栏：Cmd/Ctrl+B
      if (e[MOD] && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('aela-toggle-sidebar'))
        return
      }

      // 设置：Cmd/Ctrl+,
      if (e[MOD] && e.key === ',') {
        e.preventDefault()
        setView('settings')
        return
      }

      // 快速导航：Cmd/Ctrl+1~9
      if (e[MOD] && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const navMap: Record<string, Parameters<typeof setView>[0]> = {
          '1': 'chat',
          '2': 'settings',
          '3': 'skills',
          '4': 'automation',
          '5': 'orchestration',
          '6': 'dashboard',
          '7': 'terminal',
          '8': 'models',
          '9': 'mcp',
        }
        const view = navMap[e.key]
        if (view) setView(view)
        return
      }

      // Escape 关闭命令面板
      if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [paletteOpen, setView])

  return { paletteOpen, setPaletteOpen }
}
