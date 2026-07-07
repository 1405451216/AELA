// 技能视图 - 展示从电脑扫描到的 skills
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useAppStore } from '../stores/app'
import { useT } from '../i18n'
import type { Skill } from '@shared/types'

export default function SkillsView() {
  const t = useT()
  const { skills, skillScanPaths, skillScanLog, skillDedupConflicts, setSkills, setError } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDedupInfo, setShowDedupInfo] = useState(false)

  const loadSkills = async () => {
    setLoading(true)
    setLocalError(null)
    try {
      const data = await window.aela.skill.reload()
      setSkills({ skills: data.skills, scanPaths: data.scanPaths, scanLog: data.scanLog, dedupConflicts: data.dedupConflicts })
      if (data.skills.length === 0) {
        setLocalError(t('skills.emptyHint'))
      }
    } catch (err: unknown) {
      const msg = `加载技能失败: ${err instanceof Error ? err.message : String(err)}`
      setLocalError(msg)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // 每次挂载都重新扫描，确保数据最新
  useEffect(() => {
    loadSkills()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredSkills = searchQuery.trim()
    ? skills.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : skills

  const sourceLabels: Record<string, string> = {
    user: t('source.user'),
    workspace: t('source.workspace'),
    builtin: t('source.builtin'),
    thirdparty: t('source.thirdparty')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary/50">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{t('skills.title')}</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {skills.length} {t('skills.count')}
            {skillDedupConflicts.length > 0 && (
              <span className="ml-2 text-yellow-500">
                · {skillDedupConflicts.length} 个重复已合并
                <button
                  onClick={() => setShowDedupInfo(!showDedupInfo)}
                  className="ml-1 underline hover:text-yellow-400"
                >
                  {showDedupInfo ? '隐藏' : '查看'}
                </button>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('skills.search')}
              className="bg-surface text-text-primary text-sm rounded-lg pl-8 pr-3 py-1.5 border border-border focus:border-accent focus:outline-none w-48"
            />
          </div>
          <button
            onClick={loadSkills}
            disabled={loading}
            className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text-primary rounded-lg text-sm border border-border transition-colors disabled:opacity-50"
          >
            {loading ? t('skills.scanning') : t('skills.rescan')}
          </button>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 技能列表 */}
        <div className="w-80 border-r border-border overflow-y-auto bg-bg-secondary/30">
          {filteredSkills.length === 0 ? (
            <div className="p-6 text-center text-text-muted text-sm">
              {loading ? t('skills.scanning2') : t('skills.none')}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedSkill(skill)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-pressed={selectedSkill?.id === skill.id}
                  aria-label={`Open skill: ${skill.name}`}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedSkill?.id === skill.id
                      ? 'bg-surface-active border border-accent/30'
                      : 'hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-sm font-medium text-text-primary truncate flex-1">
                      {skill.name}
                    </h3>
                    <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded ml-2 shrink-0">
                      {sourceLabels[skill.source]}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {skill.description}
                  </p>
                  {skill.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {skill.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 详情面板 */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedSkill ? (
            <div>
              <div className="mb-4">
                <h1 className="text-2xl font-bold text-text-primary mb-2">
                  {selectedSkill.name}
                </h1>
                <p className="text-sm text-text-secondary mb-3">
                  {selectedSkill.description}
                </p>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span>{t('skills.source')}: {sourceLabels[selectedSkill.source]}</span>
                  <span>·</span>
                  <span className="font-mono">{selectedSkill.path}</span>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-lg p-4 selectable">
                <div className="markdown-body text-sm leading-relaxed text-text-primary">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ _node, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        const isInline = !match && !String(children).includes('\n')

                        if (isInline) {
                          return <code className={className} {...props}>{children}</code>
                        }

                        return (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match?.[1] || 'text'}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        )
                      },
                      a: ({ _node, ...props }: any) => (
                        <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent-light underline" />
                      ),
                      table: ({ _node, ...props }: any) => (
                        <table className="border-collapse border border-border my-2 w-full text-xs" {...props} />
                      ),
                      th: ({ _node, ...props }: any) => (
                        <th className="border border-border px-3 py-1 bg-surface-hover" {...props} />
                      ),
                      td: ({ _node, ...props }: any) => (
                        <td className="border border-border px-3 py-1" {...props} />
                      )
                    }}
                  >
                    {selectedSkill.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-text-muted">
              <div className="text-5xl mb-3">{loading ? '⏳' : '🔧'}</div>
              <p className="text-sm">{loading ? t('skills.scanning2') : t('skills.selectHint')}</p>
              {/* 错误提示 */}
              {localError && !loading && (
                <div className="mt-4 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs max-w-md text-center">
                  {localError}
                </div>
              )}
              {/* 诊断信息：当没有 skills 时始终显示扫描日志 */}
              {!loading && skillScanLog.length > 0 && (
                <div className="mt-6 w-full max-w-2xl bg-surface border border-border rounded-lg p-4 text-left max-h-[60vh] overflow-y-auto">
                  <p className="text-xs font-medium text-text-secondary mb-3">{t('skills.scanDiag')}</p>
                  <div className="space-y-2">
                    {skillScanLog.map((entry, i) => (
                      <div key={i} className="text-[11px] font-mono leading-relaxed">
                        <span className={entry.exists ? 'text-green-500' : 'text-red-500'}>
                          {entry.exists ? '✓' : '✗'}
                        </span>
                        <span className="text-text-muted ml-2">
                          [{sourceLabels[entry.source] || entry.source}]
                        </span>
                        <span className="text-text-secondary ml-1 break-all">{entry.dir}</span>
                        {entry.exists && entry.isDirectory && (
                          <span className="text-text-muted ml-2">
                            → {entry.entryCount} {t('skills.entries')} {entry.skillsFound} {t('skills.skillFound')}
                          </span>
                        )}
                        {entry.error && (
                          <div className="text-red-400 ml-6 mt-1">错误: {entry.error}</div>
                        )}
                        {entry.loadErrors && entry.loadErrors.length > 0 && (
                          <div className="ml-6 mt-1 space-y-0.5">
                            {entry.loadErrors.slice(0, 5).map((e: string, j: number) => (
                              <div key={j} className="text-red-400">{e}</div>
                            ))}
                            {entry.loadErrors.length > 5 && (
                              <div className="text-red-400">...还有 {entry.loadErrors.length - 5} 个错误</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 去重冲突详情 */}
          {showDedupInfo && skillDedupConflicts.length > 0 && (
            <div className="mt-6 w-full max-w-2xl bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-4 text-left max-h-[40vh] overflow-y-auto">
              <p className="text-xs font-medium text-yellow-500 mb-3">已合并的重复技能（按优先级保留）</p>
              <div className="space-y-2">
                {skillDedupConflicts.map((conflict, i) => (
                  <div key={i} className="text-[11px] leading-relaxed">
                    <div className="flex items-center gap-2">
                      <span className="text-text-primary font-medium">{conflict.name}</span>
                      <span className="text-green-400">✓ 保留</span>
                      <span className="text-text-muted">{sourceLabels[conflict.keptSource] || conflict.keptSource}</span>
                    </div>
                    <div className="ml-4 text-text-muted">
                      <span className="text-red-400">✗ 跳过</span>
                      <span className="ml-2">{sourceLabels[conflict.skippedSource] || conflict.skippedSource}</span>
                      <span className="ml-2 text-text-muted/50">{conflict.reason === 'higher_priority' ? '(优先级更高)' : '(已存在)'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部扫描路径提示 */}
      {skillScanPaths.length > 0 && (
        <div className="border-t border-border px-6 py-2 bg-bg-secondary/30">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted">
            <span className="shrink-0">{t('skills.scanPaths')}:</span>
            {skillScanPaths.map((p, i) => (
              <span key={i} className="font-mono">
                {sourceLabels[p.source] || p.source}: {p.path}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
