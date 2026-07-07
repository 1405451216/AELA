import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import type { CustomAgentConfig } from '@shared/types'

const AVAILABLE_TOOLS = [
  'read_file', 'write_file', 'list_directory', 'search_code',
  'execute_command', 'web_fetch', 'mcp_tool',
]

export default function AgentConfigView() {
  const { modelList } = useAppStore()
  const [configs, setConfigs] = useState<CustomAgentConfig[]>([])
  const [editing, setEditing] = useState<CustomAgentConfig | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const loadList = useCallback(async () => {
    try {
      const list = await window.aela.agentConfig.list()
      setConfigs(list)
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handleCreate = useCallback(async (config: Omit<CustomAgentConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    await window.aela.agentConfig.add(config)
    setIsCreating(false)
    await loadList()
  }, [loadList])

  const handleUpdate = useCallback(async (id: string, partial: Partial<CustomAgentConfig>) => {
    await window.aela.agentConfig.update(id, partial)
    setEditing(null)
    await loadList()
  }, [loadList])

  const handleDelete = useCallback(async (id: string) => {
    await window.aela.agentConfig.delete(id)
    await loadList()
  }, [loadList])

  if (isCreating) {
    return (
      <AgentEditor
        models={modelList}
        onSave={handleCreate}
        onCancel={() => setIsCreating(false)}
      />
    )
  }

  if (editing) {
    return (
      <AgentEditor
        models={modelList}
        initial={editing}
        onSave={(config) => handleUpdate(editing.id, config)}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/30">
        <span className="text-sm font-medium text-text-primary">🤖 Agent 配置</span>
        <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{configs.length} 个</span>
        <div className="flex-1" />
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 text-white"
        >
          ＋ 新建 Agent
        </button>
      </div>

      {/* Agent 卡片列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 max-w-4xl">
          {configs.map(c => (
            <div
              key={c.id}
              className="group bg-bg-secondary border border-border rounded-lg p-3 hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-text-primary">{c.name}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{c.description}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => setEditing(c)}
                    className="text-xs text-text-muted hover:text-text-primary px-1"
                    title="编辑"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-xs text-text-muted hover:text-red-400 px-1"
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 标签 */}
              <div className="flex flex-wrap gap-1 mb-2">
                {c.tags.map(t => (
                  <span key={t} className="text-[10px] bg-surface px-1.5 py-0.5 rounded text-text-secondary">{t}</span>
                ))}
              </div>

              {/* 参数 */}
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span>🌡 {c.temperature}</span>
                <span>🔄 {c.maxTurns} turns</span>
                <span>🛠 {c.tools.length || '全部'} 工具</span>
              </div>

              {/* System Prompt 预览 */}
              <div className="mt-2 text-[10px] text-text-muted line-clamp-2 font-mono bg-bg-primary/50 rounded p-1.5">
                {c.systemPrompt.substring(0, 100)}...
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AgentEditor({
  initial,
  models,
  onSave,
  onCancel,
}: {
  initial?: CustomAgentConfig
  models: Array<{ id: string; name: string }>
  onSave: (config: Omit<CustomAgentConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt || '')
  const [modelConfigId, setModelConfigId] = useState(initial?.modelConfigId || '')
  const [tools, setTools] = useState<string[]>(initial?.tools || [])
  const [maxTurns, setMaxTurns] = useState(initial?.maxTurns || 20)
  const [temperature, setTemperature] = useState(initial?.temperature || 0.3)
  const [tags, setTags] = useState<string[]>(initial?.tags || [])

  const toggleTool = (tool: string) => {
    setTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool])
  }

  const handleSave = () => {
    onSave({
      name,
      description,
      systemPrompt,
      modelConfigId,
      tools,
      maxTurns,
      temperature,
      tags,
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/30">
        <span className="text-sm font-medium text-text-primary">
          {initial ? '编辑 Agent' : '新建 Agent'}
        </span>
        <div className="flex-1" />
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border hover:bg-surface-hover text-text-secondary">
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || !systemPrompt.trim()}
          className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
        >
          保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
        {/* 名称 */}
        <div className="mb-4">
          <label className="text-xs text-text-secondary block mb-1">名称 *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="如：代码工程师"
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-blue-500 outline-none"
          />
        </div>

        {/* 描述 */}
        <div className="mb-4">
          <label className="text-xs text-text-secondary block mb-1">描述</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="简短描述 Agent 的职责"
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-blue-500 outline-none"
          />
        </div>

        {/* System Prompt */}
        <div className="mb-4">
          <label className="text-xs text-text-secondary block mb-1">System Prompt *</label>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="定义 Agent 的角色、能力和行为约束..."
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-blue-500 outline-none font-mono"
            rows={6}
          />
        </div>

        {/* 模型选择 */}
        <div className="mb-4">
          <label className="text-xs text-text-secondary block mb-1">默认模型</label>
          <select
            value={modelConfigId}
            onChange={e => setModelConfigId(e.target.value)}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-blue-500 outline-none"
          >
            <option value="">（使用全局默认）</option>
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* 工具选择 */}
        <div className="mb-4">
          <label className="text-xs text-text-secondary block mb-1">允许的工具（空=全部）</label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TOOLS.map(tool => (
              <button
                key={tool}
                onClick={() => toggleTool(tool)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                  tools.includes(tool)
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
                }`}
              >
                {tool}
              </button>
            ))}
          </div>
        </div>

        {/* 参数 */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Max Turns: {maxTurns}</label>
            <input
              type="range"
              min={1}
              max={50}
              value={maxTurns}
              onChange={e => setMaxTurns(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">Temperature: {temperature.toFixed(2)}</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={temperature}
              onChange={e => setTemperature(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* 标签 */}
        <div className="mb-4">
          <label className="text-xs text-text-secondary block mb-1">标签（逗号分隔）</label>
          <input
            value={tags.join(', ')}
            onChange={e => setTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            placeholder="如：code, engineering"
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-blue-500 outline-none"
          />
        </div>
      </div>
    </div>
  )
}
