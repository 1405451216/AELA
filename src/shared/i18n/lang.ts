// 语言状态管理（订阅 / 读写）
// 不依赖 React

import type { Lang } from './dict'

// ===== 语言状态管理 =====
let currentLang: Lang = 'zh'
const listeners = new Set<() => void>()

export function setLang(lang: Lang) {
  currentLang = lang
  // 隔离监听器异常，防止单个监听器抛出导致其他监听器不执行
  for (const l of listeners) {
    try { l() } catch (e) { console.error('[i18n] 语言监听器异常:', e) }
  }
}

export function getLang(): Lang {
  return currentLang
}

export function subscribeLang(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getLangSnapshot() {
  return currentLang
}
