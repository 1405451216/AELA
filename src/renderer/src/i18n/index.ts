// 轻量级 i18n 系统
// 支持中英文切换，通过 useT() hook 在组件中使用
// 字典和核心翻译函数来自 @shared/i18n，此处仅添加 React hook

import { useSyncExternalStore } from 'react'
import { subscribeLang, getLangSnapshot, translateF } from '@shared/i18n'

export type Lang = 'zh' | 'en'
export { dict, translate, setLang, getLang, subscribeLang, getLangSnapshot } from '@shared/i18n'

// ===== React Hook =====
export function useT() {
  useSyncExternalStore(subscribeLang, getLangSnapshot, getLangSnapshot)
  return translateF
}

// 非 hook 版本（用于组件外部）
export const t = translateF
