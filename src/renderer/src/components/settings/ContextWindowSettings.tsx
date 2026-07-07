// 2. 上下文管理

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import type { ContextWindowConfig } from '@shared/types'
import { Card, inputCls, btnCls } from './shared'

export function ContextWindowSettings() {
  const t = useT()
  const [config, setConfig] = useState<ContextWindowConfig | null>(null)

  const loadData = useCallback(async () => {
    try { setConfig(await window.aela.contextWindow.getConfig()) }
    catch (err) { console.error('Failed to load context window config:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => { if (config) { await window.aela.contextWindow.setConfig(config); loadData() } }

  if (!config) return <div className="p-6 text-text-muted">{t('common.loading')}</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.context.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.context.desc')}</p>
      </div>

      <Card title={t('ap.context.strategy')} desc={t('ap.context.strategyDesc')}>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 bg-bg-primary/50 rounded-lg border border-border cursor-pointer">
            <input type="radio" checked={config.strategy === 'default'} onChange={() => setConfig({ ...config, strategy: 'default' })} className="accent-accent" />
            <div><div className="text-sm text-text-primary">{t('ap.context.defaultStrategy')}</div><div className="text-xs text-text-muted">{t('ap.context.defaultStrategyDesc')}</div></div>
          </label>
          <label className="flex items-center gap-3 p-3 bg-bg-primary/50 rounded-lg border border-border cursor-pointer">
            <input type="radio" checked={config.strategy === 'compress'} onChange={() => setConfig({ ...config, strategy: 'compress' })} className="accent-accent" />
            <div><div className="text-sm text-text-primary">{t('ap.context.compressStrategy')}</div><div className="text-xs text-text-muted">{t('ap.context.compressStrategyDesc')}</div></div>
          </label>
        </div>
      </Card>

      <Card title={t('ap.context.generalParams')}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ap.context.maxMessages')}</label>
            <input type="number" min="10" max="500" value={config.maxMessages} onChange={(e) => setConfig({ ...config, maxMessages: parseInt(e.target.value) || 80 })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ap.context.keepLast')}</label>
            <input type="number" min="1" max="100" value={config.keepLast} onChange={(e) => setConfig({ ...config, keepLast: parseInt(e.target.value) || 60 })} className={inputCls} />
          </div>
        </div>
      </Card>

      {config.strategy === 'compress' && config.compress && (
        <Card title={t('ap.context.compressParams')}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">{t('ap.context.keepRecentN')}</label>
              <input type="number" min="1" max="20" value={config.compress.keepRecentN} onChange={(e) => setConfig({ ...config, compress: { ...config.compress!, keepRecentN: parseInt(e.target.value) || 4 } })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">{t('ap.context.compressRatio')}</label>
              <input type="number" min="0.1" max="1.0" step="0.1" value={config.compress.compressRatio} onChange={(e) => setConfig({ ...config, compress: { ...config.compress!, compressRatio: parseFloat(e.target.value) || 0.3 } })} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input type="checkbox" checked={config.compress.keepSystemMessages} onChange={(e) => setConfig({ ...config, compress: { ...config.compress!, keepSystemMessages: e.target.checked } })} className="accent-accent" />
              {t('ap.context.keepSystem')}
            </label>
          </div>
        </Card>
      )}

      <button onClick={handleSave} className={btnCls}>{t('ap.context.save')}</button>
    </div>
  )
}
