import { useState, useEffect, useCallback } from 'react'
import type { HookRule, HookEventPoint, HookActionType, HookConfigSummary } from '@shared/types'

const HOOK_POINTS: Array<{ point: HookEventPoint; label: string; description: string; color: string }> = [
  { point: 'before_run', label: '运行前', description: 'Agent 开始执行前', color: 'bg-blue-900/40 text-blue-400' },
  { point: 'after_run', label: '运行后', description: 'Agent 执行完成后', color: 'bg-purple-900/40 text-purple-400' },
  { point: 'before_turn', label: '轮次前', description: '每轮 ReAct 循环开始前', color: 'bg-cyan-900/40 text-cyan-400' },
  { point: 'after_turn', label: '轮次后', description: '每轮 ReAct 循环结束后', color: 'bg-teal-900/40 text-teal-400' },
  { point: 'before_llm', label: 'LLM 调用前', description: '调用 LLM API 前', color: 'bg-indigo-900/40 text-indigo-400' },
  { point: 'after_llm', label: 'LLM 调用后', description: 'LLM API 返回后', color: 'bg-violet-900/40 text-violet-400' },
  { point: 'before_tool', label: '工具调用前', description: '工具执行前（可阻止）', color: 'bg-orange-900/40 text-orange-400' },
  { point: 'after_tool', label: '工具调用后', description: '工具执行完成后', color: 'bg-green-900/40 text-green-400' },
  { point: 'on_error', label: '错误时', description: 'Agent 发生错误时', color: 'bg-red-900/40 text-red-400' },
  { point: 'on_complete', label: '完成时', description: 'Agent 任务完成时', color: 'bg-emerald-900/40 text-emerald-400' },
]

const ACTION_TYPES: Array<{ type: HookActionType; label: string; description: string }> = [
  { type: 'shell', label: '执行命令', description: '执行 Shell 命令' },
  { type: 'block', label: '阻止操作', description: '阻止当前操作继续执行' },
  { type: 'modify_input', label: '修改输入', description: '替换当前输入内容' },
  { type: 'notify', label: '通知', description: '记录通知消息' },
]

