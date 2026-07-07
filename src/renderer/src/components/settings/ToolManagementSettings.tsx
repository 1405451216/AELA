// 8. 工具管理 (Builtin Tools)

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import type { BuiltinToolInfo } from '@shared/types'
import { Card, Toggle } from './shared'

export function ToolManagementSettings() {
  const t = useT()
  const [tools, setTools] = useState<BuiltinToolInfo[]>([])

  const loadData = useCallback(async () => {
    try {
      const t = await window.aela.builtinTools.list()
      setTools(t)
    } catch (err) { console.error('Failed to load tool data:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleToggle = async (name: string, enabled: boolean) => {
    await window.aela.builtinTools.toggle(name, enabled)
    setTools(tools.map(t => t.name === name ? { ...t, enabled } : t))
  }
  const handleEnableAll = async () => {
    for (const t of tools.filter(t => !t.enabled)) {
      await window.aela.builtinTools.toggle(t.name, true)
    }
    loadData()
  }
  const handleDisableAll = async () => {
    for (const t of tools.filter(t => t.enabled)) {
      await window.aela.builtinTools.toggle(t.name, false)
    }
    loadData()
  }

  const categoryLabels: Record<BuiltinToolInfo['category'], string> = {
    filesystem: t('ap.tools.cat.filesystem'),
    shell: t('ap.tools.cat.shell'),
    web: t('ap.tools.cat.web'),
    data: t('ap.tools.cat.data'),
    utility: t('ap.tools.cat.utility'),
    agent: t('ap.tools.cat.agent'),
  }
  const categoryColors: Record<BuiltinToolInfo['category'], string> = {
    filesystem: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    shell: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    web: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    data: 'bg-green-500/10 text-green-400 border-green-500/20',
    utility: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    agent: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  }

  // 按分类分组
  const grouped = tools.reduce<Record<string, BuiltinToolInfo[]>>((acc, tool) => {
    (acc[tool.category] ??= []).push(tool)
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.tools.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.tools.desc')}</p>
      </div>


      {/* 内置工具列表 */}
      <Card title={t('ap.tools.builtinTools')} desc={t('ap.tools.toolCount', { n: tools.length, m: tools.filter(tt => tt.enabled).length })}>
        <div className="flex gap-2 mb-3">
          <button onClick={handleEnableAll} className="text-xs text-accent-light hover:text-accent transition-colors">{t('ap.tools.enableAll')}</button>
          <span className="text-text-muted">|</span>
          <button onClick={handleDisableAll} className="text-xs text-text-muted hover:text-red-400 transition-colors">{t('ap.tools.disableAll')}</button>
        </div>
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, catTools]) => (
            <div key={category}>
              <div className="text-xs font-medium text-text-muted mb-2">{categoryLabels[category as BuiltinToolInfo['category']] || category}</div>
              <div className="space-y-1.5">
                {catTools.map(tool => (
                  <div key={tool.name} className="flex items-center gap-3 p-2.5 bg-bg-primary/50 rounded-lg border border-border">
                    <Toggle checked={tool.enabled} onChange={(v) => handleToggle(tool.name, v)} />
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono text-text-primary">{tool.name}</code>
                      <p className="text-xs text-text-muted mt-0.5 truncate">{tool.description}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-mono shrink-0 border ${categoryColors[tool.category]}`}>
                      {categoryLabels[tool.category]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {tools.length === 0 && <div className="text-center text-text-muted text-sm py-4">{t('ap.tools.noTools')}</div>}
        </div>
      </Card>
    </div>
  )
}
