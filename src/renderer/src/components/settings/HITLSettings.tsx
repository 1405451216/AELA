// 3. 人机协作

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import { dialog } from '../../stores/dialog'
import type { HITLConfig, HITLInterruptPoint } from '@shared/types'
import { Card, Toggle, inputCls, btnCls } from './shared'

export function HITLSettings() {
  const t = useT()
  const [config, setConfig] = useState<HITLConfig | null>(null)

  const loadData = useCallback(async () => {
    try { setConfig(await window.aela.hitl.getConfig()) }
    catch (err) { console.error('Failed to load HITL config:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => { if (config) { await window.aela.hitl.setConfig(config); loadData() } }

  const addInterruptPoint = () => {
    if (!config) return
    setConfig({ ...config, interruptPoints: [...config.interruptPoints, { type: 'tool_confirm', toolName: '', message: '确认工具调用' }] })
  }
  const removeInterruptPoint = (idx: number) => {
    if (!config) return
    setConfig({ ...config, interruptPoints: config.interruptPoints.filter((_, i) => i !== idx) })
  }
  const addAutoApprove = async () => {
    const tool = await dialog.prompt('输入要自动批准的工具名称:')
    if (tool && config && !config.autoApproveTools.includes(tool)) {
      setConfig({ ...config, autoApproveTools: [...config.autoApproveTools, tool] })
    }
  }
  const removeAutoApprove = (tool: string) => {
    if (!config) return
    setConfig({ ...config, autoApproveTools: config.autoApproveTools.filter(t => t !== tool) })
  }

  if (!config) return <div className="p-6 text-text-muted">{t('common.loading')}</div>

  const typeLabels: Record<HITLInterruptPoint['type'], string> = { tool_confirm: t('ap.hitl.toolConfirm'), decision_point: t('ap.hitl.decisionPoint'), budget_exceed: t('ap.hitl.budgetExceed'), custom: t('ap.hitl.custom') }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.hitl.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.hitl.desc')}</p>
      </div>

      <Card title={t('ap.hitl.enable')} desc={t('ap.hitl.enableDesc')}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">{config.enabled ? t('ap.hitl.enabled') : t('ap.hitl.disabled')}</span>
          <Toggle checked={config.enabled} onChange={(v) => setConfig({ ...config, enabled: v })} />
        </div>
      </Card>

      <Card title={t('ap.hitl.interruptPoints')} desc={t('ap.hitl.interruptPointsDesc')}>
        <div className="space-y-2">
          {config.interruptPoints.map((ip, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-bg-primary/50 rounded-lg border border-border">
              <select value={ip.type} onChange={(e) => { const u = [...config.interruptPoints]; u[idx] = { ...ip, type: e.target.value as HITLInterruptPoint['type'] }; setConfig({ ...config, interruptPoints: u }) }} className="bg-bg-primary text-text-primary rounded px-2 py-1 text-xs border border-border focus:outline-none">
                {Object.entries(typeLabels).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
              <input value={ip.toolName} onChange={(e) => { const u = [...config.interruptPoints]; u[idx] = { ...ip, toolName: e.target.value }; setConfig({ ...config, interruptPoints: u }) }} placeholder={t('ap.hitl.toolNamePlaceholder')} className={inputCls + ' text-xs'} />
              <button onClick={() => removeInterruptPoint(idx)} className="text-text-muted hover:text-red-400 text-sm shrink-0 px-1">✕</button>
            </div>
          ))}
          <button onClick={addInterruptPoint} className="text-xs text-accent-light hover:text-accent transition-colors">{t('ap.hitl.addInterruptPoint')}</button>
        </div>
      </Card>

      <Card title={t('ap.hitl.autoApproveTools')} desc={t('ap.hitl.autoApproveDesc')}>
        <div className="flex flex-wrap gap-1.5">
          {config.autoApproveTools.map(tool => (
            <span key={tool} className="inline-flex items-center gap-1 px-2 py-1 bg-bg-primary rounded-md text-xs border border-border">
              <span className="text-text-secondary font-mono">{tool}</span>
              <button onClick={() => removeAutoApprove(tool)} className="text-text-muted hover:text-red-400 ml-0.5">✕</button>
            </span>
          ))}
          {config.autoApproveTools.length === 0 && <span className="text-xs text-text-muted">{t('ap.hitl.noAutoApprove')}</span>}
        </div>
        <button onClick={addAutoApprove} className="text-xs text-accent-light hover:text-accent transition-colors mt-2">{t('ap.hitl.addTool')}</button>
      </Card>

      <button onClick={handleSave} className={btnCls}>{t('ap.hitl.save')}</button>
    </div>
  )
}
