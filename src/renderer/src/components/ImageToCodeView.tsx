import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import type {
  ImageToCodeResult,
  ImageAnalysis,
  CodeFramework,
  GeneratedCodeFile,
} from '@shared/types'

const FRAMEWORK_OPTIONS: Array<{ id: CodeFramework; label: string; icon: string }> = [
  { id: 'react', label: 'React', icon: '⚛️' },
  { id: 'vue', label: 'Vue 3', icon: '💚' },
  { id: 'html', label: 'HTML/CSS', icon: '📄' },
  { id: 'tailwind', label: 'Tailwind', icon: '🎨' },
  { id: 'svelte', label: 'Svelte', icon: '🔥' },
  { id: 'angular', label: 'Angular', icon: '🅰️' },
]

export default function ImageToCodeView() {
  const { modelList, currentWorkspace } = useAppStore()
  const [imagePath, setImagePath] = useState('')
  const [framework, setFramework] = useState<CodeFramework>('react')
  const [modelConfigId, setModelConfigId] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [componentName, setComponentName] = useState('GeneratedComponent')
  const [responsive, setResponsive] = useState(true)
  const [result, setResult] = useState<ImageToCodeResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [refineFeedback, setRefineFeedback] = useState('')
  const [refining, setRefining] = useState(false)
  const [activeFileIndex, setActiveFileIndex] = useState(0)

  useEffect(() => {
    if (modelList.length > 0 && !modelConfigId) {
      setModelConfigId(modelList[0].id)
    }
  }, [modelList, modelConfigId])

  const handleSelectImage = async () => {
    try {
      // 通过 preload 桥接调用 Electron 对话框（类型安全）
      type AelaFileApi = { openFileDialog?: () => Promise<string> }
      const aelaApi = (window as unknown as { aela?: AelaFileApi }).aela
      const openFile = aelaApi?.openFileDialog
      const path = openFile ? await openFile() : ''
      if (!path) {
        // Fallback: 使用 prompt
        const input = window.prompt('输入图片路径:')
        if (input) setImagePath(input)
        return
      }
      setImagePath(path)
    } catch {
      const input = window.prompt('输入图片路径:')
      if (input) setImagePath(input)
    }
  }

  const handleGenerate = async () => {
    if (!imagePath || !modelConfigId) return
    setLoading(true)
    setResult(null)
    setActiveFileIndex(0)
    try {
      const res = await window.aela.img2code.generate({
        imagePath,
        framework,
        modelConfigId,
        customPrompt: customPrompt || undefined,
        responsive,
        componentName,
      })
      setResult(res)
    } catch (err) {
      console.error('Image to code generation failed:', err)
      alert(`生成失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRefine = async () => {
    if (!result || !refineFeedback.trim() || !modelConfigId) return
    setRefining(true)
    try {
      const res = await window.aela.img2code.refine(result.id, refineFeedback, modelConfigId)
      setResult(res)
      setRefineFeedback('')
    } catch (err) {
      console.error('Refine failed:', err)
      alert(`优化失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRefining(false)
    }
  }

  const handleCopyCode = (file: GeneratedCodeFile) => {
    navigator.clipboard.writeText(file.content).then(() => {
      // 可加 toast 提示
    }).catch(console.error)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 标题 */}
        <div>
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            🖼️ 图片转代码工作流
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            截图分析 → UI 组件识别 → 框架代码生成 → 迭代优化
          </p>
        </div>

        {/* 输入配置 */}
        <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">输入配置</h3>

          {/* 图片选择 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectImage}
              className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent-light transition-colors"
            >
              选择图片
            </button>
            <input
              type="text"
              value={imagePath}
              onChange={e => setImagePath(e.target.value)}
              placeholder="图片文件路径 (.png/.jpg/.jpeg/.webp/.gif/.bmp)"
              className="flex-1 bg-surface text-text-primary text-xs rounded px-2 py-1.5 border border-border focus:border-accent focus:outline-none"
            />
          </div>

          {/* 图片预览 */}
          {imagePath && (
            <div className="border border-border rounded-lg overflow-hidden max-w-md">
              <img
                src={`local-file://${imagePath}`}
                alt="预览"
                className="w-full max-h-48 object-contain bg-surface"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            </div>
          )}

          {/* 框架选择 */}
          <div>
            <label className="text-xs text-text-muted block mb-2">目标框架</label>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORK_OPTIONS.map(fw => (
                <button
                  key={fw.id}
                  onClick={() => setFramework(fw.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    framework === fw.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {fw.icon} {fw.label}
                </button>
              ))}
            </div>
          </div>

          {/* 其他配置 */}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-text-muted">
              模型
              <select
                value={modelConfigId}
                onChange={e => setModelConfigId(e.target.value)}
                className="w-full bg-surface text-text-primary text-xs rounded px-2 py-1.5 border border-border mt-1"
              >
                {modelList.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-muted">
              组件名称
              <input
                type="text"
                value={componentName}
                onChange={e => setComponentName(e.target.value)}
                className="w-full bg-surface text-text-primary text-xs rounded px-2 py-1.5 border border-border mt-1 focus:border-accent focus:outline-none"
              />
            </label>
          </div>

          <label className="text-xs text-text-muted flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={responsive}
              onChange={e => setResponsive(e.target.checked)}
              className="accent-blue-500"
            />
            生成响应式代码
          </label>

          <textarea
            value={customPrompt}
            onChange={e => setCustomPrompt(e.target.value)}
            placeholder="自定义指令（可选）：如 '使用暗色主题'、'添加动画效果'..."
            className="w-full bg-surface text-text-primary text-xs rounded px-2 py-1.5 border border-border focus:border-accent focus:outline-none resize-y"
            rows={2}
          />

          <button
            onClick={handleGenerate}
            disabled={!imagePath || !modelConfigId || loading}
            className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? '🔄 生成中...' : '🚀 生成代码'}
          </button>
        </div>

        {/* 结果展示 */}
        {result && (
          <>
            {/* 分析结果 */}
            <AnalysisCard analysis={result.analysis} framework={result.framework} />

            {/* 代码文件 */}
            {result.files.length > 0 && (
              <div className="bg-bg-secondary rounded-lg border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                  <h3 className="text-sm font-semibold text-text-primary">
                    生成的代码 ({result.files.length} 个文件)
                  </h3>
                  <button
                    onClick={() => handleCopyCode(result.files[activeFileIndex])}
                    className="text-xs text-accent hover:text-accent-light"
                  >
                    📋 复制当前文件
                  </button>
                </div>

                {/* 文件标签 */}
                <div className="flex border-b border-border overflow-x-auto">
                  {result.files.map((file, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveFileIndex(i)}
                      className={`px-3 py-1.5 text-xs whitespace-nowrap border-r border-border transition-colors ${
                        activeFileIndex === i
                          ? 'bg-surface-active text-text-primary font-medium'
                          : 'text-text-muted hover:bg-surface-hover'
                      }`}
                    >
                      {file.fileName}
                    </button>
                  ))}
                </div>

                {/* 代码内容 */}
                <pre className="text-xs text-text-secondary p-4 overflow-x-auto max-h-96 overflow-y-auto bg-surface">
                  <code>{result.files[activeFileIndex]?.content || ''}</code>
                </pre>
              </div>
            )}

            {/* 迭代优化 */}
            <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">迭代优化</h3>

              {result.refinementHistory.length > 0 && (
                <div className="space-y-1">
                  {result.refinementHistory.map((h, i) => (
                    <div key={i} className="text-xs text-text-muted flex gap-2">
                      <span className="text-accent">#{h.iteration}</span>
                      <span>{h.feedback}</span>
                      <span className="text-text-muted">→ {h.changes}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineFeedback}
                  onChange={e => setRefineFeedback(e.target.value)}
                  placeholder="输入优化反馈，如 '增加按钮 hover 效果'、'调整间距'..."
                  className="flex-1 bg-surface text-text-primary text-xs rounded px-2 py-1.5 border border-border focus:border-accent focus:outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && refineFeedback.trim()) handleRefine()
                  }}
                />
                <button
                  onClick={handleRefine}
                  disabled={!refineFeedback.trim() || refining}
                  className="px-3 py-1.5 bg-accent text-white text-xs rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {refining ? '🔄' : '✨ 优化'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* 工作区提示 */}
        {!currentWorkspace && (
          <div className="text-xs text-text-muted text-center py-4">
            💡 建议先选择工作区以便保存生成的代码
          </div>
        )}
      </div>
    </div>
  )
}

// ===== 分析结果卡片 =====
function AnalysisCard({ analysis, framework }: { analysis: ImageAnalysis; framework: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
        🔍 UI 分析结果
        <span className="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded">{framework}</span>
      </h3>

      {/* 描述 */}
      <div className="text-xs text-text-secondary">{analysis.description}</div>

      {/* 布局 */}
      <div className="text-xs">
        <span className="text-text-muted">布局: </span>
        <span className="text-text-secondary">{analysis.layout}</span>
      </div>

      {/* 组件清单 */}
      {analysis.components.length > 0 && (
        <div>
          <div className="text-xs text-text-muted mb-1">识别的组件:</div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.components.map((comp, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 rounded-full bg-surface text-text-secondary border border-border"
                title={comp.description}
              >
                {comp.type}: {comp.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 颜色 */}
      {analysis.colors.length > 0 && (
        <div>
          <div className="text-xs text-text-muted mb-1">颜色方案:</div>
          <div className="flex flex-wrap gap-2">
            {analysis.colors.map((color, i) => (
              <div key={i} className="flex items-center gap-1">
                <div
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-text-muted">{color}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 字体 */}
      {analysis.typography.length > 0 && (
        <div>
          <div className="text-xs text-text-muted mb-1">字体:</div>
          <div className="text-[10px] text-text-secondary">
            {analysis.typography.join(' · ')}
          </div>
        </div>
      )}

      {/* 响应式 */}
      <div className="text-xs">
        <span className="text-text-muted">响应式: </span>
        <span className={analysis.responsive ? 'text-green-400' : 'text-text-muted'}>
          {analysis.responsive ? '✅ 需要' : '❌ 不需要'}
        </span>
      </div>
    </div>
  )
}
