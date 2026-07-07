import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import type { WikiDocument } from '@shared/types'

export default function WikiView() {
  const { currentWorkspace, modelList } = useAppStore()
  const [wikis, setWikis] = useState<WikiDocument[]>([])
  const [current, setCurrent] = useState<WikiDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const modelId = modelList[0]?.id || ''

  const loadList = useCallback(async () => {
    try {
      const list = await window.aela.wiki.list(currentWorkspace?.id)
      setWikis(list)
      if (list.length > 0) {
        setCurrent(prev => prev || list[0])
      }
    } catch {
      // 忽略
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    loadList()
  }, [loadList])

  const handleGenerate = useCallback(async () => {
    if (!currentWorkspace) return
    setLoading(true)
    setError('')
    try {
      const doc = await window.aela.wiki.generate(currentWorkspace.id, modelId)
      setCurrent(doc)
      await loadList()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace, modelId, loadList])

  const handleDelete = useCallback(async (id: string) => {
    await window.aela.wiki.delete(id)
    await loadList()
    if (current?.id === id) setCurrent(null)
  }, [current, loadList])

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 左侧：Wiki 列表 */}
      <div className="w-64 border-r border-border bg-bg-secondary/20 flex flex-col">
        <div className="px-3 py-2 border-b border-border">
          <div className="text-sm font-medium text-text-primary mb-2">📖 Repo Wiki</div>
          <button
            onClick={handleGenerate}
            disabled={!currentWorkspace || loading}
            className="w-full px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
          >
            {loading ? '⏳ 生成中...' : '＋ 生成 Wiki'}
          </button>
          {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {wikis.length === 0 ? (
            <div className="text-xs text-text-muted text-center py-4">
              点击「生成 Wiki」创建项目文档
            </div>
          ) : (
            <div className="space-y-0.5">
              {wikis.map(w => (
                <div
                  key={w.id}
                  onClick={() => setCurrent(w)}
                  className={`group px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    current?.id === w.id ? 'bg-surface-active' : 'hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-primary truncate flex-1">{w.title}</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(w.id) }}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {w.fileCount} 文件 · {new Date(w.generatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧：Wiki 内容 */}
      <div className="flex-1 overflow-y-auto">
        {current ? (
          <div className="max-w-4xl mx-auto px-6 py-6">
            {/* 标题区 */}
            <div className="mb-6 pb-4 border-b border-border">
              <h1 className="text-2xl font-bold text-text-primary">{current.title}</h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                <span>{current.fileCount} 文件</span>
                <span>·</span>
                <span>{new Date(current.generatedAt).toLocaleString()}</span>
              </div>
              {/* 语言标签 */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.entries(current.languageStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([lang, count]) => (
                    <span key={lang} className="text-[10px] bg-surface px-2 py-0.5 rounded text-text-secondary">
                      {lang} ({count})
                    </span>
                  ))}
              </div>
            </div>

            {/* Markdown 渲染 */}
            <div className="prose prose-invert max-w-none">
              <MarkdownPreview markdown={current.markdown} />
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <div className="text-5xl mb-4">📖</div>
              <p className="text-sm">选择或生成一个 Wiki</p>
              <p className="text-xs mt-1 text-text-muted">自动扫描代码库生成项目文档</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 简单的 Markdown 预览组件
 * 支持：标题、列表、代码块、加粗、行内代码
 */
function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeContent: string[] = []

  lines.forEach((line, i) => {
    // 代码块
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // 结束代码块
        elements.push(
          <pre key={`code-${i}`} className="bg-bg-primary border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-text-secondary">
            {codeContent.join('\n')}
          </pre>
        )
        codeContent = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      return
    }

    if (inCodeBlock) {
      codeContent.push(line)
      return
    }

    // 标题
    if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold text-text-primary mt-4 mb-2">{line.slice(2)}</h1>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-bold text-text-primary mt-4 mb-2 pb-1 border-b border-border">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold text-text-primary mt-3 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith('- ') || line.startsWith('  - ')) {
      const indent = line.startsWith('  ') ? 16 : 0
      const text = line.replace(/^\s*-\s*/, '')
      elements.push(
        <div key={i} style={{ marginLeft: indent }} className="text-sm text-text-secondary flex gap-1.5">
          <span className="text-text-muted">•</span>
          <span>{renderInline(text)}</span>
        </div>
      )
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="border-border my-3" />)
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="text-sm text-text-secondary leading-relaxed">{renderInline(line)}</p>)
    }
  })

  // 如果代码块未闭合
  if (inCodeBlock && codeContent.length > 0) {
    elements.push(
      <pre key="code-unclosed" className="bg-bg-primary border border-border rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono text-text-secondary">
        {codeContent.join('\n')}
      </pre>
    )
  }

  return <>{elements}</>
}

function renderInline(text: string): React.ReactNode {
  // 处理 **bold** 和 `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-text-primary font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-surface px-1 py-0.5 rounded text-xs text-blue-400 font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}
