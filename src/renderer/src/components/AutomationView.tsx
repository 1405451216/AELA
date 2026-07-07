import { logError } from '../lib/logger'
// 自动化任务视图
import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/app'
import { dialog } from '../stores/dialog'
import type { AutomationTask, AutomationRunRecord, AutomationTrigger } from '@shared/types'
import { useT } from '../i18n'

type TabKey = 'configured' | 'history' | 'templates'

// 预设频率选项
const FREQUENCY_PRESETS = [
  { key: 'manual', label: '手动执行', desc: '需要手动点击运行', icon: '👆' },
  { key: 'hourly', label: '每小时', desc: '每整点执行一次', icon: '🕐', cron: '0 * * * *' },
  { key: 'daily', label: '每天', desc: '每天 09:00 执行', icon: '📅', cron: '0 9 * * *' },
  { key: 'weekly', label: '每周', desc: '每周一 09:00 执行', icon: '🗓️', cron: '0 9 * * 1' },
  { key: 'custom', label: '自定义', desc: '使用 Cron 表达式', icon: '⚙️' },
]

export default function AutomationView() {
  const t = useT()
  const { automations, setAutomations, setError, setView, setCurrentSession } = useAppStore()
  const [activeTab, setActiveTab] = useState<TabKey>('configured')
  const [showCreate, setShowCreate] = useState(false)
  const [editingTask, setEditingTask] = useState<AutomationTask | null>(null)
  const [_runs, setRuns] = useState<AutomationRunRecord[]>([])

  // ===== 新建任务表单状态 =====
  const [form, setForm] = useState({
    name: '',
    description: '',
    prompt: '',
    frequency: 'manual' as 'manual' | 'hourly' | 'daily' | 'weekly' | 'custom',
    cron: '',
    event: ''
  })

  const loadAutomations = async () => {
    try {
      const tasks = await window.aela.automation.list()
      setAutomations(tasks)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(t('automation.error.load', { err: msg }))
    }
  }

  useEffect(() => {
    loadAutomations()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRuns = async (taskId: string) => {
    try {
      const list = await window.aela.automation.runs(taskId, 20)
      setRuns(list)
    } catch (err) {
      console.error(err)
    }
  }

  // 根据频率选项构建 trigger
  const buildTrigger = (): AutomationTrigger => {
    switch (form.frequency) {
      case 'manual':
        return { type: 'manual' }
      case 'hourly':
        return { type: 'schedule', cron: '0 * * * *' }
      case 'daily':
        return { type: 'schedule', cron: '0 9 * * *' }
      case 'weekly':
        return { type: 'schedule', cron: '0 9 * * 1' }
      case 'custom':
        return { type: 'schedule', cron: form.cron || '0 9 * * *' }
      default:
        return { type: 'manual' }
    }
  }

  // ===== 创建/更新任务 =====
  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError(t('automation.error.nameRequired'))
      return
    }
    if (!form.prompt.trim()) {
      setError(t('automation.error.promptRequired'))
      return
    }
    if (form.frequency === 'custom' && !form.cron.trim()) {
      setError(t('automation.error.cronRequired'))
      return
    }

    try {
      if (editingTask) {
        await window.aela.automation.update(editingTask.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          prompt: form.prompt.trim(),
          trigger: buildTrigger()
        })
      } else {
        await window.aela.automation.create({
          name: form.name.trim(),
          description: form.description.trim(),
          prompt: form.prompt.trim(),
          trigger: buildTrigger()
        })
      }
      setShowCreate(false)
      setEditingTask(null)
      resetForm()
      loadAutomations()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(t('automation.error.save', { err: msg }))
    }
  }

  const resetForm = () => {
    setForm({ name: '', description: '', prompt: '', frequency: 'manual', cron: '', event: '' })
  }

  // ===== "在对话中创建" — 跳转到聊天界面并填入 prompt =====
  const handleCreateInChat = () => {
    setView('chat')
    setCurrentSession(null)
    // 通过 sessionStorage 传递 prompt 内容
    sessionStorage.setItem('aela-automation-prompt', form.prompt)
    setShowCreate(false)
  }

  // ===== 编辑任务 =====
  const handleEdit = (task: AutomationTask) => {
    setEditingTask(task)
    // 从 trigger 反推 frequency
    let freq: typeof form.frequency = 'manual'
    let cron = ''
    if (task.trigger.type === 'schedule') {
      const friendlyMap: Record<string, string> = {
        '0 * * * *': 'hourly',
        '0 9 * * *': 'daily',
        '0 9 * * 1': 'weekly',
      }
      freq = (friendlyMap[task.trigger.cron] || 'custom') as typeof form.frequency
      cron = task.trigger.cron
    }
    setForm({
      name: task.name,
      description: task.description || '',
      prompt: task.prompt,
      frequency: freq,
      cron,
      event: ''
    })
    setShowCreate(true)
  }

  // ===== 运行任务 =====
  const handleRun = async (id: string) => {
    try {
      const result = await window.aela.automation.run(id)
      if (result.success) {
        loadAutomations()
        loadRuns(id)
      } else {
        setError(t('automation.error.run', { err: result.error || '' }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(t('automation.error.run', { err: msg }))
    }
  }

  // ===== 切换暂停 =====
  const handleToggle = async (id: string) => {
    try {
      await window.aela.automation.toggle(id)
      loadAutomations()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(t('automation.error.op', { err: msg }))
    }
  }

  // ===== 删除 =====
  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm(t('automation.confirm.delete'), { variant: 'danger' })
    if (!confirmed) return
    try {
      await window.aela.automation.delete(id)
      loadAutomations()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(t('automation.error.delete', { err: msg }))
    }
  }

  const triggerLabel = (t: AutomationTrigger): string => {
    if (t.type === 'manual') return '手动'
    if (t.type === 'schedule') {
      // 友好显示常见 cron
      const friendly: Record<string, string> = {
        '0 * * * *': '每小时',
        '0 9 * * *': '每天 09:00',
        '0 9 * * 1': '每周一 09:00',
      }
      return friendly[t.cron] || `定时: ${t.cron}`
    }
    return `事件: ${t.event}`
  }

  const statusColors: Record<string, string> = {
    idle: 'text-text-muted',
    running: 'text-blue-400',
    success: 'text-green-400',
    failed: 'text-red-400',
    paused: 'text-yellow-400'
  }

  const statusLabels: Record<string, string> = {
    idle: '空闲',
    running: '运行中',
    success: '成功',
    failed: '失败',
    paused: '已暂停'
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary/50">
        <div>
          <h2 className="text-base font-semibold text-text-primary">自动化</h2>
          <p className="text-xs text-text-muted mt-0.5">
            配置和管理自动化任务，让 AELA 按计划执行工作流
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetForm(); setShowCreate(true); setEditingTask(null) }}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            新建任务
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 px-6 border-b border-border">
        {[
          { key: 'configured' as TabKey, label: '已配置' },
          { key: 'history' as TabKey, label: '执行历史' },
          { key: 'templates' as TabKey, label: '任务模板' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'text-accent border-accent'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'configured' && (
          <div>
            {/* ===== 创建/编辑表单 ===== */}
            {showCreate && (
              <div className="bg-bg-secondary border border-border rounded-xl p-6 mb-4">
                <h3 className="text-base font-semibold text-text-primary mb-5">
                  {editingTask ? '编辑自动化任务' : '新建自动化任务'}
                </h3>
                <div className="space-y-5">
                  {/* 任务名称 */}
                  <div>
                    <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                      <span className="text-accent">*</span> 任务名称
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="例如：每日代码审查"
                      className="w-full mt-2 bg-surface text-text-primary text-sm rounded-lg px-3 py-2.5 border border-border focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* 提示词 */}
                  <div>
                    <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                      <span className="text-accent">*</span> 提示词
                    </label>
                    <p className="text-xs text-text-muted mt-0.5">描述 AI 需要执行的任务内容</p>
                    <textarea
                      value={form.prompt}
                      onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                      placeholder="例如：审查 src/ 目录下最近 24 小时内修改的代码，检查代码质量、潜在 bug 和改进建议，生成审查报告。"
                      rows={5}
                      className="w-full mt-2 bg-surface text-text-primary text-sm rounded-lg px-3 py-2.5 border border-border focus:border-accent focus:outline-none resize-none"
                    />
                  </div>

                  {/* 执行频率 */}
                  <div>
                    <label className="text-sm font-medium text-text-primary">执行频率</label>
                    <p className="text-xs text-text-muted mt-0.5">选择任务的执行方式</p>
                    <div className="mt-2 grid grid-cols-5 gap-2">
                      {FREQUENCY_PRESETS.map(preset => (
                        <button
                          key={preset.key}
                          onClick={() => setForm({ ...form, frequency: preset.key as typeof form.frequency })}
                          className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border transition-all ${
                            form.frequency === preset.key
                              ? 'border-accent bg-accent/15 text-accent-light'
                              : 'border-border text-text-secondary hover:border-accent/40 hover:bg-surface-hover'
                          }`}
                        >
                          <span className="text-xl">{preset.icon}</span>
                          <span className="text-xs font-medium">{preset.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* 自定义 Cron 输入 */}
                    {form.frequency === 'custom' && (
                      <div className="mt-3">
                        <input
                          type="text"
                          value={form.cron}
                          onChange={(e) => setForm({ ...form, cron: e.target.value })}
                          placeholder="Cron 表达式，如 0 9 * * 1-5（工作日每天9点）"
                          className="w-full bg-surface text-text-primary text-sm rounded-lg px-3 py-2.5 border border-border focus:border-accent focus:outline-none font-mono"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[
                            { label: '每30分钟', cron: '*/30 * * * *' },
                            { label: '每天 09:00', cron: '0 9 * * *' },
                            { label: '工作日 09:00', cron: '0 9 * * 1-5' },
                            { label: '每周一 09:00', cron: '0 9 * * 1' },
                            { label: '每月1号 09:00', cron: '0 9 1 * *' },
                          ].map(example => (
                            <button
                              key={example.cron}
                              onClick={() => setForm({ ...form, cron: example.cron })}
                              className="text-[11px] px-2 py-1 bg-surface border border-border rounded text-text-muted hover:border-accent/40 hover:text-accent transition-colors"
                            >
                              {example.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 当前频率说明 */}
                    <p className="mt-2 text-xs text-text-muted">
                      {(() => {
                        const preset = FREQUENCY_PRESETS.find(p => p.key === form.frequency)
                        return preset ? `💡 ${preset.desc}` : ''
                      })()}
                    </p>
                  </div>

                  {/* 描述（可选） */}
                  <div>
                    <label className="text-sm font-medium text-text-primary">描述（可选）</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="简要说明此任务的作用"
                      className="w-full mt-2 bg-surface text-text-primary text-sm rounded-lg px-3 py-2.5 border border-border focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <button
                      onClick={handleCreate}
                      className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {editingTask ? '保存修改' : '保存任务'}
                    </button>
                    <button
                      onClick={handleCreateInChat}
                      className="px-4 py-2.5 bg-surface hover:bg-surface-hover text-text-secondary rounded-lg text-sm border border-border transition-colors"
                    >
                      在对话中试运行
                    </button>
                    <button
                      onClick={() => { setShowCreate(false); resetForm() }}
                      className="px-4 py-2.5 text-text-muted hover:text-text-primary rounded-lg text-sm transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== 任务列表 ===== */}
            {automations.length === 0 && !showCreate ? (
              <div className="flex flex-col items-center justify-center h-full text-text-muted">
                <div className="w-16 h-16 rounded-full bg-bg-secondary border border-border flex items-center justify-center mb-4">
                  <span className="text-2xl text-text-muted">⏰</span>
                </div>
                <p className="text-sm mb-1">尚未配置自动化任务</p>
                <p className="text-xs text-text-muted mb-4">创建自动化任务，让 AELA 按计划自动执行</p>
                <button
                  onClick={() => { resetForm(); setShowCreate(true) }}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
                >
                  + 创建第一个任务
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {automations.map(task => (
                  <div
                    key={task.id}
                    className="bg-bg-secondary border border-border rounded-xl p-4 hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-text-primary">{task.name}</h3>
                          <span className={`text-[10px] ${statusColors[task.status]}`}>
                            ● {statusLabels[task.status]}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-text-secondary mb-2">{task.description}</p>
                        )}
                        {/* Prompt 预览 */}
                        <p className="text-xs text-text-muted line-clamp-1 mb-2 font-mono bg-surface/50 px-2 py-1 rounded">
                          {task.prompt}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-text-muted">
                          <span className="flex items-center gap-1">
                            🔄 {triggerLabel(task.trigger)}
                          </span>
                          <span>·</span>
                          <span>运行 {task.runCount} 次</span>
                          {task.lastRunAt && (
                            <>
                              <span>·</span>
                              <span>上次: {new Date(task.lastRunAt).toLocaleString('zh-CN')}</span>
                            </>
                          )}
                        </div>
                        {task.lastError && (
                          <div className="mt-2 text-xs text-red-400 bg-red-400/10 px-2 py-1 rounded">
                            错误: {task.lastError}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-3">
                        <button
                          onClick={() => handleRun(task.id)}
                          disabled={task.status === 'running'}
                          className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          ▶ 运行
                        </button>
                        <button
                          onClick={() => handleEdit(task)}
                          className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text-primary rounded-lg text-xs border border-border transition-colors"
                          title="编辑"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleToggle(task.id)}
                          className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text-primary rounded-lg text-xs border border-border transition-colors"
                          title={task.status === 'paused' ? '恢复' : '暂停'}
                        >
                          {task.status === 'paused' ? '▶' : '⏸'}
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="px-3 py-1.5 bg-surface hover:bg-red-500/20 text-text-muted hover:text-red-400 rounded-lg text-xs border border-border transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {automations.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-8">尚无执行记录</p>
            ) : (
              automations.map(task => (
                <HistorySection
                  key={task.id}
                  task={task}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { icon: '🔍', name: '每日代码审查', desc: '检查代码质量和潜在问题', prompt: '审查 src/ 目录下最近 24 小时内修改的代码，检查代码质量、潜在 bug 和改进建议，生成审查报告。', frequency: 'daily' as const },
              { icon: '📝', name: '生成提交信息', desc: '根据 git diff 生成 commit message', prompt: '分析当前工作区的 git diff，生成规范的 commit message，遵循 Conventional Commits 格式。', frequency: 'manual' as const },
              { icon: '🧪', name: '生成单元测试', desc: '为指定代码生成测试用例', prompt: '为 src/ 目录下的核心模块生成单元测试，确保覆盖主要功能和边界条件。', frequency: 'manual' as const },
              { icon: '📚', name: '更新文档', desc: '同步代码变更到 API 文档', prompt: '扫描代码变更，更新对应的 API 文档和 README，确保文档与代码同步。', frequency: 'weekly' as const },
              { icon: '🔧', name: '依赖检查', desc: '检查依赖更新和安全漏洞', prompt: '检查 package.json 中的依赖是否有新版本，是否有已知安全漏洞，生成升级建议。', frequency: 'weekly' as const },
              { icon: '📊', name: '项目周报', desc: '每周生成本周开发进展报告', prompt: '根据本周的 git 提交记录，生成项目周报，包括完成的功能、修复的问题和下周计划。', frequency: 'weekly' as const },
            ].map(t => (
              <div
                key={t.name}
                className="bg-bg-secondary border border-border rounded-xl p-4 hover:border-accent/30 cursor-pointer transition-colors"
                onClick={() => {
                  setForm({ ...form, name: t.name, description: t.desc, prompt: t.prompt, frequency: t.frequency })
                  setShowCreate(true)
                  setActiveTab('configured')
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{t.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-text-primary mb-1">{t.name}</h3>
                    <p className="text-xs text-text-muted mb-2">{t.desc}</p>
                    <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">
                      {FREQUENCY_PRESETS.find(p => p.key === t.frequency)?.label || '手动'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// 执行历史子组件
function HistorySection({ task }: { task: AutomationTask }) {
  const [taskRuns, setTaskRuns] = useState<AutomationRunRecord[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (expanded) {
      window.aela?.automation?.runs?.(task.id, 20).then(setTaskRuns).catch((err) => logError('automation.runs', err))
    }
  }, [expanded, task.id])

  return (
    <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-4 py-3 cursor-pointer hover:bg-surface-hover flex items-center justify-between"
      >
        <div>
          <h3 className="text-sm font-medium text-text-primary">{task.name}</h3>
          <p className="text-[11px] text-text-muted">运行 {task.runCount} 次</p>
        </div>
        <span className="text-text-muted">{expanded ? '▾' : '▸'}</span>
      </div>
      {expanded && (
        <div className="border-t border-border p-3 space-y-2">
          {taskRuns.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-3">暂无记录</p>
          ) : (
            taskRuns.map(run => (
              <div
                key={run.id}
                className={`p-2 rounded-lg text-xs ${
                  run.success ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={run.success ? 'text-green-400' : 'text-red-400'}>
                    {run.success ? '✓ 成功' : '✗ 失败'}
                  </span>
                  <span className="text-text-muted">
                    {new Date(run.startedAt).toLocaleString('zh-CN')} · {run.duration}ms
                  </span>
                </div>
                {run.error && (
                  <p className="text-red-400 mt-1">错误: {run.error}</p>
                )}
                {run.output && (
                  <pre className="mt-1 text-text-secondary whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {run.output.slice(0, 500)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
