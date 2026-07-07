import { useEffect, useState } from 'react'
import type { ModelConfig } from '@shared/types'

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI (兼容协议)', hint: '支持 GPT / DeepSeek / Qwen / GLM 等' },
  { value: 'anthropic', label: 'Anthropic Claude', hint: 'Claude 系列模型' },
  { value: 'ollama', label: 'Ollama (本地)', hint: '本地部署的开源模型' },
  { value: 'custom', label: '自定义 (OpenAI 兼容)', hint: '任何兼容 OpenAI API 的服务' },
]

const PRESETS = [
  { name: 'OpenAI GPT-4o', provider: 'openai', baseURL: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { name: 'DeepSeek Chat', provider: 'openai', baseURL: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '通义千问', provider: 'openai', baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '智谱 GLM-4', provider: 'openai', baseURL: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  { name: 'Claude Sonnet', provider: 'anthropic', baseURL: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514' },
  { name: 'Ollama 本地', provider: 'ollama', baseURL: 'http://localhost:11434', model: 'llama3' },
]

const INITIAL_FORM_STATE = {
  name: '',
  provider: 'openai',
  apiKey: '',
  baseURL: '',
  model: '',
  temperature: 0,
  maxTokens: 0,
}

export default function OnboardingStepModel() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [formData, setFormData] = useState({ ...INITIAL_FORM_STATE })
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const list = await window.aela.model.list()
      setModels(list)
    } catch {
      // 静默处理
    }
  }

  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    setFormData({
      name: preset.name,
      provider: preset.provider,
      apiKey: '',
      baseURL: preset.baseURL,
      model: preset.model,
      temperature: 0,
      maxTokens: 0,
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.apiKey || !formData.model) {
      setStatus('请填写名称、API Key 和模型名称')
      return
    }
    try {
      const payload = {
        ...formData,
        maxTokens: formData.maxTokens > 0 ? formData.maxTokens : undefined,
        temperature: formData.temperature > 0 ? formData.temperature : undefined,
      }
      const newModel = await window.aela.model.add(payload)
      if (models.length === 0) {
        await window.aela.model.setDefault(newModel.id)
      }
      setShowForm(false)
      setStatus('✓ 模型添加成功')
      loadModels()
    } catch (err: unknown) {
      setStatus(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleTest = async (model: ModelConfig) => {
    setTesting(model.id)
    try {
      const result = await window.aela.model.test(model)
      if (result.success) {
        setStatus(`✓ 测试通过: ${result.message}`)
      } else {
        setStatus(`✗ 测试失败: ${result.message}`)
      }
    } catch (err: unknown) {
      setStatus(`✗ 测试失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">配置 AI 模型</h2>
        <p className="text-sm text-text-muted mt-1">
          添加至少一个 AI 模型以开始使用。您可以稍后通过设置页面添加更多模型。
        </p>
      </div>

      {status && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          status.startsWith('✓')
            ? 'bg-green-900/20 text-green-400 border border-green-500/30'
            : 'bg-amber-900/20 text-amber-400 border border-amber-500/30'
        }`}>
          {status}
        </div>
      )}

      {/* 已配置模型列表 */}
      {models.length > 0 && !showForm && (
        <div className="mb-6 space-y-3">
          {models.map((model) => (
            <div key={model.id} className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl">
              <div>
                <div className="text-sm font-medium text-text-primary">{model.name}</div>
                <div className="text-xs text-text-muted font-mono">{model.provider} · {model.model}</div>
              </div>
              <button
                onClick={() => handleTest(model)}
                disabled={testing === model.id}
                className="text-xs px-3 py-1.5 bg-surface-hover hover:bg-surface-active rounded-lg text-text-secondary disabled:opacity-50"
              >
                {testing === model.id ? '测试中...' : '测试'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 预设快捷配置 */}
      {!showForm && (
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
          <button
            onClick={() => { setShowForm(true); setFormData({ ...INITIAL_FORM_STATE }) }}
            className="mt-3 text-sm text-accent-light hover:text-accent transition-colors"
          >
            + 手动配置
          </button>
        </div>
      )}

      {/* 配置表单 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-text-primary">添加模型</h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-text-muted hover:text-text-secondary text-sm"
            >
              ✕ 取消
            </button>
          </div>

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
          </div>

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

          <button
            type="submit"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
          >
            添加模型
          </button>
        </form>
      )}
    </div>
  )
}
