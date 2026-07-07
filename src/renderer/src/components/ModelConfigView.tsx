import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/app'
import { dialog } from '../stores/dialog'
import type { ModelConfig } from '@shared/types'
import { logError } from '../lib/logger'

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (兼容协议)', hint: '支持 GPT / DeepSeek / Qwen / GLM 等' },
  { value: 'anthropic', label: 'Anthropic Claude', hint: 'Claude 系列模型' },
  { value: 'ollama', label: 'Ollama (本地)', hint: '本地部署的开源模型' },
  { value: 'custom', label: '自定义 (OpenAI 兼容)', hint: '任何兼容 OpenAI API 的服务' }
]

const PRESETS = [
  { name: 'OpenAI GPT-4o', provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { name: 'DeepSeek Chat', provider: 'openai', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '通义千问', provider: 'openai', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '智谱 GLM-4', provider: 'openai', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  { name: 'Claude Sonnet', provider: 'anthropic', baseURL: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  { name: 'Ollama 本地', provider: 'ollama', baseURL: 'http://localhost:11434', model: 'llama3' },
]

export default function ModelConfigView() {
  const { currentModelConfig, setCurrentModelConfig, setError, setModelList } = useAppStore()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  // OS Keyring 是否可用；不可用时 API Key 不会加密落盘
  const [keyringInsecure, setKeyringInsecure] = useState(false)

  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai',
    apiKey: '',
    baseURL: '',
    model: '',
    temperature: 0,
    maxTokens: 0
  })

  const loadModels = async () => {
    try {
      const list = await window.aela.model.list()
      setModels(list)
      // 同步到全局 store，供聊天页面下拉菜单使用
      setModelList(list)
      if (!currentModelConfig && list.length > 0) {
        const defaultModel = list.find(m => m.isDefault) || list[0]
        setCurrentModelConfig(defaultModel)
      }
    } catch (err: unknown) {
      setError(`加载模型列表失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  useEffect(() => {
    loadModels()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 查询当前系统是否启用了 OS 密钥链（Keychain / DPAPI / libsecret）
  useEffect(() => {
    window.aela.config.isApiKeyStorageSecure()
      .then((secure) => setKeyringInsecure(!secure))
      .catch((err) => logError('modelConfig.keyring', err))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreset = (preset: typeof PRESETS[0]) => {
    setFormData({
      name: preset.name,
      provider: preset.provider,
      apiKey: '',
      baseURL: preset.baseURL,
      model: preset.model,
      temperature: 0,
      maxTokens: 0
    })
    setShowForm(true)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.apiKey || !formData.model) {
      setError('请填写名称、API Key 和模型名称')
      return
    }

    try {
      // maxTokens=0 表示使用模型默认值，后端要求 positive，传 undefined 让 Zod 跳过验证
      const payload = {
        ...formData,
        maxTokens: formData.maxTokens > 0 ? formData.maxTokens : undefined,
        temperature: formData.temperature > 0 ? formData.temperature : undefined
      }
      if (editingId) {
        await window.aela.model.update(editingId, payload)
      } else {
        const newModel = await window.aela.model.add(payload)
        if (models.length === 0) {
          await window.aela.model.setDefault(newModel.id)
          setCurrentModelConfig(newModel)
        }
      }
      setShowForm(false)
      setEditingId(null)
      setFormData({ name: '', provider: 'openai', apiKey: '', baseURL: '', model: '', temperature: 0, maxTokens: 0 })
      loadModels()
    } catch (err: unknown) {
      setError(`保存模型配置失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleEdit = (model: ModelConfig) => {
    setEditingId(model.id)
    setFormData({
      name: model.name,
      provider: model.provider,
      apiKey: model.apiKey,
      baseURL: model.baseURL,
      model: model.model,
      temperature: model.temperature || 0,
      maxTokens: model.maxTokens || 0
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm('确定删除这个模型配置吗？', { variant: 'danger' })
    if (!confirmed) return
    try {
      await window.aela.model.delete(id)
      if (currentModelConfig?.id === id) setCurrentModelConfig(null)
      loadModels()
    } catch (err: unknown) {
      setError(`删除失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      await window.aela.model.setDefault(id)
      const model = models.find(m => m.id === id)
      if (model) setCurrentModelConfig(model)
      loadModels()
    } catch (err: unknown) {
      setError(`设置默认模型失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleTest = async (model: ModelConfig) => {
    setTesting(model.id)
    try {
      const result = await window.aela.model.test(model)
      if (result.success) {
        await dialog.alert(`✅ ${result.message}`)
      } else {
        await dialog.alert(`❌ ${result.message}`, { variant: 'warning' })
      }
    } catch (err: unknown) {
      await dialog.alert(`❌ 测试失败: ${err instanceof Error ? err.message : String(err)}`, { variant: 'warning' })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">模型配置</h2>
            <p className="text-sm text-text-muted mt-1">配置 LLM 模型，支持多模型切换</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setFormData({ name: '', provider: 'openai', apiKey: '', baseURL: '', model: '', temperature: 0, maxTokens: 0 }) }}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
          >
            + 添加模型
          </button>
        </div>

        {/* 预设快捷配置 */}
        {!showForm && models.length === 0 && (
          <div className="mb-6">
            <h3 className="text-sm text-text-secondary mb-3">快捷预设</h3>
            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => handlePreset(preset)}
                  className="text-left p-3 bg-surface hover:bg-surface-hover border border-border rounded-lg transition-colors"
                >
                  <div className="text-sm font-medium text-text-primary">{preset.name}</div>
                  <div className="text-xs text-text-muted mt-1">{preset.model}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 添加/编辑表单 */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 bg-surface border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-medium text-text-primary">
              {editingId ? '编辑模型' : '添加模型'}
            </h3>

            {/* 名称 */}
            <div>
              <label className="block text-xs text-text-muted mb-1">名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如: 我的 GPT-4o"
                className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
              />
            </div>

            {/* Provider 选择 */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Provider 类型 *</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">
                {PROVIDER_OPTIONS.find(o => o.value === formData.provider)?.hint}
              </p>
            </div>

            {/* API Key 安全告警：仅在 OS Keyring 不可用时显示 */}
            {keyringInsecure && (
              <div className="mb-4 p-3 rounded-lg border border-amber-500/50 bg-amber-900/20 text-amber-200 text-xs leading-relaxed">
                ⚠️ 当前系统未启用 OS 密钥链（Keychain / DPAPI / libsecret），API Key <b>不会被加密保存</b>，
                仅临时保存在内存中，重启应用后需要重新填写。建议在支持密钥链的操作系统中运行以获得安全的凭据存储。
              </div>
            )}

            {/* API Key */}
            <div>
              <label className="block text-xs text-text-muted mb-1">API Key *</label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none font-mono"
              />
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-xs text-text-muted mb-1">Base URL</label>
              <input
                type="text"
                value={formData.baseURL}
                onChange={(e) => setFormData({ ...formData, baseURL: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none font-mono"
              />
            </div>

            {/* 模型名称 */}
            <div>
              <label className="block text-xs text-text-muted mb-1">模型名称 *</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="gpt-4o / claude-sonnet-4-20250514 / deepseek-chat"
                className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none font-mono"
              />
            </div>

            {/* Temperature & MaxTokens */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Max Tokens (0=默认)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* 按钮组 */}
            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium">
                {editingId ? '保存' : '添加'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null) }}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-active text-text-secondary rounded-lg text-sm"
              >
                取消
              </button>
            </div>
          </form>
        )}

        {/* 模型列表 */}
        <div className="space-y-3">
          {models.map((model) => {
            const isCurrent = currentModelConfig?.id === model.id
            return (
              <div
                key={model.id}
                className={`p-4 rounded-xl border transition-colors ${
                  isCurrent
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-surface hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{model.name}</span>
                      {isCurrent && (
                        <span className="text-xs bg-accent/20 text-accent-light px-2 py-0.5 rounded-full">
                          当前使用
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-1 font-mono">
                      {model.provider} · {model.model}
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      {model.baseURL}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleTest(model)}
                      disabled={testing === model.id}
                      className="text-xs px-3 py-1.5 bg-surface-hover hover:bg-surface-active rounded-lg text-text-secondary disabled:opacity-50"
                    >
                      {testing === model.id ? '测试中...' : '测试'}
                    </button>
                    <button
                      onClick={() => handleEdit(model)}
                      className="text-xs px-3 py-1.5 bg-surface-hover hover:bg-surface-active rounded-lg text-text-secondary"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(model.id)}
                      className="text-xs px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-red-400"
                    >
                      删除
                    </button>
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    onClick={() => handleSetDefault(model.id)}
                    className="mt-2 text-xs text-accent-light hover:text-accent"
                  >
                    设为当前模型 →
                  </button>
                )}
              </div>
            )
          })}

          {models.length === 0 && !showForm && (
            <div className="text-center text-text-muted py-12">
              <div className="text-4xl mb-3">🤖</div>
              <p>暂未配置任何模型</p>
              <p className="text-xs mt-1">点击&ldquo;添加模型&rdquo;或选择上方预设快捷配置</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
