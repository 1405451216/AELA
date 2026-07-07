// 翻译函数（translate / translateF）
// 依赖 dict 与 getLang，不依赖 React

import { dict } from './dict'
import { getLang } from './lang'

export function translate(key: string): string {
  const lang = getLang()
  return dict[lang]?.[key] ?? dict.zh[key] ?? key
}

// ===== 带参数的翻译函数 =====
export function translateF(key: string, params?: Record<string, string | number>): string {
  const lang = getLang()
  let str = dict[lang]?.[key] ?? dict.zh[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      // 转义 key 中的正则特殊字符，并使用回调替换避免 $& 等特殊模式
      const escapedKey = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      str = str.replace(new RegExp(`\\{${escapedKey}\\}`, 'g'), () => String(v))
    }
  }
  return str
}
