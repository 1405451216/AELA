// 1. 成本与预算

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import type { CostSummary, CostRecord, BudgetConfig, ModelPricing } from '@shared/types'
import { Card, inputCls, btnCls } from './shared'

export function CostSettings() {
  const t = useT()
  const [summary, setSummary] = useState<CostSummary | null>(null)
  const [_budget, setBudget] = useState<BudgetConfig | null>(null)
  const [records, setRecords] = useState<CostRecord[]>([])
  const [pricing, setPricing] = useState<ModelPricing[]>([])
  const [form, setForm] = useState<BudgetConfig>({})
  const [todayAlert, setTodayAlert] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [s, b, r, p, alert] = await Promise.all([
        window.aela.cost.summary(),
        window.aela.cost.getBudget(),
        window.aela.cost.records(20),
        window.aela.cost.listPricing(),
        window.aela.cost.isTodayOverBudget ? window.aela.cost.isTodayOverBudget(5) : false,
      ])
      setSummary(s); setBudget(b); setRecords(r); setPricing(p); setForm(b ?? {}); setTodayAlert(!!alert)
    } catch (err) { console.error('Failed to load cost data:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveBudget = async () => { await window.aela.cost.setBudget(form); setBudget(form); loadData() }
  const handleReset = async () => { await window.aela.cost.reset(); loadData() }
  const handleExport = async () => {
    if (!window.aela.cost.exportCSV) return
    const csv = await window.aela.cost.exportCSV()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aela-cost-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {todayAlert && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <div className="text-sm font-medium text-amber-400">今日花费已超过 $5</div>
            <div className="text-xs text-amber-400/80">建议检查高频会话或切换到本地模型</div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.cost.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.cost.desc')}</p>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-xs text-text-muted">今日</div>
              <div className="text-2xl font-bold text-text-primary mt-1">${(summary.todayCostUSD ?? 0).toFixed(4)}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-xs text-text-muted">本月</div>
              <div className="text-2xl font-bold text-text-primary mt-1">${(summary.monthCostUSD ?? 0).toFixed(4)}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-xs text-text-muted">{t('ap.cost.totalCost')}</div>
              <div className="text-2xl font-bold text-text-primary mt-1">${summary.totalCostUSD.toFixed(4)}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-xs text-text-muted">{t('ap.cost.callCount')}</div>
              <div className="text-2xl font-bold text-text-primary mt-1">{summary.callCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-xs text-text-muted">今日 Token</div>
              <div className="text-lg font-medium text-text-primary mt-1">{(summary.todayTokens ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-xs text-text-muted">本月 Token</div>
              <div className="text-lg font-medium text-text-primary mt-1">{(summary.monthTokens ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-xs text-text-muted">{t('ap.cost.inOutTokens')}</div>
              <div className="text-sm font-medium text-text-primary mt-1">
                {summary.totalPromptTokens.toLocaleString()} / {summary.totalCompTokens.toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}

      {summary && Object.keys(summary.byModel).length > 0 && (
        <Card title={t('ap.cost.byModel')}>
          <div className="space-y-1.5">
            {Object.entries(summary.byModel).map(([model, mc]) => (
              <div key={model} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{model}</span>
                <span className="text-text-muted">${mc.costUSD.toFixed(4)} · {mc.calls} 次 · {mc.tokens.toLocaleString()} tokens</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={t('ap.cost.budgetConfig')} desc={t('ap.cost.budgetDesc')}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ap.cost.maxTotalCost')}</label>
            <input type="number" min="0" step="0.1" value={form.maxTotalCostUSD ?? ''} onChange={(e) => setForm({ ...form, maxTotalCostUSD: parseFloat(e.target.value) || undefined })} placeholder={t('ap.cost.unlimited')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ap.cost.maxTokensPerCall')}</label>
            <input type="number" min="0" value={form.maxTokensPerCall ?? ''} onChange={(e) => setForm({ ...form, maxTokensPerCall: parseInt(e.target.value) || undefined })} placeholder={t('ap.cost.unlimited')} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('ap.cost.maxTokensPerSession')}</label>
            <input type="number" min="0" value={form.maxTokensPerSession ?? ''} onChange={(e) => setForm({ ...form, maxTokensPerSession: parseInt(e.target.value) || undefined })} placeholder={t('ap.cost.unlimited')} className={inputCls} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSaveBudget} className={btnCls}>{t('ap.cost.saveBudget')}</button>
          <button onClick={handleReset} className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">{t('ap.cost.resetStats')}</button>
          <button onClick={handleExport} className="px-4 py-2 bg-surface border border-border hover:border-accent rounded-lg text-sm text-text-secondary transition-colors">📥 导出 CSV</button>
        </div>
      </Card>

      {records.length > 0 && (
        <Card title={t('ap.cost.recentRecords')} desc={t('ap.cost.recentN', { n: records.length })}>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {records.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary font-mono">{r.model}</span>
                  <span className="text-text-muted">{r.totalTokens} tokens</span>
                </div>
                <span className="text-text-muted">${r.costUSD.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={t('ap.cost.pricingTable')} desc={t('ap.cost.pricingCount', { n: pricing.length })}>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {pricing.map(p => (
            <div key={p.model} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
              <span className="text-text-secondary font-mono">{p.model}</span>
              <span className="text-text-muted">${p.promptPricePer1M}/${p.completionPricePer1M} /1M</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
