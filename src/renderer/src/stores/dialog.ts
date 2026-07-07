import { create } from 'zustand'

// ===== 对话框状态管理 =====
// 替代原生 window.confirm / window.alert / window.prompt
// 提供统一的 UI 风格和异步 Promise 接口

interface DialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger' | 'warning'
  /** 输入框模式 (替代 prompt) */
  inputMode?: 'text' | 'password'
  inputValue?: string
  inputPlaceholder?: string
}

interface DialogState {
  visible: boolean
  options: DialogOptions
  resolveFn: ((value: string | boolean | null) => void) | null
  inputValue: string

  show: (options: DialogOptions) => Promise<string | boolean | null>
  confirm: (message: string, options?: Partial<DialogOptions>) => Promise<boolean>
  alert: (message: string, options?: Partial<DialogOptions>) => Promise<void>
  prompt: (message: string, defaultValue?: string, options?: Partial<DialogOptions>) => Promise<string | null>
  resolve: (value: string | boolean | null) => void
  setInputValue: (value: string) => void
  close: () => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  visible: false,
  options: { message: '' },
  resolveFn: null,
  inputValue: '',

  show: (options: DialogOptions) => {
    return new Promise<string | boolean | null>((resolveFn) => {
      set({
        visible: true,
        options,
        resolveFn: resolveFn,
        inputValue: options.inputValue ?? '',
      })
    })
  },

  confirm: (message: string, options?: Partial<DialogOptions>) => {
    return get().show({
      message,
      confirmText: '确定',
      cancelText: '取消',
      ...options,
    }).then((result) => result === true)
  },

  alert: (message: string, options?: Partial<DialogOptions>) => {
    return get().show({
      message,
      confirmText: '确定',
      cancelText: '',
      ...options,
    }).then(() => undefined)
  },

  prompt: (message: string, defaultValue?: string, options?: Partial<DialogOptions>) => {
    return get().show({
      message,
      inputMode: 'text',
      inputValue: defaultValue ?? '',
      confirmText: '确定',
      cancelText: '取消',
      ...options,
    }).then((result) => typeof result === 'string' ? result : null)
  },

  resolve: (value: string | boolean | null) => {
    const { resolveFn } = get()
    resolveFn?.(value)
    set({ visible: false, resolveFn: null, inputValue: '' })
  },

  setInputValue: (value: string) => set({ inputValue: value }),

  close: () => {
    const { resolveFn } = get()
    resolveFn?.(null)
    set({ visible: false, resolveFn: null, inputValue: '' })
  },
}))

// 便捷工具函数 — 可在组件外直接调用
export const dialog = {
  confirm: (message: string, options?: Partial<DialogOptions>) => useDialogStore.getState().confirm(message, options),
  alert: (message: string, options?: Partial<DialogOptions>) => useDialogStore.getState().alert(message, options),
  prompt: (message: string, defaultValue?: string, options?: Partial<DialogOptions>) => useDialogStore.getState().prompt(message, defaultValue, options),
}
