// [升级 4] 提示词 Few-Shot 权重优化
// 管理带权重的 Few-Shot 示例，支持正/负反馈调节权重
import { useState, useEffect, useCallback } from 'react'
import type { FewShotExampleWithWeight, FewShotWeightConfig } from '@shared/types'

const DEFAULT_WEIGHT_CONFIG: FewShotWeightConfig = {
  initialWeight: 1.0,
  positiveBoost: 0.1,
  negativePenalty: 0.15,
  minWeight: 0.1,
  maxWeight: 5.0,
  decayFactor: 0.95,
}

export default function FewShotWeightView() {
  const [templateName, setTemplateName] = useState('')
  const [examples, setExamples] = useState<FewShotExampleWithWeight[]>([])
  const [config, setConfig] = useState<FewShotWeightConfig>(DEFAULT_WEIGHT_CONFIG)
  const [loading, setLoading] = useState(false)

  // 新增表单
  const [newInput, setNewInput] = useState('')
  const [newOutput, setNewOutput] = useState('')

  const loadExamples = useCallback(async () => {
    if (!templateName.trim()) return
    setLoading(true)
    try {
      const list = await window.aela.fewShotWeight.list(templateName.trim())
      setExamples(list)
    } catch (err) {
      console.error('Failed to load examples:', err)
      setExamples([])
    } finally {
      setLoading(false)
    }
  }, [templateName])

  useEffect(() => {
    if (templateName.trim()) {
      loadExamples()
    }
  }, [loadExamples]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdd = async () => {
    if (!templateName.trim() || !newInput.trim() || !newOutput.trim()) return
    try {
      await window.aela.fewShotWeight.add(templateName.trim(), newInput, newOutput)
      setNewInput('')
      setNewOutput('')
      loadExamples()
    } catch (err) {
      console.error('Add failed:', err)
    }
  }

  const handleFeedback = async (input: string, positive: boolean) => {
    try {
      await window.aela.fewShotWeight.feedback(templateName.trim(), input, positive)
      loadExamples()
    } catch (err) {
      console.error('Feedback failed:', err)
    }
  }

  const handleSaveConfig = async () => {
    try {
      await window.aela.fewShotWeight.setConfig(templateName.trim(), config)
    } catch (err) {
      console.error('Save config failed:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">⚖️</span>
          <h1 className="text-xl font-bold text-text-primary">Few-Shot 权重优化</h1>
        </div>
        <p className="text-sm text-text-muted">
          基于正/负反馈动态调节示例权重，优化提示词质量
        </p>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-5xl">
        {/* 模板名输入 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="输入模板名称（如 code-review、test-gen）..."
            className="flex-1 bg-surface text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={loadExamples}
            disabled={!templateName.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium"
          >
            加载
          </button>
        </div>

        {/* 权重配置 */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">权重调节参数</h3>
          <div className="grid grid-cols-3 gap-3">
            <ConfigInput
              label="初始权重"
              value={config.initialWeight}
              onChange={(v) => setConfig({ ...config, initialWeight: v })}
              step={0.1}
            />
            <ConfigInput
              label="正向增益"
              value={config.positiveBoost}
              onChange={(v) => setConfig({ ...config, positiveBoost: v })}
              step={0.05}
            />
            <ConfigInput
              label="负向惩罚"
              value={config.negativePenalty}
              onChange={(v) => setConfig({ ...config, negativePenalty: v })}
              step={0.05}
            />
            <ConfigInput
              label="最小权重"
              value={config.minWeight}
              onChange={(v) => setConfig({ ...config, minWeight: v })}
              step={0.1}
            />
            <ConfigInput
              label="最大权重"
              value={config.maxWeight}
              onChange={(v) => setConfig({ ...config, maxWeight: v })}
              step={0.5}
            />
            <ConfigInput
              label="衰减因子"
              value={config.decayFactor}
              onChange={(v) => setConfig({ ...config, decayFactor: v })}
              step={0.01}
            />
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={!templateName.trim()}
            className="mt-3 px-4 py-1.5 rounded-md bg-surface border border-border hover:bg-surface-hover text-text-secondary text-xs disabled:opacity-40"
          >
            保存配置
          </button>
        </div>

        {/* 新增示例 */}
        <div className="bg-surface border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">添加新示例</h3>
          <div className="space-y-2">
            <input
              type="text"
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              placeholder="输入内容..."
              className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-blue-500 focus:outline-none"
            />
            <textarea
              value={newOutput}
              onChange={(e) => setNewOutput(e.target.value)}
              placeholder="期望输出..."
              rows={3}
              className="w-full bg-bg-primary text-text-primary text-sm rounded-lg px-3 py-2 border border-border focus:border-blue-500 focus:outline-none resize-y"
            />
            <button
              onClick={handleAdd}
              disabled={!newInput.trim() || !newOutput.trim()}
              className="px-4 py-1.5 rounded-md bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-xs font-medium"
            >
              + 添加示例
            </button>
          </div>
        </div>

        {/* 示例列表 */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text-secondary">
            已有示例 {examples.length > 0 && `(${examples.length})`}
          </h3>
          {loading ? (
            <div className="text-center text-text-muted text-sm py-8">加载中...</div>
          ) : examples.length === 0 ? (
            <div className="text-center text-text-muted text-sm py-8 bg-surface border border-border rounded-lg">
              {templateName ? '暂无示例，添加第一个吧' : '请先输入模板名称'}
            </div>
          ) : (
            examples.map((ex, i) => (
              <div key={i} className="bg-surface border border-border rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div>
                      <span className="text-[10px] text-text-muted">输入:</span>
                      <p className="text-sm text-text-primary">{ex.input}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-text-muted">输出:</span>
                      <p className="text-xs text-text-secondary whitespace-pre-wrap">{ex.output}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-center">
                      <div className={`text-lg font-bold ${
                        ex.weight > 2 ? 'text-green-400' :
                        ex.weight < 0.5 ? 'text-red-400' : 'text-blue-400'
                      }`}>
                        {ex.weight.toFixed(2)}
                      </div>
                      <span className="text-[9px] text-text-muted">权重</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleFeedback(ex.input, true)}
                        className="w-7 h-7 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 text-sm"
                        title="正面反馈 (增加权重)"
                      >
                        👍
                      </button>
                      <button
                        onClick={() => handleFeedback(ex.input, false)}
                        className="w-7 h-7 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm"
                        title="负面反馈 (降低权重)"
                      >
                        👎
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 pt-2 border-t border-border/50 text-[10px] text-text-muted">
                  <span>👍 {ex.positiveFeedback}</span>
                  <span>👎 {ex.negativeFeedback}</span>
                  <span>使用 {ex.useCount} 次</span>
                  {ex.lastUsedAt && (
                    <span>最后使用: {new Date(ex.lastUsedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ConfigInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        step={step}
        className="bg-bg-primary text-text-primary text-sm rounded px-2 py-1 border border-border focus:border-blue-500 focus:outline-none"
      />
    </label>
  )
}
