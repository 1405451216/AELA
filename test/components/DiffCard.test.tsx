// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DiffCard from '../../src/renderer/src/components/chat/DiffCard'

interface DiffCardTestProps {
  diffId: string
  filePath: string
  description: string
  originalContent: string
  fixedContent: string
  onAccept: (id: string) => void
  onReject: (id: string) => void
}

function makeProps(overrides?: Partial<DiffCardTestProps>): DiffCardTestProps {
  return {
    diffId: 'diff-1',
    filePath: 'src/app.ts',
    description: '添加类型注解',
    originalContent: 'const x = 1',
    fixedContent: 'const x: number = 1',
    onAccept: vi.fn(),
    onReject: vi.fn(),
    ...overrides,
  }
}

describe('DiffCard', () => {
  it('应渲染文件路径和描述', () => {
    render(<DiffCard {...makeProps()} />)
    expect(screen.getByText('添加类型注解')).toBeInTheDocument()
    expect(screen.getByText('src/app.ts')).toBeInTheDocument()
  })

  it('应显示 diff 统计', () => {
    render(<DiffCard {...makeProps()} />)
    expect(screen.getByText('+1')).toBeInTheDocument()
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  it('应显示 Accept 按钮', () => {
    render(<DiffCard {...makeProps()} />)
    expect(screen.getByText('Accept')).toBeInTheDocument()
  })

  it('应显示 Reject 按钮', () => {
    render(<DiffCard {...makeProps()} />)
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('应显示 View Details 按钮', () => {
    render(<DiffCard {...makeProps()} />)
    expect(screen.getByText('View Details')).toBeInTheDocument()
  })

  it('点击 Accept 应调用 onAccept', () => {
    const props = makeProps()
    render(<DiffCard {...props} />)
    fireEvent.click(screen.getByText('Accept'))
    expect(props.onAccept).toHaveBeenCalledWith('diff-1')
  })

  it('点击 Reject 应调用 onReject', () => {
    const props = makeProps()
    render(<DiffCard {...props} />)
    fireEvent.click(screen.getByText('Reject'))
    expect(props.onReject).toHaveBeenCalledWith('diff-1')
  })

  it('点击 View Details 应切换展开状态', () => {
    render(<DiffCard {...makeProps()} />)
    fireEvent.click(screen.getByText('View Details'))
    expect(screen.getByText('▼')).toBeInTheDocument()
  })

  it('不展开时显示折叠提示', () => {
    const longOriginal = Array(20).fill('const a = 1').join('\n')
    const longFixed = Array(20).fill('const a: number = 1').join('\n')
    render(
      <DiffCard
        {...makeProps({ originalContent: longOriginal, fixedContent: longFixed })}
      />,
    )
    // 折叠提示文案「点击 View Details 查看全部 N 行变更」也含 "View Details"，
    // 故用 getByRole 精确命中「View Details」按钮，避免与提示文案歧义冲突
    expect(screen.getByRole('button', { name: /View Details/ })).toBeInTheDocument()
  })
})
