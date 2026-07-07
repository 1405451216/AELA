// [进化 2] 多模态深化 — 截图分析报错面板
// 上传错误截图 → 视觉 LLM 分析 → 提取错误信息 → 诊断 + 修复建议
import { useState, useEffect, useCallback, useRef } from 'react'
import type { ScreenshotAnalysis, ErrorCategory, ErrorSeverity, ModelConfig } from '@shared/types'

const CATEGORY_LABELS: Record<ErrorCategory, string> = {
  runtime: '运行时错误',
  compile: '编译错误',
  network: '网络错误',
  ui_render: 'UI 渲染错误',
  permission: '权限错误',
  timeout: '超时错误',
  memory: '内存错误',
  unknown: '未知错误',
}

const CATEGORY_COLORS: Record<ErrorCategory, string> = {
  runtime: 'bg-red-500/20 text-red-400 border-red-500/30',
  compile: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  network: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ui_render: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  permission: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  timeout: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  memory: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

const SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  info: '信息',
  warning: '警告',
  error: '错误',
  critical: '严重',
}

const SEVERITY_COLORS: Record<ErrorSeverity, string> = {
  info: 'bg-blue-500/20 text-blue-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
  error: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
}

export default function ScreenshotAnalysisView() {
  const [imagePath, setImagePath] = useState('')
  const [context, setContext] = useState('')
  const [modelConfigId, setModelConfigId] = useState('')
  const [models, setModels] = useState<ModelConfig[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<ScreenshotAnalysis | null>(null)
  const [history, setHistory] = useState<ScreenshotAnalysis[]>([])
  const [previewUrl, setPreviewUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.aela.model.list().then((list) => {
      setModels(list)
      if (list.length > 0 && !modelConfigId) {
        setModelConfigId(list[0].id)
      }
    })
    loadHistory()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = useCallback(async () => {
    try {
      const results = await window.aela.screenshot.listResults()
      setHistory(results)
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 显示预览
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Electron 中 File 对象有 path 属性（非标准 DOM API）
    const filePath = (file as any).path as string | undefined
    if (filePath) {
      setImagePath(filePath)
    }
  }

  const handleAnalyze = async () => {
    if (!imagePath) {
      alert('请先选择截图文件')
      return
    }
    if (!modelConfigId) {
      alert('请先选择分析模型')
      return
    }

    setAnalyzing(true)
    setResult(null)
    try {
      const res = await window.aela.screenshot.analyze({
        imagePath,
        modelConfigId,
        context: context || undefined,
      })
      setResult(res)
      loadHistory()
    } catch (err) {
      console.error('Analysis failed:', err)
      alert(`分析失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSelectHistory = async (id: string) => {
    try {
      const res = await window.aela.screenshot.getResult(id)
      if (res) setResult(res)
    } catch (err) {
      console.error('Failed to load result:', err)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">📸</span>
          <h1 className="text-xl font-bold text-text-primary">截图分析报错</h1>
        </div>
        <p className="text-sm text-text-muted">
          上传错误截图 → AI 视觉分析 → 提取错误信息 → 诊断原因 → 修复建议
        </p>
      </div>

      {/* 上传区 */}
      <div className="px-8 py-6 border-b border-border">
        <div className="grid grid-cols-2 gap-6">
          {/* 左侧：截图选择 */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">错误截图</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-accent transition-colors"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="截图预览" className="max-h-48 mx-auto rounded-lg" />
              ) : (
                <>
                  <div className="text-4xl mb-2">📁</div>
                  <div className="text-sm text-text-muted">点击选择截图文件</div>
                  <div className="text-xs text-text-muted mt-1">支持 PNG / JPG / GIF / WebP</div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
              onChange={handleFileSelect}
              className="hidden"
            />
            {imagePath && (
              <div className="mt-2 text-xs text-text-muted truncate">📁 {imagePath}</div>
            )}
          </div>

          {/* 右侧：配置 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">分析模型</label>
              <select
                value={modelConfigId}
                onChange={(e) => setModelConfigId(e.target.value)}
                className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.provider}/{m.model})
                  </option>
                ))}
              </select>
              <div className="text-xs text-text-muted mt-1">
                建议使用支持视觉的模型（如 GPT-4o、Claude 3.5 Sonnet）
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                附加上下文 <span className="text-text-muted">（可选）</span>
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="如：当前使用 React + TypeScript，在执行 npm run dev 时出现..."
                rows={3}
                className="w-full bg-bg-secondary text-text-primary rounded-lg px-3 py-2 border border-border text-sm focus:outline-none focus:border-accent resize-none"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!imagePath || !modelConfigId || analyzing}
              className="w-full px-4 py-3 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {analyzing ? '🔍 分析中...' : '🔍 开始分析'}
            </button>
          </div>
        </div>
      </div>

      {/* 分析结果 */}
      {result && (
        <div className="px-8 py-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary mb-4">分析结果</h2>

          {/* 标签 */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${CATEGORY_COLORS[result.category]}`}>
              {CATEGORY_LABELS[result.category]}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${SEVERITY_COLORS[result.severity]}`}>
              {SEVERITY_LABELS[result.severity]}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-bg-tertiary text-text-muted">
              来源: {result.source}
            </span>
          </div>

          {/* 错误标题 */}
          <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
            <div className="text-xs text-text-muted mb-1">错误标题</div>
            <div className="text-base font-medium text-text-primary">{result.errorTitle}</div>
          </div>

          {/* 错误文本 */}
          {result.errorText && (
            <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
              <div className="text-xs text-text-muted mb-2">提取的错误信息</div>
              <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono overflow-x-auto max-h-48">
                {result.errorText}
              </pre>
            </div>
          )}

          {/* 诊断分析 */}
          {result.diagnosis && (
            <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
              <div className="text-xs text-text-muted mb-2">📊 诊断分析</div>
              <p className="text-sm text-text-primary leading-relaxed">{result.diagnosis}</p>
            </div>
          )}

          {/* 可能原因 */}
          {result.possibleCauses.length > 0 && (
            <div className="bg-bg-secondary rounded-xl p-4 border border-border mb-4">
              <div className="text-xs text-text-muted mb-2">🔍 可能的原因</div>
              <ul className="space-y-2">
                {result.possibleCauses.map((cause, i) => (
                  <li key={i} className="text-sm text-text-primary flex items-start gap-2">
                    <span className="text-accent mt-0.5">{i + 1}.</span>
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 修复建议 */}
          {result.fixSuggestions.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs text-text-muted">🛠️ 修复建议</div>
              {result.fixSuggestions.map((fix, i) => (
                <div key={i} className="bg-green-500/5 rounded-xl p-4 border border-green-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-green-400">💡</span>
                      <span className="text-sm font-medium text-text-primary">{fix.title}</span>
                    </div>
                    <span className="text-xs text-green-400">置信度 {(fix.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-sm text-text-muted mb-2">{fix.description}</p>
                  {fix.codeSnippet && (
                    <pre className="text-xs text-text-primary bg-bg-tertiary rounded-lg p-3 overflow-x-auto font-mono">
                      {fix.codeSnippet}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 关键词 */}
          {result.keywords.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.keywords.map((kw, i) => (
                <span key={i} className="px-2 py-1 bg-bg-tertiary text-text-muted rounded text-xs">
                  #{kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 历史记录 */}
      {history.length > 0 && (
        <div className="px-8 py-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">历史分析记录</h2>
          <div className="space-y-2">
            {history.slice(0, 20).map((h) => (
              <div
                key={h.id}
                onClick={() => handleSelectHistory(h.id)}
                className="flex items-center gap-3 bg-bg-secondary rounded-lg p-3 border border-border cursor-pointer hover:border-accent transition-colors"
              >
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[h.category]}`}>
                  {CATEGORY_LABELS[h.category]}
                </span>
                <span className="flex-1 text-sm text-text-primary truncate">{h.errorTitle}</span>
                <span className="text-xs text-text-muted">
                  {new Date(h.analyzedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
