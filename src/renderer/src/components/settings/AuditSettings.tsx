// 4. 审计日志

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import { dialog } from '../../stores/dialog'
import type { AuditEvent, AuditQueryFilter, AuditConfig } from '@shared/types'
import { Card, Toggle, inputCls, btnCls } from './shared'

export function AuditSettings() {
  const t = useT()
  const [config, setConfig] = useState<AuditConfig | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [count, setCount] = useState(0)
  const [filter, setFilter] = useState<AuditQueryFilter>({})

  const loadData = useCallback(async () => {
    try {
      const [c, n] = await Promise.all([window.aela.audit.getConfig(), window.aela.audit.count()])
      setConfig(c); setCount(n)
    } catch (err) { console.error('Failed to load audit config:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => { if (config) { await window.aela.audit.setConfig(config); loadData() } }
  const handleQuery = async () => { const r = await window.aela.audit.query(filter); setEvents(r.slice(-100)) }
  const handleClear = async () => { if (!(await dialog.confirm(t('ap.audit.confirmClear'), { variant: 'danger' }))) return; await window.aela.audit.clear(); setEvents([]); loadData() }

  if (!config) return <div className="p-6 text-text-muted">{t('common.loading')}</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.audit.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.audit.desc')}</p>
      </div>

      <Card title={t('ap.audit.config')} desc={t('ap.audit.currentEvents', { n: count })}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{t('ap.audit.enable')}</span>
          <Toggle checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })} />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">{t('ap.audit.maxEvents')}</label>
          <input type="number" min="1000" value={config.maxEvents} onChange={(e) => setConfig({ ...config, maxEvents: parseInt(e.target.value) || 100000 })} className={inputCls} />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className={btnCls}>{t('ap.audit.saveConfig')}</button>
          <button onClick={handleClear} className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">{t('ap.audit.clearLog')}</button>
        </div>
      </Card>

      <Card title={t('ap.audit.query')} desc={t('ap.audit.queryDesc')}>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder={t('ap.audit.actorPlaceholder')} value={filter.actor ?? ''} onChange={(e) => setFilter({ ...filter, actor: e.target.value || undefined })} className={inputCls} />
          <input placeholder={t('ap.audit.actionPlaceholder')} value={filter.action ?? ''} onChange={(e) => setFilter({ ...filter, action: e.target.value || undefined })} className={inputCls} />
        </div>
        <button onClick={handleQuery} className={btnCls + ' text-xs'}>{t('ap.audit.queryBtn')}</button>
      </Card>

      {events.length > 0 && (
        <Card title={t('ap.audit.queryResult')} desc={t('ap.audit.showRecent', { n: events.length })}>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/50 last:border-0">
                <span className={`px-1.5 py-0.5 rounded font-mono shrink-0 ${e.result === 'success' ? 'bg-green-500/10 text-green-400' : e.result === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>{e.result}</span>
                <span className="text-text-secondary shrink-0">{e.actor}</span>
                <span className="text-text-muted truncate">{e.action} → {e.resource}</span>
                <span className="text-text-muted/50 shrink-0 ml-auto">{new Date(e.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
