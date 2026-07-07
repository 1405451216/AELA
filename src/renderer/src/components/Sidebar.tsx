// 侧边栏 - 按工作区分组显示对话列表
import { useEffect, useState, useCallback } from 'react'
import { useViewStore, type ViewType } from '../stores/viewStore'
import { useConfigStore } from '../stores/configStore'
import { useMessagesStore } from '../stores/messagesStore'
import { useT } from '../i18n'
import { AelaLogo } from '../assets/AelaLogo'
import type { Session, Workspace } from '@shared/types'
import EmptyState from '../shared/EmptyState'
import { SkeletonSessionList } from '../shared/Skeleton'

export default function Sidebar() {
  const t = useT()
  const currentView = useViewStore(s => s.currentView)
  const setView = useViewStore(s => s.setView)
  const currentSession = useConfigStore(s => s.currentSession)
  const setCurrentSession = useConfigStore(s => s.setCurrentSession)
  const currentWorkspace = useConfigStore(s => s.currentWorkspace)
  const setCurrentWorkspace = useConfigStore(s => s.setCurrentWorkspace)
  const currentModelConfig = useConfigStore(s => s.currentModelConfig)
  const theme = useConfigStore(s => s.theme)
  const toggleTheme = useConfigStore(s => s.toggleTheme)
  const [sessions, setSessions] = useState<Session[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsedWs, setCollapsedWs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // 加载工作区 + 会话列表
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [wsList, sessList] = await Promise.all([
        window.aela.workspace.list(),
        window.aela.session.list() // 不传 workspaceId，获取所有会话
      ])
      setWorkspaces(wsList)
      setSessions(sessList)
    } catch (err) {
      console.error('Failed to load sidebar data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听刷新事件
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (Array.isArray(detail)) {
        setSessions(detail)
      } else {
        loadData()
      }
    }
    window.addEventListener('aela-refresh-sessions', handler)
    return () => window.removeEventListener('aela-refresh-sessions', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 创建新任务（新建对话）
  const handleNewTask = async () => {
    try {
      const session = await window.aela.session.create({
        workspaceId: currentWorkspace?.id,
        modelConfigId: useConfigStore.getState().currentModelConfig?.id
      })
      setCurrentSession(session)
      setView('chat')
      useMessagesStore.getState().setMessages([])
      loadData()
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }

  // 选择任务
  const handleSelectSession = async (session: Session) => {
    setCurrentSession(session)
    setView('chat')
    // 如果会话关联了工作区，切换当前工作区
    if (session.workspaceId) {
      const ws = workspaces.find(w => w.id === session.workspaceId)
      if (ws) setCurrentWorkspace(ws)
    }
    try {
      const messages = await window.aela.session.getMessages(session.id)
      useMessagesStore.getState().setMessages(messages)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }

  // 删除任务
  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await window.aela.session.delete(id)
      if (currentSession?.id === id) {
        setCurrentSession(null)
        useMessagesStore.getState().setMessages([])
      }
      loadData()
    } catch (err) {
      console.error('Failed to delete session:', err)
    }
  }

  // 切换工作区折叠状态
  const toggleCollapse = (wsId: string) => {
    setCollapsedWs(prev => {
      const next = new Set(prev)
      if (next.has(wsId)) next.delete(wsId)
      else next.add(wsId)
      return next
    })
  }

  // 主入口菜单
  const mainEntries: Array<{ key: ViewType; label: string; icon: string }> = [
    { key: 'chat', label: t('sidebar.newTask'), icon: '＋' },
    { key: 'skills', label: t('sidebar.skills'), icon: '⚐' },
    { key: 'automation', label: t('sidebar.automation'), icon: '⏰' },
  ]

  // 升级模块快捷入口
  const upgradeEntries: Array<{ key: ViewType; label: string; icon: string }> = [
    { key: 'memorySearch', label: t('sidebar.memorySearch'), icon: '🔍' },
    { key: 'orchTemplates', label: t('sidebar.orchTemplates'), icon: '📋' },
    { key: 'observability', label: t('sidebar.observability'), icon: '📊' },
    { key: 'fewShotWeight', label: t('sidebar.fewShotWeight'), icon: '⚖️' },
    { key: 'toolLearning', label: t('sidebar.toolLearning'), icon: '🧠' },
    { key: 'securityPreset', label: t('sidebar.securityPreset'), icon: '🛡️' },
    { key: 'sessionManager', label: t('sidebar.sessionManager'), icon: '🗂️' },
    { key: 'adaptiveLearning', label: t('sidebar.adaptiveLearning'), icon: '🎯' },
    { key: 'screenshotAnalysis', label: t('sidebar.screenshotAnalysis'), icon: '📸' },
    { key: 'resilience', label: t('sidebar.resilience'), icon: '🛡️' },
  ]

  // 按工作区分组会话
  const groupedSessions = sessions.reduce<Record<string, Session[]>>((acc, s) => {
    const key = s.workspaceId || '__no_workspace__'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  // 过滤搜索
  const filteredGrouped = searchQuery.trim()
    ? Object.entries(groupedSessions).reduce<Record<string, Session[]>>((acc, [wsId, list]) => {
        const filtered = list.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
        if (filtered.length > 0) acc[wsId] = filtered
        return acc
      }, {})
    : groupedSessions

  return (
    <aside className="w-64 h-full bg-bg-secondary border-r border-border flex flex-col">
      {/* Logo & 标题 — 同时作为窗口拖拽区域 */}
      <div className="app-drag px-4 py-3 border-b border-border flex items-center justify-between h-9">
        <div className="flex items-center gap-2">
          <AelaLogo size={20} />
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-text-primary leading-none">AELA</h1>
            <span className="text-[8px] text-text-muted leading-none mt-0.5">AI Agent 工程平台</span>
          </div>
          <span className="text-[9px] text-text-muted bg-surface px-1 py-0.5 rounded">v0.2.0</span>
        </div>
        <button
          onClick={toggleTheme}
          className="app-no-drag p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors text-sm"
          title={theme === 'dark' ? t('sidebar.toLight') : t('sidebar.toDark')}
          aria-label={theme === 'dark' ? t('sidebar.toLight') : t('sidebar.toDark')}
          aria-pressed={theme === 'dark'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* 主入口：新建任务/技能/自动化 */}
      <div className="px-2 py-2 space-y-0.5">
        {mainEntries.map(entry => (
          <button
            key={entry.key}
            onClick={() => {
              if (entry.key === 'chat') {
                handleNewTask()
              } else {
                setView(entry.key)
              }
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              currentView === entry.key
                ? 'bg-surface-active text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <span className="text-base w-4 text-center">{entry.icon}</span>
            <span className="font-medium">{entry.label}</span>
          </button>
        ))}
      </div>

      {/* 升级模块快捷入口 */}
      <div className="px-2 py-1.5 border-t border-border/50">
        <div className="px-2 py-1 text-[9px] text-text-muted uppercase tracking-wider font-medium">
          工具
        </div>
        <div className="grid grid-cols-4 gap-1 px-1">
          {upgradeEntries.map(entry => (
            <button
              key={entry.key}
              onClick={() => setView(entry.key)}
              className={`flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md text-[9px] transition-colors ${
                currentView === entry.key
                  ? 'bg-surface-active text-text-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
              }`}
              title={entry.label}
            >
              <span className="text-sm">{entry.icon}</span>
              <span className="truncate w-full text-center">{entry.label.slice(0, 4)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 对话列表区域 */}
      <div className="flex-1 overflow-hidden flex flex-col border-t border-border mt-2">
        {/* 标题栏 */}
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[11px] text-text-muted uppercase tracking-wider font-medium">{t('sidebar.taskList')}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleNewTask}
              className="text-text-muted hover:text-accent-light text-sm w-5 h-5 rounded flex items-center justify-center"
              title={t('sidebar.newTaskTitle')}
              aria-label={t('sidebar.newTaskTitle')}
            >
              +
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="px-3 pb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('sidebar.searchTask')}
            className="w-full bg-surface text-text-primary text-xs rounded-md px-2.5 py-1.5 border border-border focus:border-accent focus:outline-none"
          />
        </div>

        {/* 列表内容：按工作区分组 */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loading ? (
            <SkeletonSessionList />
          ) : Object.keys(filteredGrouped).length === 0 ? (
            <EmptyState
              icon={searchQuery ? '🔍' : '💬'}
              title={searchQuery ? t('sidebar.noMatch') : t('sidebar.noTask')}
              description={searchQuery ? undefined : t('sidebar.noTaskDesc')}
              action={searchQuery ? undefined : { label: t('sidebar.newTaskAction'), onClick: handleNewTask }}
            />
          ) : (
            <div className="space-y-2">
              {/* 每个工作区分组 */}
              {Object.entries(filteredGrouped).map(([wsId, sessionList]) => {
                const ws = workspaces.find(w => w.id === wsId)
                const isNoWorkspace = wsId === '__no_workspace__'
                const wsName = isNoWorkspace ? '未关联工作区' : (ws?.name || wsId.slice(0, 8))
                const isCollapsed = collapsedWs.has(wsId)
                const isActiveWs = currentWorkspace?.id === wsId

                return (
                  <div key={wsId}>
                    {/* 工作区头部 */}
                    <div
                      onClick={() => !isNoWorkspace && ws && setCurrentWorkspace(ws)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                        isActiveWs ? 'bg-accent/10 text-accent-light' : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(wsId) }}
                        className="text-[10px] w-3 shrink-0 text-text-muted hover:text-text-primary"
                        aria-label={isCollapsed ? '展开' : '收起'}
                      >
                        {isCollapsed ? '▶' : '▼'}
                      </button>
                      <span className="text-[11px] shrink-0">{isNoWorkspace ? '📂' : '📁'}</span>
                      <span className="text-[11px] font-medium truncate flex-1" title={ws?.path || wsName}>
                        {wsName}
                      </span>
                      <span className="text-[9px] text-text-muted shrink-0">{sessionList.length}</span>
                    </div>

                    {/* 会话列表 */}
                    {!isCollapsed && (
                      <div className="space-y-0.5 ml-2 mt-0.5 border-l border-border/30 pl-1.5">
                        {sessionList.map(s => (
                          <SessionItem
                            key={s.id}
                            session={s}
                            active={currentSession?.id === s.id}
                            onSelect={() => handleSelectSession(s)}
                            onDelete={(e) => handleDeleteSession(e, s.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部设置入口 */}
      <div className="border-t border-border px-2 py-2">
        <button
          onClick={() => setView('settings')}
          aria-current={currentView === 'settings' ? 'page' : undefined}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            currentView === 'settings'
              ? 'bg-surface-active text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          <span className="text-base w-4 text-center">⚙️</span>
          <span className="font-medium">{t('sidebar.settings')}</span>
          {currentModelConfig ? (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {currentModelConfig.name.slice(0, 8)}
            </span>
          ) : (
            <span className="ml-auto text-[10px] text-orange-400">{t('sidebar.notConfigured')}</span>
          )}
        </button>
      </div>
    </aside>
  )
}

// 单个对话项
function SessionItem({
  session,
  active,
  onSelect,
  onDelete
}: {
  session: Session
  active: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open session: ${session.title}`}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
        active
          ? 'bg-surface-active text-text-primary'
          : 'text-text-secondary hover:bg-surface-hover'
      }`}
    >
      <span className="text-[10px] shrink-0" aria-hidden="true">💬</span>
      <span className="truncate flex-1">{session.title || '新对话'}</span>
      <button
        onClick={onDelete}
        aria-label={`Delete session: ${session.title}`}
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity text-xs shrink-0"
      >
        ✕
      </button>
    </div>
  )
}
