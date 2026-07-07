// 10. 规则与记忆设置 (Rules & Memory Settings)
//
// TODO: 此组件为占位符。原 APSettingsViews.tsx 中不存在 RulesMemorySettings 的具体实现，
// 需要后续由对应功能模块补充完整实现。当前仅提供最小可渲染的命名导出。

import { useT } from '../../i18n'

export function RulesMemorySettings() {
  const t = useT()
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.rules.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.rules.desc')}</p>
      </div>
      <div className="text-center text-text-muted text-sm py-8 bg-surface/50 border border-dashed border-border rounded-xl">
        {t('common.comingSoon')}
      </div>
    </div>
  )
}
