import { useState, useEffect, useCallback } from 'react'
import type { SupervisorSession, WorkerAgent, WorkerRole, MultiAgentTask } from '@shared/types'

const ROLE_LABELS: Record<WorkerRole, { icon: string; label: string }> = {
  coder: { icon: '💻', label: '编码' },
  reviewer: { icon: '🔍', label: '审查' },
  tester: { icon: '🧪', label: '测试' },
  researcher: { icon: '📚', label: '研究' },
}

const SESSION_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  planning: { color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50', label: '规划中' },
  executing: { color: 'text-blue-400 bg-blue-900/30 border-blue-700/50', label: '执行中' },
  reviewing: { color: 'text-purple-400 bg-purple-900/30 border-purple-700/50', label: '审查中' },
  completed: { color: 'text-green-400 bg-green-900/30 border-green-700/50', label: '已完成' },
}

export default function MultiAgentView() {
  const [sessions, setSessions] = useState<SupervisorSession[]>([])
  const [goal, setGoal] = useState('')
  const [workerRole, setWorkerRole] = useState<WorkerRole>('coder')
  const [workerName, setWorkerName] = useState('')
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [taskDescription, setTaskDescription] = useState('')
  const [tasks, setTasks] = useState<MultiAgentTask[]>([])
  const [messages, setMessages] = useState<Array<{ from: string; to: string; type: string; payload: unknown }>>([])
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    // Stub: sessions managed locally until IPC is wired
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!selectedSession) return
    const interval = setInterval(() => {
      // Stub: task polling managed locally until IPC is wired
    }, 2000)
    return () => clearInterval(interval)
  }, [selectedSession])

  const handleStartSession = async () => {
    if (!goal.trim()) return
    setError(null)

    const workers: WorkerAgent[] = [
      { id: `coder-${Date.now()}`, name: '编码者', role: 'coder', skills: ['coding', 'debugging'], available: true },
      { id: `reviewer-${Date.now()}`, name: '审查者', role: 'reviewer', skills: ['review', 'security'], available: true },
    ]

    if (workerName.trim()) {
      workers.push({
        id: `custom-${Date.now()}`,
        name: workerName.trim(),
        role: workerRole,
        skills: [],
        available: true,
      })
    }

    const newSession: SupervisorSession = {
      id: `session-${Date.now()}`,
      goal: goal.trim(),
      workers,
      tasks: [{
        id: `task-${Date.now()}`,
        description: goal.trim(),
        status: 'pending',
        progress: 0,
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
      status: 'planning',
      budget: {
        maxTokens: 100000,
        usedTokens: 0,
        maxDurationMs: 300000,
        startedAt: new Date().toISOString(),
      },
    }

    setSessions(prev => [...prev, newSession])
    setSelectedSession(newSession.id)
    setGoal('')
    setWorkerName('')
  }

  const handleDelegate = async () => {
    if (!selectedSession || !taskDescription.trim()) return
    const newTask: MultiAgentTask = {
      id: `task-${Date.now()}`,
      description: taskDescription.trim(),
      status: 'pending',
      progress: 0,
      dependencies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, newTask])
    setSessions(prev => prev.map(s =>
      s.id === selectedSession ? { ...s, tasks: [...s.tasks, newTask] } : s
    ))
    setTaskDescription('')
  }

  const handleSendMessage = async () => {
    if (!selectedSession) return
    setMessages(prev => [...prev, {
      from: 'user',
      to: 'broadcast',
      type: 'notify',
      payload: { text: 'Manual message from user' },
    }])
  }

  const handleStopSession = async (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (selectedSession === sessionId) setSelectedSession(null)
  }

  const activeSession = sessions.find(s => s.id === selectedSession)

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">🤖 Multi-Agent 协作空间</h2>
          <p className="text-sm text-text-secondary mt-1">
            Session 管理 · Agent 通信 · 任务委派 · 冲突解决
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">启动新 Session</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="目标描述 (例如: 实现用户认证模块)..."
                  className="w-full bg-surface text-text-primary text-sm rounded px-3 py-2 border border-border focus:border-accent focus:outline-none"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={workerName}
                    onChange={e => setWorkerName(e.target.value)}
                    placeholder="自定义 Worker 名称 (可选)"
                    className="flex-1 bg-surface text-text-primary text-xs rounded px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                  />
                  <select
                    value={workerRole}
                    onChange={e => setWorkerRole(e.target.value as WorkerRole)}
                    className="bg-surface text-text-primary text-xs rounded px-2 py-1.5 border border-border"
                  >
                    <option value="coder">编码</option>
                    <option value="reviewer">审查</option>
                    <option value="tester">测试</option>
                    <option value="researcher">研究</option>
                  </select>
                  <button
                    onClick={handleStartSession}
                    disabled={!goal.trim()}
                    className="px-4 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    启动
                  </button>
                </div>
              </div>
            </div>

            {activeSession && (
              <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Session: {activeSession.goal}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${SESSION_STATUS_CONFIG[activeSession.status]?.color}`}>
                    {SESSION_STATUS_CONFIG[activeSession.status]?.label}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {activeSession.workers.map(w => {
                    const roleCfg = ROLE_LABELS[w.role]
                    return (
                      <span key={w.id} className="text-[10px] px-2 py-1 rounded-full border border-border bg-surface text-text-secondary">
                        {roleCfg.icon} {w.name} ({roleCfg.label})
                      </span>
                    )
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={taskDescription}
                    onChange={e => setTaskDescription(e.target.value)}
                    placeholder="委派任务描述..."
                    className="flex-1 bg-surface text-text-primary text-xs rounded px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={handleDelegate}
                    disabled={!taskDescription.trim()}
                    className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    委派
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-text-primary">任务进度</h4>
                  {tasks.filter(t => t.description !== activeSession.goal).length === 0 ? (
                    <div className="text-xs text-text-muted">暂无委派任务</div>
                  ) : (
                    tasks.filter(t => t.description !== activeSession.goal).map(task => (
                      <div key={task.id} className="flex items-center gap-2 text-xs">
                        <span className={task.status === 'completed' ? 'text-green-400' : task.status === 'failed' ? 'text-red-400' : 'text-blue-400'}>
                          {task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '🔄'}
                        </span>
                        <span className="text-text-secondary truncate flex-1">{task.description}</span>
                        {task.assignedAgent && (
                          <span className="text-text-muted text-[10px]">{task.assignedAgent}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {activeSession.budget && (
                  <div className="text-[10px] text-text-muted flex gap-3">
                    <span>Token: {activeSession.budget.usedTokens.toLocaleString()} / {activeSession.budget.maxTokens.toLocaleString()}</span>
                    <span>耗时: {Math.round((Date.now() - new Date(activeSession.budget.startedAt).getTime()) / 1000)}s / {Math.round(activeSession.budget.maxDurationMs / 1000)}s</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-bg-secondary rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">活跃 Sessions</h3>
              {sessions.length === 0 ? (
                <div className="text-xs text-text-muted">暂无活跃 Session</div>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      className={`p-2 rounded cursor-pointer transition-colors ${selectedSession === session.id ? 'bg-accent/10 border border-accent' : 'hover:bg-surface-hover border border-transparent'}`}
                      onClick={() => setSelectedSession(session.id)}
                    >
                      <div className="text-xs text-text-primary truncate">{session.goal}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${SESSION_STATUS_CONFIG[session.status]?.color}`}>
                          {SESSION_STATUS_CONFIG[session.status]?.label}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStopSession(session.id) }}
                          className="text-[10px] text-text-muted hover:text-red-400"
                        >
                          停止
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Agent 通信</h3>
              <button
                onClick={handleSendMessage}
                disabled={!selectedSession}
                className="w-full px-3 py-1.5 bg-surface text-text-primary text-xs rounded border border-border hover:border-accent disabled:opacity-50"
              >
                广播通知
              </button>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {messages.length === 0 ? (
                  <div className="text-[10px] text-text-muted">暂无消息</div>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className="text-[10px] text-text-muted p-1 bg-surface rounded">
                      <span className="text-text-secondary">{msg.from}</span> → {msg.to} ({msg.type})
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
