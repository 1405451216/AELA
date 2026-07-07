// 5. 提示词模板

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import { dialog } from '../../stores/dialog'
import type { PromptRegistryEntry } from '@shared/types'
import { Card, inputCls, btnCls } from './shared'

export function PromptSettings() {
  const t = useT()
  const [templates, setTemplates] = useState<PromptRegistryEntry[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [renderResult, setRenderResult] = useState('')
  const [varsInput, setVarsInput] = useState('{}')
  const [newName, setNewName] = useState('')
  const [newContent, setNewContent] = useState('')

  const loadData = useCallback(async () => {
    try { setTemplates(await window.aela.prompt.list()) }
    catch (err) { console.error('Failed to load templates:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRender = async () => {
    if (!selectedTemplate) return
    try {
      const result = await window.aela.prompt.render(selectedTemplate, JSON.parse(varsInput))
      setRenderResult(result)
    } catch (err) { setRenderResult(t('ap.prompt.renderFailed', { err: err instanceof Error ? err.message : String(err) })) }
  }

  const handleRegister = async () => {
    if (!newName.trim() || !newContent.trim()) return
    await window.aela.prompt.register(newName.trim(), newContent)
    setNewName(''); setNewContent(''); loadData()
  }

  const handleDelete = async (name: string) => {
    if (!(await dialog.confirm(t('ap.prompt.confirmDelete', { name }), { variant: 'danger' }))) return
    await window.aela.prompt.delete(name)
    if (selectedTemplate === name) setSelectedTemplate(null)
    loadData()
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.prompt.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.prompt.desc')}</p>
      </div>

      <Card title={t('ap.prompt.registered')} desc={t('ap.prompt.templateCount', { n: templates.length })}>
        <div className="space-y-1.5">
          {templates.map(tp => (
            <div key={tp.name} className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedTemplate === tp.name ? 'border-accent bg-accent/5' : 'border-border bg-bg-primary/50 hover:bg-surface-hover'}`} onClick={() => setSelectedTemplate(tp.name)}>
              <div className="flex-1 min-w-0">
                <code className="text-sm font-mono text-text-primary">{tp.name}</code>
                <p className="text-xs text-text-muted mt-0.5">{tp.description}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(tp.name) }} className="text-text-muted hover:text-red-400 text-sm shrink-0 px-1">✕</button>
            </div>
          ))}
          {templates.length === 0 && <div className="text-center text-text-muted text-sm py-4">{t('ap.prompt.noTemplates')}</div>}
        </div>
      </Card>

      {selectedTemplate && (
        <Card title={t('ap.prompt.renderTest', { name: selectedTemplate })} desc={t('ap.prompt.renderDesc')}>
          <textarea value={varsInput} onChange={(e) => setVarsInput(e.target.value)} rows={3} className={inputCls + ' font-mono resize-none'} />
          <button onClick={handleRender} className={btnCls + ' text-xs'}>{t('ap.prompt.renderBtn')}</button>
          {renderResult && (
            <div className="bg-bg-primary/50 rounded-lg p-3 text-xs text-text-secondary whitespace-pre-wrap border border-border max-h-40 overflow-y-auto">
              {renderResult}
            </div>
          )}
        </Card>
      )}

      <Card title={t('ap.prompt.registerNew')} desc={t('ap.prompt.registerDesc')}>
        <div>
          <label className="block text-xs text-text-muted mb-1">{t('ap.prompt.templateName')}</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="my_template" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">{t('ap.prompt.templateContent')}</label>
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={4} placeholder={'你是一个{{.role}}。\n\n请用{{.language}}回答。'} className={inputCls + ' font-mono resize-none'} />
        </div>
        <button onClick={handleRegister} disabled={!newName.trim() || !newContent.trim()} className={btnCls}>{t('ap.prompt.registerBtn')}</button>
      </Card>
    </div>
  )
}
