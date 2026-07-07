// AELA — 插件管理面板
// 显示已安装插件列表，支持启用/禁用/配置

import { useState, useEffect, useCallback } from 'react'

interface Plugin {
  id: string
  manifest: {
    name: string
    version: string
    description: string
    author?: string
  }
  enabled: boolean
  installedAt: string
}

export default function PluginManagerView() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, enabled: 0, disabled: 0 })

  const loadPlugins = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.aela?.plugin?.list?.() ?? []
      setPlugins(list)
      const s = await window.aela?.plugin?.stats?.() ?? { total: 0, enabled: 0, disabled: 0 }
      setStats(s)
    } catch (err) {
      console.error('[Plugin] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlugins()
  }, [loadPlugins])

  const handleToggle = async (id: string, enabled: boolean) => {
    await window.aela?.plugin?.toggle?.(id, enabled)
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled } : p))
    setStats(prev => ({
      ...prev,
      enabled: enabled ? prev.enabled + 1 : prev.enabled - 1,
      disabled: enabled ? prev.disabled - 1 : prev.disabled + 1,
    }))
  }

  const handleReload = async () => {
    await loadPlugins()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-text-primary">插件管理</h1>
          <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded">
            {stats.total} 个插件 · {stats.enabled} 个启用
          </span>
        </div>
        <button
          onClick={handleReload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-surface hover:bg-surface-hover text-text-secondary transition-colors"
        >
          <span>🔄</span> 重新加载
        </button>
      </div>

      {/* 插件列表 */}
      {plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-text-muted text-sm">暂无已安装的插件</p>
          <p className="text-text-muted text-xs mt-2">
            将插件放入 <code className="bg-surface px-1 py-0.5 rounded text-[10px]">~/Library/Application Support/AELA/plugins/</code> 目录
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3">
          {plugins.map(plugin => (
            <div
              key={plugin.id}
              className="flex items-center justify-between p-4 bg-bg-secondary border border-border rounded-lg hover:border-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-text-primary">{plugin.manifest.name}</h3>
                  <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">
                    v{plugin.manifest.version}
                  </span>
                  {plugin.manifest.author && (
                    <span className="text-[10px] text-text-muted">by {plugin.manifest.author}</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-1 truncate">{plugin.manifest.description}</p>
                <p className="text-[10px] text-text-muted mt-1">
                  安装于 {new Date(plugin.installedAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              {/* 开关 */}
              <button
                onClick={() => handleToggle(plugin.id, !plugin.enabled)}
                className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${
                  plugin.enabled ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    plugin.enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
