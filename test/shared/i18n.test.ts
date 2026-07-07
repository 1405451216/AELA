// T6 单元测试：i18n 上帝文件拆分后的桶文件导出面一致性
// 验证 src/shared/i18n 拆为 dict/lang/translate 三个子模块后，
// 通过 index.ts 桶文件对外导出的符号集合与旧版 i18n.ts 完全一致（T6 红线：导出面不变）。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as i18n from '@shared/i18n'
import type { Lang } from '@shared/i18n'

describe('i18n 模块（T6 桶文件导出面一致性）', () => {
  beforeEach(() => {
    i18n.setLang('zh')
  })

  it('桶文件对外导出 8 个符号（与旧 i18n.ts 完全一致）', () => {
    // Lang 为类型导出，在当前 bundler 下仍作为实时绑定存在于命名空间，共 8 个符号需完整保留
    expect(Object.keys(i18n).sort()).toEqual(
      ['Lang', 'dict', 'getLang', 'getLangSnapshot', 'setLang', 'subscribeLang', 'translate', 'translateF'].sort()
    )
  })

  it('dict 同时定义了 zh/en 两种语言', () => {
    const langs: Lang[] = ['zh', 'en']
    for (const l of langs) {
      expect(i18n.dict[l]).toBeDefined()
      expect(typeof i18n.dict[l]).toBe('object')
    }
  })

  it('en 是 zh 的子集：en 缺失的键在切语时回退到 zh（translate 设计行为）', () => {
    const zhKeys = Object.keys(i18n.dict.zh)
    const enKeys = Object.keys(i18n.dict.en)
    // en 不应包含 zh 没有的键（避免出现 zh 回退也缺失的幽灵键）
    for (const k of enKeys) {
      expect(zhKeys).toContain(k)
    }
    // 已知 zh 多于 en 的键（en 未翻译），在 en 下翻译应回退到 zh 文案
    const asymKey = zhKeys.find((k) => !enKeys.includes(k))
    expect(asymKey).toBeDefined()
    i18n.setLang('en')
    expect(i18n.translate(asymKey as string)).toBe(i18n.dict.zh[asymKey as string])
  })

  it('默认 zh 下 translate 返回中文', () => {
    expect(i18n.translate('sidebar.newTask')).toBe('新建任务')
  })

  it('setLang("en") 后 translate 返回英文', () => {
    i18n.setLang('en')
    expect(i18n.getLang()).toBe('en')
    expect(i18n.translate('sidebar.newTask')).toBe('New Task')
    expect(i18n.getLangSnapshot()).toBe('en')
  })

  it('未知 key 回退到 key 本身', () => {
    expect(i18n.translate('__not_a_real_key__')).toBe('__not_a_real_key__')
  })

  it('translateF 注入参数且回调替换避免 $& 注入', () => {
    i18n.setLang('zh')
    expect(i18n.translateF('automation.runCount', { n: 3 })).toBe('运行 3 次')
    // 回调替换方式可正确处理含正则特殊字符（如 $&）的替换值，避免注入
    expect(i18n.translateF('automation.runCount', { n: '$&BOOM' })).toBe('运行 $&BOOM 次')
  })

  it('subscribeLang 在切语时被通知，且可取消订阅', () => {
    const cb = vi.fn()
    const unsub = i18n.subscribeLang(cb)
    i18n.setLang('en')
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
    i18n.setLang('zh')
    // 取消订阅后不应再触发
    expect(cb).toHaveBeenCalledTimes(1)
  })
})
