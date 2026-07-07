// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Sidebar from '../../src/renderer/src/components/Sidebar'
import { useAppStore } from '../../src/renderer/src/stores/app'

// Mock window.aela API（Sidebar 调用 workspace.list + session.list 等）
const mockAela = {
  workspace: {
    list: vi.fn().mockResolvedValue([]),
  },
  session: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'sess-1', title: '新任务' }),
    delete: vi.fn().mockResolvedValue(true),
    getMessages: vi.fn().mockResolvedValue([]),
  },
  config: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue({}),
  },
}

beforeEach(() => {
  ;(globalThis as any).window.aela = mockAela
  // 重置 store 到默认状态
  useAppStore.setState({
    currentView: 'chat',
    currentSession: null,
    currentWorkspace: null,
    currentModelConfig: null,
    theme: 'dark',
    messages: [],
    error: null,
    skills: [],
  })
})

describe('Sidebar 组件', () => {
  it('组件能正常渲染（不崩溃）', async () => {
    const { container } = render(<Sidebar />)
    // 等待异步 session 加载完成
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    expect(container).toBeInstanceOf(HTMLElement)
  })

  it('显示 AELA 品牌标识', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    expect(screen.getByText('AELA')).toBeInTheDocument()
  })

  it('包含主导航入口（新建任务/技能/自动化）', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    // 根据 i18n 默认中文渲染
    expect(screen.getByText('新建任务')).toBeInTheDocument()
    expect(screen.getByText('技能')).toBeInTheDocument()
    expect(screen.getByText('自动化')).toBeInTheDocument()
  })

  it('包含底部设置入口', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    // 设置按钮的 accessible name 包含 "设置" + 模型状态文案（如 "未配置"），用正则匹配
    const settingsButton = screen.getByRole('button', { name: /设置/ })
    expect(settingsButton).toBeInTheDocument()
  })

  it('设置按钮显示模型状态指示', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    // 未配置模型时显示"未配置"
    expect(screen.getByText('未配置')).toBeInTheDocument()
  })

  it('点击技能导航链接切换到 skills 视图', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    const skillsButton = screen.getByText('技能')
    fireEvent.click(skillsButton)
    expect(useAppStore.getState().currentView).toBe('skills')
  })

  it('点击自动化导航链接切换到 automation 视图', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    const automationButton = screen.getByText('自动化')
    fireEvent.click(automationButton)
    expect(useAppStore.getState().currentView).toBe('automation')
  })

  it('底部设置按钮点击切换到 settings 视图', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    const settingsButton = screen.getByRole('button', { name: /设置/ })
    fireEvent.click(settingsButton)
    expect(useAppStore.getState().currentView).toBe('settings')
  })

  it('包含任务搜索框', async () => {
    render(<Sidebar />)
    await waitFor(() => expect(mockAela.session.list).toHaveBeenCalled())
    const searchInput = screen.getByPlaceholderText('搜索任务...')
    expect(searchInput).toBeInTheDocument()
  })
})