export default function HooksView() {
  const [rules, setRules] = useState<HookRule[]>([])
  const [summary, setSummary] = useState<HookConfigSummary | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<HookRule | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        window.aela.hookConfig.list(),
        window.aela.hookConfig.summary(),
      ])
      setRules(list)
      setSummary(sum)
    } catch (err) {
      console.error('Failed to load hooks:', err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggle = useCallback(async (id: string) => {
    await window.aela.hookConfig.toggle(id)
    loadData()
  }, [loadData])

  const handleDelete = useCallback(async (id: string) => {
    await window.aela.hookConfig.delete(id)
    loadData()
  }, [loadData])

  const handleSave = useCallback(async (rule: Partial<HookRule>) => {
    if (editingRule) {
      await window.aela.hookConfig.update(editingRule.id, rule)
    } else {
      await window.aela.hookConfig.add(rule as Omit<HookRule, 'id' | 'createdAt' | 'updatedAt'>)
    }
    setShowEditor(false)
    setEditingRule(null)
    loadData()
  }, [editingRule, loadData])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Hooks 配置</h2>
            <p className="text-sm text-text-muted mt-1">
              在 Agent 生命周期的 10 个 Hook 点注入自定义规则
            </p>
          </div>
          <button
            onClick={() => { setEditingRule(null); setShowEditor(true) }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            ＋ 新建规则
          </button>
        </div>

        {/* Hook 点概览 */}
        <div className="grid grid-cols-5 gap-2">
          {HOOK_POINTS.map(hp => {
            const count = summary?.rulesByEvent?.[hp.point] || 0
            return (
              <div
                key={hp.point}
                className={`rounded-lg border border-border p-2 text-center ${count > 0 ? 'bg-surface' : 'bg-bg-secondary/30'}`}
                title={hp.description}
              >
                <div className={`text-[10px] px-1.5 py-0.5 rounded inline-block ${hp.color}`}>
                  {hp.label}
                </div>
                <div className="text-lg font-bold text-text-primary mt-1">{count}</div>
              </div>
            )
          })}
        </div>

        {/* 规则列表 */}
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <div className="text-4xl mb-3">🪝</div>
              <p className="text-sm">暂无 Hook 规则</p>
              <p className="text-xs mt-1">点击「新建规则」创建你的第一个 Hook</p>
            </div>
          ) : (
            rules.map(rule => (
              <div
                key={rule.id}
                className={`rounded-lg border p-4 transition-colors ${
                  rule.enabled
                    ? 'border-border bg-surface'
                    : 'border-border/50 bg-bg-secondary/20 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggle(rule.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors ${
                        rule.enabled ? 'bg-green-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          rule.enabled ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">{rule.name}</h3>
                      {rule.description && (
                        <p className="text-xs text-text-muted mt-0.5">{rule.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded ${
                      HOOK_POINTS.find(h => h.point === rule.eventPoint)?.color || ''
                    }`}>
                      {HOOK_POINTS.find(h => h.point === rule.eventPoint)?.label || rule.eventPoint}
                    </span>
                    <button
                      onClick={() => { setEditingRule(rule); setShowEditor(true) }}
                      className="text-text-muted hover:text-text-primary text-xs px-2 py-1 rounded hover:bg-surface-hover"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-text-muted hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-surface-hover"
                    >
                      删除
                    </button>
                  </div>
                </div>

                {/* 条件和动作 */}
                <div className="mt-3 flex items-center gap-4 text-xs">
                  {rule.condition && (
                    <div className="text-text-muted">
                      <span className="text-text-muted">条件:</span>{' '}
                      <code className="text-text-secondary bg-bg-primary/50 px-1.5 py-0.5 rounded">{rule.condition}</code>
                    </div>
                  )}
                  <div className="text-text-muted">
                    <span className="text-text-muted">动作:</span>{' '}
                    {rule.actions.map((a, i) => (
                      <span key={i} className="ml-1 text-text-secondary">
                        {ACTION_TYPES.find(at => at.type === a.type)?.label || a.type}
                        {i < rule.actions.length - 1 && ','}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 最近执行记录 */}
        {summary && summary.recentExecutions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">最近执行</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {summary.recentExecutions.slice(0, 10).map((exec, i) => (
                <div
                  key={i}
                  className={`text-xs px-3 py-1.5 rounded border border-border/50 ${
                    exec.blocked ? 'bg-red-900/20' : exec.error ? 'bg-yellow-900/20' : 'bg-surface'
                  }`}
                >
                  <span className="text-text-secondary font-medium">{exec.ruleName}</span>
                  <span className="text-text-muted ml-2">
                    {exec.blocked ? '⛔ 已阻止' : exec.executed ? '✅ 已执行' : '⏭ 已跳过'}
                  </span>
                  <span className="text-text-muted ml-2">{exec.durationMs}ms</span>
                  {exec.output && (
                    <pre className="text-text-muted mt-1 whitespace-pre-wrap text-[10px] max-h-20 overflow-y-auto">
                      {exec.output.slice(0, 200)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 编辑器弹窗 */}
        {showEditor && (
          <HookEditor
            rule={editingRule}
            onSave={handleSave}
            onCancel={() => { setShowEditor(false); setEditingRule(null) }}
          />
        )}
      </div>
    </div>
  )
}

// ===== Hook 编辑器 =====
function HookEditor({
  rule,
  onSave,
  onCancel,
}: {
  rule: HookRule | null
  onSave: (rule: Partial<HookRule>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(rule?.name || '')
  const [description, setDescription] = useState(rule?.description || '')
  const [eventPoint, setEventPoint] = useState<HookEventPoint>(rule?.eventPoint || 'before_tool')
  const [condition, setCondition] = useState(rule?.condition || '')
  const [actions, setActions] = useState(rule?.actions || [{ type: 'notify' as HookActionType, message: '' }])
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  const handleAddAction = () => {
    setActions([...actions, { type: 'notify', message: '' }])
  }

  const handleRemoveAction = (idx: number) => {
    setActions(actions.filter((_, i) => i !== idx))
  }

  const handleActionChange = (idx: number, field: string, value: string) => {
    setActions(actions.map((a, i) => i === idx ? { ...a, [field]: value } : a))
  }

  const handleActionTypeChange = (idx: number, type: HookActionType) => {
    setActions(actions.map((a, i) => {
      if (i !== idx) return a
      const newAction: any = { type }
      if (type === 'shell') newAction.command = ''
      if (type === 'block' || type === 'notify') newAction.message = ''
      if (type === 'modify_input') newAction.modifyInput = ''
      return newAction
    }))
  }

  const handleSave = () => {
    onSave({
      name,
      description,
      eventPoint,
      condition,
      actions,
      enabled,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-bg-secondary border border-border rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-text-primary mb-4">
          {rule ? '编辑 Hook 规则' : '新建 Hook 规则'}
        </h3>

        <div className="space-y-4">
          {/* 名称 */}
          <div>
            <label className="text-xs text-text-muted block mb-1">规则名称</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：禁止删除文件"
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-blue-500 outline-none"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="text-xs text-text-muted block mb-1">描述（可选）</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="规则说明"
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-blue-500 outline-none"
            />
          </div>

          {/* Hook 点 */}
          <div>
            <label className="text-xs text-text-muted block mb-1">触发 Hook 点</label>
            <div className="grid grid-cols-5 gap-2">
              {HOOK_POINTS.map(hp => (
                <button
                  key={hp.point}
                  onClick={() => setEventPoint(hp.point)}
                  title={hp.description}
                  className={`px-2 py-1.5 rounded text-[10px] font-medium border transition-colors ${
                    eventPoint === hp.point
                      ? `${hp.color} border-current`
                      : 'bg-bg-primary border-border text-text-muted hover:text-text-primary'
                  }`}
                >
                  {hp.label}
                </button>
              ))}
            </div>
          </div>

          {/* 条件 */}
          <div>
            <label className="text-xs text-text-muted block mb-1">
              条件表达式（留空 = 总是触发）
            </label>
            <input
              value={condition}
              onChange={e => setCondition(e.target.value)}
              placeholder={"例如：toolName == 'execute_command'"}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary focus:border-blue-500 outline-none"
            />
            <p className="text-[10px] text-text-muted mt-1">
              {"支持：变量 == '值'、变量 contains '值'。变量：toolName, eventPoint, isError, toolResult, errorMessage"}
            </p>
          </div>

          {/* 动作 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-text-muted">动作</label>
              <button
                onClick={handleAddAction}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                ＋ 添加动作
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-bg-primary/50 rounded-lg p-2">
                  <select
                    value={action.type}
                    onChange={e => handleActionTypeChange(idx, e.target.value as HookActionType)}
                    className="bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary"
                  >
                    {ACTION_TYPES.map(at => (
                      <option key={at.type} value={at.type}>{at.label}</option>
                    ))}
                  </select>
                  {action.type === 'shell' && (
                    <input
                      value={action.command || ''}
                      onChange={e => handleActionChange(idx, 'command', e.target.value)}
                      placeholder="shell 命令"
                      className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-xs font-mono text-text-primary"
                    />
                  )}
                  {(action.type === 'block' || action.type === 'notify') && (
                    <input
                      value={action.message || ''}
                      onChange={e => handleActionChange(idx, 'message', e.target.value)}
                      placeholder="消息内容"
                      className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary"
                    />
                  )}
                  {action.type === 'modify_input' && (
                    <input
                      value={action.modifyInput || ''}
                      onChange={e => handleActionChange(idx, 'modifyInput', e.target.value)}
                      placeholder="替换后的输入"
                      className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary"
                    />
                  )}
                  <button
                    onClick={() => handleRemoveAction(idx)}
                    className="text-text-muted hover:text-red-400 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 启用开关 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm text-text-secondary">启用此规则</span>
          </label>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
