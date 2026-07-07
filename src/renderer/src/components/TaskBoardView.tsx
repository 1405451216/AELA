import { useState, useEffect, useCallback } from 'react'
import type { MultiAgentTask as Task, MultiAgentTaskStatus as TaskStatus } from '@shared/types'

const STATUS_CONFIG: Record<TaskStatus, { color: string; icon: string; label: string }> = {
  pending: { color: 'text-gray-400 bg-gray-800/30 border-gray-700/50', icon: '⏳', label: '待处理' },
  assigned: { color: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50', icon: '👤', label: '已分配' },
  in_progress: { color: 'text-blue-400 bg-blue-900/30 border-blue-700/50', icon: '🔄', label: '进行中' },
  completed: { color: 'text-green-400 bg-green-900/30 border-green-700/50', icon: '✅', label: '已完成' },
  failed: { color: 'text-red-400 bg-red-900/30 border-red-700/50', icon: '❌', label: '失败' },
}

export default function TaskBoardView() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [description, setDescription] = useState('')
  const [assignedAgent, setAssignedAgent] = useState('')
  const [dependencies, setDependencies] = useState('')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('')
  const [error, setError] = useState<string | null>(null)

  const loadTasks = useCallback(() => {
    // Stub: tasks managed locally until IPC is wired
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreate = () => {
    if (!description.trim()) return
    setError(null)
    const deps = dependencies.trim()
      ? dependencies.split(',').map(d => d.trim()).filter(Boolean)
      : []
    const newTask: Task = {
      id: `task-${Date.now()}`,
      description: description.trim(),
      assignedAgent: assignedAgent.trim() || undefined,
      status: 'pending',
      progress: 0,
      dependencies: deps,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setTasks(prev => [...prev, newTask])
    setDescription('')
    setAssignedAgent('')
    setDependencies('')
  }

  const handleDelete = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
    ))
  }

  const handleClearCompleted = () => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'))
  }

  const filteredTasks = filterStatus
    ? tasks.filter(t => t.status === filterStatus)
    : tasks

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">📋 TaskBoard</h2>
          <p className="text-sm text-text-secondary mt-1">
            任务管理 · 依赖图(DAG) · 进度追踪
          </p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">创建任务</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="任务描述..."
              className="w-full bg-surface text-text-primary text-sm rounded px-3 py-2 border border-border focus:border-accent focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={assignedAgent}
                onChange={e => setAssignedAgent(e.target.value)}
                placeholder="分配 Agent ID (可选)"
                className="flex-1 bg-surface text-text-primary text-xs rounded px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
              />
              <input
                type="text"
                value={dependencies}
                onChange={e => setDependencies(e.target.value)}
                placeholder="依赖任务 ID (逗号分隔)"
                className="flex-1 bg-surface text-text-primary text-xs rounded px-3 py-1.5 border border-border focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={!description.trim()}
                className="px-4 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        </div>

        <div className="bg-bg-secondary rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-primary">
              任务列表 ({filteredTasks.length})
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value as TaskStatus | '')}
                className="bg-surface text-text-primary text-xs rounded px-2 py-1 border border-border"
              >
                <option value="">全部状态</option>
                <option value="pending">待处理</option>
                <option value="assigned">已分配</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="failed">失败</option>
              </select>
              <button
                onClick={handleClearCompleted}
                className="text-xs text-text-muted hover:text-red-400 px-2 py-1"
              >
                清除已完成
              </button>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8">
              {filterStatus ? '没有符合筛选条件的任务' : '暂无任务，创建第一个任务'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(task => {
                const config = STATUS_CONFIG[task.status]
                return (
                  <div key={task.id} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                      <span className="text-sm text-text-primary flex-1 truncate">{task.description}</span>
                      {task.assignedAgent && (
                        <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">
                          {task.assignedAgent}
                        </span>
                      )}
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-text-muted hover:text-red-400 text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>

                    {task.status !== 'completed' && task.status !== 'failed' && (
                      <div className="flex gap-1">
                        {task.status !== 'in_progress' && task.status !== 'assigned' && (
                          <button
                            onClick={() => handleStatusChange(task.id, 'in_progress')}
                            className="text-[10px] px-2 py-0.5 rounded bg-blue-900/20 text-blue-400 hover:bg-blue-900/40"
                          >
                            开始
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(task.id, 'completed')}
                              className="text-[10px] px-2 py-0.5 rounded bg-green-900/20 text-green-400 hover:bg-green-900/40"
                            >
                              完成
                            </button>
                            <button
                              onClick={() => handleStatusChange(task.id, 'failed')}
                              className="text-[10px] px-2 py-0.5 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40"
                            >
                              标记失败
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {task.dependencies.length > 0 && (
                      <div className="text-[10px] text-text-muted">
                        依赖: {task.dependencies.join(', ')}
                      </div>
                    )}

                    {task.result && (
                      <pre className="text-[10px] text-text-secondary bg-surface rounded p-2 overflow-x-auto max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {task.result}
                      </pre>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
