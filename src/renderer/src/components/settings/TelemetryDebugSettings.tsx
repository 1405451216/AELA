// 7. 遥测与调试 (Telemetry + Debugger Inspector)

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import { dialog } from '../../stores/dialog'
import type { TelemetryConfig } from '@shared/types'
import { Card, Toggle, inputCls, btnCls } from './shared'

export function TelemetryDebugSettings() {
  const t = useT()
  const [telemetry, setTelemetry] = useState<TelemetryConfig | null>(null)
  const [teleStatus, setTeleStatus] = useState<{
    configured: boolean; enableTraces: boolean; enableMetrics: boolean
    otlpEndpoint: string; activeSpans: number; totalSpans: number; totalExported: number
  } | null>(null)
  const [dbgStatus, setDbgStatus] = useState<{
    enabled: boolean; logEntries: number; subscriberCount: number
    inspectorRunning: boolean; inspectorPort: number; totalSpans: number; totalSessions: number
  } | null>(null)
  const [inspectorPort, setInspectorPort] = useState(9229)

  const loadData = useCallback(async () => {
    try {
      const [ts, tc, ds] = await Promise.all([
        window.aela.telemetry.status(),
        window.aela.telemetry.getConfig(),
        window.aela.debugger.status(),
      ])
      setTeleStatus(ts)
      setDbgStatus(ds)
      setInspectorPort(ds.inspectorPort || 9229)
      // 使用后端返回的真实配置
      setTelemetry(tc)
    } catch (err) { console.error('Failed to load telemetry/debugger status:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveTelemetry = async () => {
    if (!telemetry) return
    await window.aela.telemetry.configure(telemetry)
    loadData()
  }
  const handleExport = async () => {
    const result = await window.aela.telemetry.export()
    if (result.error) {
      await dialog.alert(t('ap.telemetry.exportFailed', { err: result.error }), { variant: 'warning' })
    } else {
      await dialog.alert(t('ap.telemetry.exportedResult', { traces: result.tracesExported, metrics: result.metricsExported }))
    }
  }
  const handleStartInspector = async () => {
    try {
      await window.aela.debugger.startInspector(inspectorPort)
      loadData()
    } catch (err) { await dialog.alert(t('ap.telemetry.inspectorFailed', { err: err instanceof Error ? err.message : String(err) }), { variant: 'warning' }) }
  }
  const handleStopInspector = async () => {
    await window.aela.debugger.stopInspector()
    loadData()
  }
  const handleClearTraces = async () => {
    if (!(await dialog.confirm(t('ap.telemetry.confirmClearTraces'), { variant: 'danger' }))) return
    await window.aela.debugger.clear()
    loadData()
  }

  if (!telemetry || !teleStatus || !dbgStatus) return <div className="p-6 text-text-muted">{t('common.loading')}</div>

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.telemetry.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.telemetry.desc')}</p>
      </div>

      {/* 遥测配置 */}
      <Card title="OpenTelemetry" desc={`${t('ap.telemetry.configured')}: ${teleStatus.configured ? t('ap.telemetry.configured') : t('ap.telemetry.notConfigured')} · ${t('ap.telemetry.activeSpans')}: ${teleStatus.activeSpans} · ${t('ap.telemetry.total')}: ${teleStatus.totalSpans} · ${t('ap.telemetry.exported')}: ${teleStatus.totalExported}`}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ap.telemetry.otlpEndpoint')}</label>
            <input
              value={telemetry.otlpEndpoint}
              onChange={(e) => setTelemetry({ ...telemetry, otlpEndpoint: e.target.value })}
              placeholder="http://localhost:4318"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ap.telemetry.exportInterval')}</label>
            <input
              type="number"
              min="1000"
              step="1000"
              value={telemetry.exportIntervalMs}
              onChange={(e) => setTelemetry({ ...telemetry, exportIntervalMs: parseInt(e.target.value) || 5000 })}
              className={inputCls}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">{t('ap.telemetry.enableTraces')}</span>
            <Toggle checked={telemetry.enableTraces} onChange={(v) => setTelemetry({ ...telemetry, enableTraces: v })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">{t('ap.telemetry.enableMetrics')}</span>
            <Toggle checked={telemetry.enableMetrics} onChange={(v) => setTelemetry({ ...telemetry, enableMetrics: v })} />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={handleSaveTelemetry} className={btnCls}>{t('ap.telemetry.saveConfig')}</button>
          <button onClick={handleExport} className="px-4 py-2 bg-bg-primary border border-border hover:bg-surface-hover text-text-primary rounded-lg text-sm font-medium transition-colors">{t('ap.telemetry.manualExport')}</button>
        </div>
      </Card>

      {/* 调试器 Inspector */}
      <Card title={t('ap.telemetry.debuggerInspector')} desc={`${t('ap.telemetry.stopped')}/${t('ap.telemetry.running')}: ${dbgStatus.inspectorRunning ? `${t('ap.telemetry.running')} (${dbgStatus.inspectorPort})` : t('ap.telemetry.stopped')} · ${t('ap.telemetry.logEntries')}: ${dbgStatus.logEntries} · ${t('ap.telemetry.tracesSpans')}: ${dbgStatus.totalSpans} · ${t('ap.telemetry.sessions')}: ${dbgStatus.totalSessions}`}>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary shrink-0">{t('ap.telemetry.inspectorPort')}</label>
            <input
              type="number"
              min="1024"
              max="65535"
              value={inspectorPort}
              onChange={(e) => setInspectorPort(parseInt(e.target.value) || 9229)}
              disabled={dbgStatus.inspectorRunning}
              className={inputCls + ' w-32'}
            />
          </div>
          <div className="flex gap-2">
            {dbgStatus.inspectorRunning ? (
              <button onClick={handleStopInspector} className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">
                {t('ap.telemetry.stopInspector')}
              </button>
            ) : (
              <button onClick={handleStartInspector} className={btnCls}>
                {t('ap.telemetry.startInspector')}
              </button>
            )}
            <button onClick={handleClearTraces} className="px-4 py-2 bg-bg-primary border border-border hover:bg-surface-hover text-text-primary rounded-lg text-sm font-medium transition-colors">
              {t('ap.telemetry.clearTraces')}
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
