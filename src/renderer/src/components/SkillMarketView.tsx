import { useState, useEffect, useCallback } from 'react'
import type { SkillRegistryEntry, InstalledSkillInfo } from '@shared/types/skill'

type FilterCategory = 'all' | 'installed' | 'available' | 'updates'

const CATEGORIES: Array<{ key: FilterCategory; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'installed', label: '已安装' },
  { key: 'updates', label: '可更新' },
  { key: 'available', label: '可安装' },
]

export default function SkillMarketView() {
  const [registry, setRegistry] = useState<SkillRegistryEntry[]>([])
  const [installed, setInstalled] = useState<InstalledSkillInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [category, setCategory] = useState<FilterCategory>('all')

  const loadData = useCallback(async () => {
    try {
      const result = await window.aela.skillMarket.list()
      setRegistry(result.registry)
      setInstalled(result.installed)
      setOffline(result.offline)
    } catch (err) {
      console.error('[SkillMarket] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const getFilteredSkills = () => {
    const installedIds = new Set(installed.map(s => s.id))
    const updates = new Set(
      installed.filter(s => {
        const remote = registry.find(r => r.id === s.id)
        return remote && remote.version !== s.version
      }).map(s => s.id)
    )

    switch (category) {
      case 'installed':
        return registry.filter(s => installedIds.has(s.id))
      case 'updates':
        return registry.filter(s => updates.has(s.id))
      case 'available':
        return registry.filter(s => !installedIds.has(s.id))
      default:
        return registry
    }
  }

  const filteredSkills = getFilteredSkills()

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Skill 市场</h3>
          <p className="text-xs text-text-muted mt-1">
            浏览和安装社区 skill，所有 skill 均支持本地卸载
          </p>
        </div>
        {offline && (
          <span className="px-3 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded-full">
            离线模式
          </span>
        )}
      </div>

      {/* 分类 Tabs */}
      <div className="flex gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              category === c.key
                ? 'bg-accent text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Skill 卡片网格 */}
      {loading ? (
        <div className="text-center py-12 text-text-muted text-sm">加载中...</div>
      ) : filteredSkills.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">
          {category === 'all' ? '暂无可用 skill' : '暂无符合条件的 skill'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map(skill => (
            <SkillCard
              key={skill.id}
              entry={skill}
              installed={installed}
              onActionComplete={loadData}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface SkillCardProps {
  entry: SkillRegistryEntry
  installed: InstalledSkillInfo[]
  onActionComplete: () => void
}

function SkillCard({ entry, installed, onActionComplete }: SkillCardProps) {
  const [loading, setLoading] = useState(false)
  const installedSkill = installed.find(s => s.id === entry.id)
  const isInstalled = !!installedSkill
  const hasUpdate = isInstalled && installedSkill!.version !== entry.version

  const handleInstall = async () => {
    setLoading(true)
    try {
      await window.aela.skillMarket.install(entry)
      onActionComplete()
    } catch (err) {
      console.error('[SkillMarket] Install failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUninstall = async () => {
    setLoading(true)
    try {
      await window.aela.skillMarket.uninstall(entry.id)
      onActionComplete()
    } catch (err) {
      console.error('[SkillMarket] Uninstall failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-text-primary truncate">{entry.name}</h4>
          <p className="text-xs text-text-muted mt-0.5">by {entry.author} · v{entry.version}</p>
        </div>
        {isInstalled && (
          <span className="shrink-0 ml-2 px-2 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">
            已安装
          </span>
        )}
        {hasUpdate && (
          <span className="shrink-0 ml-2 px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
            可更新
          </span>
        )}
      </div>

      <p className="text-xs text-text-secondary line-clamp-2">{entry.description}</p>

      {/* 权限摘要 */}
      {entry.permissions && (
        <div className="flex gap-2 text-xs text-text-muted">
          {entry.permissions.files && entry.permissions.files !== 'none' && (
            <span className="px-1.5 py-0.5 bg-surface-active rounded" title="文件权限">
              📁 {entry.permissions.files}
            </span>
          )}
          {entry.permissions.terminal && entry.permissions.terminal !== 'none' && (
            <span className="px-1.5 py-0.5 bg-surface-active rounded" title="终端权限">
              💻 {entry.permissions.terminal}
            </span>
          )}
          {entry.permissions.network && (
            <span className="px-1.5 py-0.5 bg-surface-active rounded" title="网络权限">
              🌐 {entry.permissions.network}
            </span>
          )}
        </div>
      )}

      {/* 底部操作 */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-[10px] text-text-muted">
          {entry.downloads && `${entry.downloads.toLocaleString()} 次下载`}
          {entry.rating && ` · ⭐ ${entry.rating.toFixed(1)}`}
        </div>
        <div className="flex gap-2">
          {isInstalled && hasUpdate && (
            <button
              onClick={handleInstall}
              disabled={loading}
              className="px-3 py-1.5 bg-amber-500/80 hover:bg-amber-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {loading ? `更新中...` : `更新`}
            </button>
          )}
          {isInstalled && !hasUpdate && (
            <button
              onClick={handleUninstall}
              disabled={loading}
              className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {loading ? `卸载中...` : `卸载`}
            </button>
          )}
          {!isInstalled && (
            <button
              onClick={handleInstall}
              disabled={loading}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {loading ? `安装中...` : `安装`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
