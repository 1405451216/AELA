// @vitest-environment jsdom

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Dialog from '../../src/renderer/src/components/Dialog'
import { useDialogStore } from '../../src/renderer/src/stores/dialog'

describe('Dialog 组件', () => {
  beforeEach(() => {
    // 重置 store 状态
    useDialogStore.setState({
      visible: false,
      options: { message: '' },
      resolveFn: null,
      inputValue: '',
    })
  })

  describe('可见性控制', () => {
    it('visible=false 时不渲染任何内容', () => {
      const { container } = render(<Dialog />)
      expect(container).toBeEmptyDOMElement()
    })

    it('调用 show() 后渲染对话框', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({ message: '测试消息' })

      await waitFor(() => {
        expect(screen.getByText('测试消息')).toBeInTheDocument()
      })
    })
  })

  describe('confirm 模式', () => {
    it('显示标题和消息', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        title: '确认删除',
        message: '确定要删除吗？',
        confirmText: '删除',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByText('确认删除')).toBeInTheDocument()
        expect(screen.getByText('确定要删除吗？')).toBeInTheDocument()
      })
    })

    it('点击确认按钮返回 true', async () => {
      const user = userEvent.setup()
      render(<Dialog />)
      const promise = useDialogStore.getState().show({
        message: '测试',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByText('确定')).toBeInTheDocument()
      })
      await user.click(screen.getByText('确定'))

      expect(await promise).toBe(true)
    })

    it('点击取消按钮返回 false', async () => {
      const user = userEvent.setup()
      render(<Dialog />)
      const promise = useDialogStore.getState().show({
        message: '测试',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByText('取消')).toBeInTheDocument()
      })
      await user.click(screen.getByText('取消'))

      expect(await promise).toBe(false)
    })

    it('点击遮罩层返回 false', async () => {
      const user = userEvent.setup()
      render(<Dialog />)
      const promise = useDialogStore.getState().show({
        message: '测试',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByText('测试')).toBeInTheDocument()
      })

      // 点击遮罩层（role=dialog 的外层 div）
      const overlay = screen.getByRole('dialog')
      await user.click(overlay)

      expect(await promise).toBe(false)
    })
  })

  describe('alert 模式（无取消按钮）', () => {
    it('不渲染取消按钮', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        message: '提示信息',
        confirmText: '知道了',
        cancelText: '',
      })

      await waitFor(() => {
        expect(screen.getByText('知道了')).toBeInTheDocument()
        expect(screen.queryByText('取消')).not.toBeInTheDocument()
      })
    })
  })

  describe('prompt 模式（带输入框）', () => {
    it('渲染输入框', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        message: '请输入名称',
        inputMode: 'text',
        inputPlaceholder: '名称',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByPlaceholderText('名称')).toBeInTheDocument()
      })
    })

    it('输入值后点击确定返回输入内容', async () => {
      const user = userEvent.setup()
      render(<Dialog />)
      const promise = useDialogStore.getState().show({
        message: '请输入名称',
        inputMode: 'text',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toBeInTheDocument()
      })

      await user.type(screen.getByRole('textbox'), '我的任务')
      await user.click(screen.getByText('确定'))

      expect(await promise).toBe('我的任务')
    })

    it('点击取消返回 null', async () => {
      const user = userEvent.setup()
      render(<Dialog />)
      const promise = useDialogStore.getState().show({
        message: '请输入名称',
        inputMode: 'text',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByText('取消')).toBeInTheDocument()
      })
      await user.click(screen.getByText('取消'))

      expect(await promise).toBeNull()
    })

    it('password 模式渲染密码输入框', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        message: '请输入密码',
        inputMode: 'password',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        // 在 password 模式下，输入框 type 应为 'password'
        const inputs = document.querySelectorAll('input')
        const passwordInput = Array.from(inputs).find(i => i.type === 'password')
        expect(passwordInput).toBeTruthy()
      })
    })
  })

  describe('variant 样式', () => {
    it('danger 变体应用红色按钮', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        message: '危险操作',
        variant: 'danger',
        confirmText: '删除',
        cancelText: '取消',
      })

      await waitFor(() => {
        const btn = screen.getByText('删除')
        expect(btn.className).toContain('bg-red-600')
      })
    })

    it('warning 变体应用琥珀色按钮', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        message: '警告操作',
        variant: 'warning',
        confirmText: '继续',
        cancelText: '取消',
      })

      await waitFor(() => {
        const btn = screen.getByText('继续')
        expect(btn.className).toContain('bg-amber-600')
      })
    })

    it('默认变体应用 accent 按钮', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        message: '普通操作',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        const btn = screen.getByText('确定')
        expect(btn.className).toContain('bg-accent')
      })
    })
  })

  describe('键盘交互', () => {
    it('Escape 键触发取消', async () => {
      render(<Dialog />)
      const promise = useDialogStore.getState().show({
        message: '测试',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByText('测试')).toBeInTheDocument()
      })

      // onKeyDown 在内部 div 上，需通过文本节点找到该容器
      const innerDiv = screen.getByText('测试').closest('[tabindex="-1"]')!
      fireEvent.keyDown(innerDiv, { key: 'Escape' })

      expect(await promise).toBe(false)
    })

    it('Enter 键触发确认（非 prompt 模式）', async () => {
      render(<Dialog />)
      const promise = useDialogStore.getState().show({
        message: '测试',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        expect(screen.getByText('测试')).toBeInTheDocument()
      })

      const innerDiv = screen.getByText('测试').closest('[tabindex="-1"]')!
      fireEvent.keyDown(innerDiv, { key: 'Enter' })

      expect(await promise).toBe(true)
    })
  })

  describe('便捷工具函数', () => {
    it('dialog.confirm 返回 boolean', async () => {
      const user = userEvent.setup()
      render(<Dialog />)

      const promise = useDialogStore.getState().confirm('确认操作')

      await waitFor(() => {
        expect(screen.getByText('确认操作')).toBeInTheDocument()
      })
      await user.click(screen.getByText('确定'))

      expect(await promise).toBe(true)
    })

    it('dialog.alert 返回 void', async () => {
      const user = userEvent.setup()
      render(<Dialog />)

      const promise = useDialogStore.getState().alert('提示')

      await waitFor(() => {
        expect(screen.getByText('提示')).toBeInTheDocument()
      })
      await user.click(screen.getByText('确定'))

      await expect(promise).resolves.toBeUndefined()
    })

    it('dialog.prompt 返回 string 或 null', async () => {
      const user = userEvent.setup()
      render(<Dialog />)

      const promise = useDialogStore.getState().prompt('请输入', '默认值')

      await waitFor(() => {
        expect(screen.getByDisplayValue('默认值')).toBeInTheDocument()
      })

      await user.click(screen.getByText('确定'))

      expect(await promise).toBe('默认值')
    })
  })

  describe('无障碍', () => {
    it('对话框有 role=dialog 和 aria-modal', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        title: '测试标题',
        message: '测试消息',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toHaveAttribute('aria-label', '测试标题')
      })
    })

    it('消息有 aria-describedby 关联', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        title: '标题',
        message: '描述文本',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        const descId = dialog.getAttribute('aria-describedby')
        expect(descId).toBe('aela-dialog-desc')
        expect(document.getElementById(descId!)).toHaveTextContent('描述文本')
      })
    })

    it('标题有 aria-labelledby 关联', async () => {
      render(<Dialog />)
      useDialogStore.getState().show({
        title: '标题文本',
        message: '消息',
        confirmText: '确定',
        cancelText: '取消',
      })

      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        const labelId = dialog.getAttribute('aria-labelledby')
        expect(labelId).toBe('aela-dialog-title')
        expect(document.getElementById(labelId!)).toHaveTextContent('标题文本')
      })
    })
  })
})
