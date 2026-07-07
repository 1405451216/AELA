import { describe, it, expect, beforeEach } from 'vitest'
import { useDialogStore, dialog } from '../../src/renderer/src/stores/dialog'

describe('dialogStore', () => {
  beforeEach(() => {
    useDialogStore.setState({
      visible: false,
      options: { message: '' },
      resolveFn: null,
      inputValue: '',
    })
  })

  describe('初始状态', () => {
    it('visible 初始为 false', () => {
      expect(useDialogStore.getState().visible).toBe(false)
    })

    it('resolveFn 初始为 null', () => {
      expect(useDialogStore.getState().resolveFn).toBeNull()
    })

    it('inputValue 初始为空字符串', () => {
      expect(useDialogStore.getState().inputValue).toBe('')
    })
  })

  describe('show', () => {
    it('调用 show 后 visible 变为 true', () => {
      useDialogStore.getState().show({ message: '测试' })
      expect(useDialogStore.getState().visible).toBe(true)
    })

    it('调用 show 设置 options', () => {
      useDialogStore.getState().show({
        message: '消息',
        title: '标题',
        confirmText: '确认',
      })
      expect(useDialogStore.getState().options.message).toBe('消息')
      expect(useDialogStore.getState().options.title).toBe('标题')
    })

    it('show 返回 Promise', () => {
      const result = useDialogStore.getState().show({ message: '测试' })
      expect(result).toBeInstanceOf(Promise)
    })

    it('show 带 inputMode 时初始化 inputValue', () => {
      useDialogStore.getState().show({
        message: '输入',
        inputMode: 'text',
        inputValue: '初始值',
      })
      expect(useDialogStore.getState().inputValue).toBe('初始值')
    })
  })

  describe('resolve', () => {
    it('resolve(true) 解析 Promise 为 true', async () => {
      const promise = useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().resolve(true)
      expect(await promise).toBe(true)
    })

    it('resolve(false) 解析 Promise 为 false', async () => {
      const promise = useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().resolve(false)
      expect(await promise).toBe(false)
    })

    it('resolve(string) 解析 Promise 为字符串', async () => {
      const promise = useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().resolve('输入内容')
      expect(await promise).toBe('输入内容')
    })

    it('resolve(null) 解析 Promise 为 null', async () => {
      const promise = useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().resolve(null)
      expect(await promise).toBeNull()
    })

    it('resolve 后 visible 变为 false', () => {
      useDialogStore.getState().show({ message: '测试' })
      expect(useDialogStore.getState().visible).toBe(true)
      useDialogStore.getState().resolve(true)
      expect(useDialogStore.getState().visible).toBe(false)
    })

    it('resolve 后 resolveFn 被清空', () => {
      useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().resolve(true)
      expect(useDialogStore.getState().resolveFn).toBeNull()
    })

    it('resolve 后 inputValue 被清空', () => {
      useDialogStore.getState().show({ message: '测试', inputMode: 'text', inputValue: '值' })
      useDialogStore.getState().resolve('值')
      expect(useDialogStore.getState().inputValue).toBe('')
    })
  })

  describe('confirm', () => {
    it('confirm 返回 true（当 resolve(true)）', async () => {
      const promise = useDialogStore.getState().confirm('确认操作')
      useDialogStore.getState().resolve(true)
      expect(await promise).toBe(true)
    })

    it('confirm 返回 false（当 resolve(false)）', async () => {
      const promise = useDialogStore.getState().confirm('确认操作')
      useDialogStore.getState().resolve(false)
      expect(await promise).toBe(false)
    })

    it('confirm 设置默认按钮文本', () => {
      useDialogStore.getState().confirm('测试')
      const options = useDialogStore.getState().options
      expect(options.confirmText).toBe('确定')
      expect(options.cancelText).toBe('取消')
    })

    it('confirm 支持自定义 variant', () => {
      useDialogStore.getState().confirm('危险操作', { variant: 'danger' })
      expect(useDialogStore.getState().options.variant).toBe('danger')
    })
  })

  describe('alert', () => {
    it('alert 返回 undefined', async () => {
      const promise = useDialogStore.getState().alert('提示')
      useDialogStore.getState().resolve(true)
      expect(await promise).toBeUndefined()
    })

    it('alert 不设置 cancelText（取消按钮隐藏）', () => {
      useDialogStore.getState().alert('提示')
      expect(useDialogStore.getState().options.cancelText).toBe('')
    })

    it('alert 设置 confirmText 为"确定"', () => {
      useDialogStore.getState().alert('提示')
      expect(useDialogStore.getState().options.confirmText).toBe('确定')
    })
  })

  describe('prompt', () => {
    it('prompt 设置 inputMode 为 text', () => {
      useDialogStore.getState().prompt('请输入')
      expect(useDialogStore.getState().options.inputMode).toBe('text')
    })

    it('prompt 设置默认值', () => {
      useDialogStore.getState().prompt('请输入', '默认')
      expect(useDialogStore.getState().inputValue).toBe('默认')
    })

    it('prompt 返回字符串（当 resolve(string)）', async () => {
      const promise = useDialogStore.getState().prompt('请输入')
      useDialogStore.getState().resolve('用户输入')
      expect(await promise).toBe('用户输入')
    })

    it('prompt 返回 null（当 resolve(false)）', async () => {
      const promise = useDialogStore.getState().prompt('请输入')
      useDialogStore.getState().resolve(false)
      expect(await promise).toBeNull()
    })

    it('prompt 支持 password 模式', () => {
      useDialogStore.getState().prompt('密码', '', { inputMode: 'password' })
      expect(useDialogStore.getState().options.inputMode).toBe('password')
    })
  })

  describe('setInputValue', () => {
    it('更新 inputValue', () => {
      useDialogStore.getState().setInputValue('新值')
      expect(useDialogStore.getState().inputValue).toBe('新值')
    })
  })

  describe('close', () => {
    it('close 解析 Promise 为 null', async () => {
      const promise = useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().close()
      expect(await promise).toBeNull()
    })

    it('close 后 visible 变为 false', () => {
      useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().close()
      expect(useDialogStore.getState().visible).toBe(false)
    })

    it('close 后 resolveFn 被清空', () => {
      useDialogStore.getState().show({ message: '测试' })
      useDialogStore.getState().close()
      expect(useDialogStore.getState().resolveFn).toBeNull()
    })
  })

  describe('dialog 便捷工具函数', () => {
    it('dialog.confirm 设置 visible 并返回 Promise<boolean>', async () => {
      const promise = dialog.confirm('确认操作')
      expect(useDialogStore.getState().visible).toBe(true)
      expect(useDialogStore.getState().options.message).toBe('确认操作')
      useDialogStore.getState().resolve(true)
      expect(await promise).toBe(true)
    })

    it('dialog.alert 设置 visible 并返回 Promise<void>', async () => {
      const promise = dialog.alert('提示信息')
      expect(useDialogStore.getState().visible).toBe(true)
      expect(useDialogStore.getState().options.message).toBe('提示信息')
      expect(useDialogStore.getState().options.cancelText).toBe('')
      useDialogStore.getState().resolve(true)
      await expect(promise).resolves.toBeUndefined()
    })

    it('dialog.prompt 设置 inputMode 并返回 Promise<string|null>', async () => {
      const promise = dialog.prompt('请输入', '默认值')
      expect(useDialogStore.getState().visible).toBe(true)
      expect(useDialogStore.getState().options.inputMode).toBe('text')
      expect(useDialogStore.getState().inputValue).toBe('默认值')
      useDialogStore.getState().resolve('用户输入')
      expect(await promise).toBe('用户输入')
    })
  })
})
