// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OnboardingWizard from '../../src/renderer/src/components/OnboardingWizard'
import OnboardingStepModel from '../../src/renderer/src/components/onboarding/OnboardingStepModel'
import OnboardingStepWorkspace from '../../src/renderer/src/components/onboarding/OnboardingStepWorkspace'
import OnboardingStepShortcuts from '../../src/renderer/src/components/onboarding/OnboardingStepShortcuts'
import OnboardingStepPrivacy from '../../src/renderer/src/components/onboarding/OnboardingStepPrivacy'

// Mock window.aela API
const mockAela = {
  model: {
    list: vi.fn().mockResolvedValue([]),
    add: vi.fn().mockResolvedValue({ id: 'model-1', name: 'Test Model' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(true),
    setDefault: vi.fn().mockResolvedValue(true),
    test: vi.fn().mockResolvedValue({ success: true, message: 'Connected' }),
  },
  config: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue({}),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue(null),
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).window.aela = mockAela
})

describe('OnboardingWizard', () => {
  it('渲染欢迎标题', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText('欢迎使用 AELA')).toBeInTheDocument()
  })

  it('显示步骤指示器', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText('模型配置')).toBeInTheDocument()
    expect(screen.getByText('工作区')).toBeInTheDocument()
    expect(screen.getByText('快捷键')).toBeInTheDocument()
    expect(screen.getByText('隐私声明')).toBeInTheDocument()
  })

  it('初始显示第一步（模型配置）', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText('配置 AI 模型')).toBeInTheDocument()
  })

  it('点击下一步切换到工作区步骤', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('下一步 →'))
    expect(screen.getByText('选择工作区')).toBeInTheDocument()
  })

  it('上一步按钮返回前一步', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    fireEvent.click(screen.getByText('下一步 →'))
    expect(screen.getByText('选择工作区')).toBeInTheDocument()
    fireEvent.click(screen.getByText('← 上一步'))
    expect(screen.getByText('配置 AI 模型')).toBeInTheDocument()
  })

  it('第一步时上一步按钮禁用', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText('← 上一步')).toBeDisabled()
  })

  it('最后一步显示"开始使用"按钮', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    // 快速导航到最后一步
    fireEvent.click(screen.getByText('下一步 →'))
    fireEvent.click(screen.getByText('下一步 →'))
    fireEvent.click(screen.getByText('下一步 →'))
    expect(screen.getByText('开始使用 →')).toBeInTheDocument()
  })

  it('点击"开始使用"调用 onComplete', () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('下一步 →'))
    fireEvent.click(screen.getByText('下一步 →'))
    fireEvent.click(screen.getByText('下一步 →'))
    fireEvent.click(screen.getByText('开始使用 →'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('点击"跳过引导"调用 onComplete', () => {
    const onComplete = vi.fn()
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('跳过引导'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('显示进度条', () => {
    render(<OnboardingWizard onComplete={vi.fn()} />)
    expect(screen.getByText('步骤 1 / 4')).toBeInTheDocument()
  })
})

describe('OnboardingStepModel', () => {
  it('渲染预设选项', () => {
    render(<OnboardingStepModel />)
    expect(screen.getByText('OpenAI GPT-4o')).toBeInTheDocument()
    expect(screen.getByText('DeepSeek Chat')).toBeInTheDocument()
  })

  it('点击预设展开表单', () => {
    render(<OnboardingStepModel />)
    fireEvent.click(screen.getByText('OpenAI GPT-4o'))
    expect(screen.getByPlaceholderText('如: 我的 GPT-4o')).toBeInTheDocument()
  })

  it('显示"手动配置"按钮', () => {
    render(<OnboardingStepModel />)
    expect(screen.getByText('+ 手动配置')).toBeInTheDocument()
  })

  it('表单空字段时显示错误不能进入下一步', () => {
    render(<OnboardingStepModel />)
    // 展开预设表单
    fireEvent.click(screen.getByText('OpenAI GPT-4o'))
    // 不填写任何字段，直接提交（选择提交按钮，而非标题）
    const submitButton = screen.getByRole('button', { name: '添加模型' })
    fireEvent.click(submitButton)
    // 应显示验证错误提示
    expect(screen.getByText('请填写名称、API Key 和模型名称')).toBeInTheDocument()
  })

  it('API Key 连通性测试失败时显示错误', async () => {
    // 模拟已添加的模型列表
    mockAela.model.list.mockResolvedValue([
      { id: 'model-1', name: 'Test Model', provider: 'openai', apiKey: 'sk-fake', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' } as any,
    ])
    // mock test 失败
    mockAela.model.test.mockResolvedValue({ success: false, message: 'Invalid API key' })

    render(<OnboardingStepModel />)
    await waitFor(() => screen.getByText('Test Model'))

    fireEvent.click(screen.getByText('测试'))

    await waitFor(() => {
      expect(screen.getByText('✗ 测试失败: Invalid API key')).toBeInTheDocument()
    })
  })

  it('"测试中..." loading 态验证', async () => {
    // 模拟异步测试延迟
    mockAela.model.list.mockResolvedValue([
      { id: 'model-1', name: 'Test Model', provider: 'openai', apiKey: 'sk-fake', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1' } as any,
    ])
    let resolveTest: () => void
    const testPromise = new Promise<{ success: boolean; message: string }>((resolve) => {
      resolveTest = () => resolve({ success: true, message: 'Connected' })
    })
    mockAela.model.test.mockReturnValue(testPromise)

    render(<OnboardingStepModel />)
    await waitFor(() => screen.getByText('Test Model'))

    fireEvent.click(screen.getByText('测试'))

    // 等待 "测试中..." 出现
    await waitFor(() => {
      expect(screen.getByText('测试中...')).toBeInTheDocument()
    })

    // 完成测试
    resolveTest!()
    await waitFor(() => {
      expect(screen.getByText('测试')).toBeInTheDocument()
    })
  })
})

describe('OnboardingStepWorkspace', () => {
  it('渲染工作区选择界面', () => {
    render(<OnboardingStepWorkspace />)
    expect(screen.getByText('选择工作区')).toBeInTheDocument()
    expect(screen.getByText('未选择')).toBeInTheDocument()
  })

  it('显示"浏览..."按钮', () => {
    render(<OnboardingStepWorkspace />)
    expect(screen.getByText('浏览...')).toBeInTheDocument()
  })

  it('点击"浏览..."调用 showOpenDialog', async () => {
    render(<OnboardingStepWorkspace />)
    fireEvent.click(screen.getByText('浏览...'))
    await waitFor(() => expect(mockAela.dialog.showOpenDialog).toHaveBeenCalled())
  })

  it('选择文件夹后显示路径', async () => {
    mockAela.dialog.showOpenDialog.mockResolvedValue(['/home/user/projects/my-app'])
    render(<OnboardingStepWorkspace />)
    fireEvent.click(screen.getByText('浏览...'))
    await waitFor(() => {
      expect(screen.getByText('/home/user/projects/my-app')).toBeInTheDocument()
    })
  })
})

describe('OnboardingStepShortcuts', () => {
  it('渲染快捷键速览', () => {
    render(<OnboardingStepShortcuts />)
    expect(screen.getByText('快捷键速览')).toBeInTheDocument()
  })

  it('显示快捷键分组', () => {
    render(<OnboardingStepShortcuts />)
    expect(screen.getByText('通用')).toBeInTheDocument()
    expect(screen.getByText('聊天')).toBeInTheDocument()
    expect(screen.getByText('工作台')).toBeInTheDocument()
    expect(screen.getByText('编辑器')).toBeInTheDocument()
  })

  it('显示示例快捷键', () => {
    render(<OnboardingStepShortcuts />)
    expect(screen.getByText('打开命令面板')).toBeInTheDocument()
    expect(screen.getByText('发送消息')).toBeInTheDocument()
  })
})

describe('OnboardingStepPrivacy', () => {
  it('渲染隐私声明', () => {
    render(<OnboardingStepPrivacy />)
    expect(screen.getByText('隐私声明')).toBeInTheDocument()
  })

  it('显示数据收集相关信息', () => {
    render(<OnboardingStepPrivacy />)
    expect(screen.getByText(/始终保存在本地设备/)).toBeInTheDocument()
    expect(screen.getByText(/API 通信/)).toBeInTheDocument()
    expect(screen.getByText(/遥测与诊断/)).toBeInTheDocument()
    expect(screen.getByText(/本地存储/)).toBeInTheDocument()
  })

  it('显示完成提示', () => {
    render(<OnboardingStepPrivacy />)
    expect(screen.getByText(/最后一步！/)).toBeInTheDocument()
  })
})

describe('OnboardingWizard 跳过引导', () => {
  it('跳过引导直接完成后配置 completedOnboarding', async () => {
    mockAela.config.set.mockResolvedValue({ completedOnboarding: true })
    const onComplete = vi.fn().mockImplementation(async () => {
      await window.aela.config.set({ completedOnboarding: true })
    })

    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('跳过引导'))

    expect(onComplete).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(mockAela.config.set).toHaveBeenCalledWith({ completedOnboarding: true })
    })
  })
})
