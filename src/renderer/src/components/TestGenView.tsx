import { useState, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import type { TestGenAnalysis, TestGenResult } from '@shared/types'

export default function TestGenView() {
  const { currentWorkspace, modelList } = useAppStore()
  const [filePath, setFilePath] = useState('')
  const [analysis, setAnalysis] = useState<TestGenAnalysis | null>(null)
  const [result, setResult] = useState<TestGenResult | null>(null)
  const [runOutput, setRunOutput] = useState<{ success: boolean; output: string; passed: number; failed: number } | null>(null)
  const [loading, setLoading] = useState<'analyze' | 'generate' | 'run' | null>(null)
  const [error, setError] = useState('')

  const modelId = modelList[0]?.id || ''

  const handleAnalyze = useCallback(async () => {
    if (!filePath.trim()) return
    setLoading('analyze')
    setError('')
    try {
      const a = await window.aela.testGen.analyze(filePath.trim())
      setAnalysis(a)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setLoading(null)
    }
  }, [filePath])

  const handleGenerate = useCallback(async () => {
    if (!filePath.trim()) return
    setLoading('generate')
    setError('')
    try {
      const r = await window.aela.testGen.generate(filePath.trim(), modelId)
      setResult(r)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setLoading(null)
    }
  }, [filePath, modelId])

  const handleRun = useCallback(async () => {
    if (!result) return
    setLoading('run')
    setError('')
    try {
      const output = await window.aela.testGen.run(result.testFilePath)
      setRunOutput(output)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '执行失败')
    } finally {
      setLoading(null)
    }
  }, [result])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-bg-secondary/30">
        <span className="text-sm font-medium text-text-primary">🧪 自动测试生成</span>
        {currentWorkspace && (
          <span className="text-[10px] text-text-muted bg-surface px-1.5 py-0.5 rounded">{currentWorkspace.name}</span>
        )}
        <div className="flex-1" />
        <input
          value={filePath}
          onChange={e => setFilePath(e.target.value)}
          placeholder="源文件路径（如 src/utils/helpers.ts）"
          className="w-72 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:border-blue-500 outline-none"
        />
        <button
          onClick={handleAnalyze}
          disabled={!filePath.trim() || loading !== null}
          className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border hover:bg-surface-hover text-text-secondary disabled:opacity-50"
        >
          {loading === 'analyze' ? '分析中...' : '分析'}
        </button>
        <button
          onClick={handleGenerate}
          disabled={!filePath.trim() || loading !== null}
          className="px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white"
        >
          {loading === 'generate' ? '生成中...' : '生成测试'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-700/30 text-red-400 text-xs">
          ⚠ {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：分析结果 */}
        <div className="w-72 border-r border-border bg-bg-secondary/20 overflow-y-auto p-3">
          {analysis ? (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">语言</div>
                <div className="text-sm text-text-primary">{analysis.language}</div>
              </div>
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">推荐框架</div>
                <div className="text-sm text-blue-400">{analysis.frameworkSuggestion}</div>
              </div>
              {analysis.functions.length > 0 && (
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">函数 ({analysis.functions.length})</div>
                  <div className="space-y-1">
                    {analysis.functions.map((f, i) => (
                      <div key={i} className="text-xs text-text-secondary font-mono">
                        <span className="text-green-400">fn</span> {f.name}({f.params}): {f.returnType}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analysis.classes.length > 0 && (
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">类 ({analysis.classes.length})</div>
                  <div className="space-y-1">
                    {analysis.classes.map((c, i) => (
                      <div key={i} className="text-xs text-text-secondary font-mono">
                        <span className="text-blue-400">class</span> {c.name}
                        <div className="text-text-muted ml-3">{c.methods.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {analysis.imports.length > 0 && (
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">导入 ({analysis.imports.length})</div>
                  <div className="space-y-0.5">
                    {analysis.imports.map((imp, i) => (
                      <div key={i} className="text-xs text-text-muted font-mono">{imp}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-text-muted text-xs py-8">
              输入文件路径后点击「分析」
            </div>
          )}
        </div>

        {/* 右侧：生成的测试代码 + 运行结果 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {result ? (
            <>
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-bg-secondary/20">
                <span className="text-xs font-mono text-text-secondary">{result.testFilePath}</span>
                <span className="text-[10px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">{result.framework}</span>
                <div className="flex-1" />
                <button
                  onClick={handleRun}
                  disabled={loading !== null}
                  className="px-3 py-1 rounded text-xs bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
                >
                  {loading === 'run' ? '运行中...' : '▶ 运行测试'}
                </button>
              </div>
              <pre className="flex-1 overflow-auto bg-bg-primary text-text-primary font-mono text-xs p-4 m-0">
                {result.testContent}
              </pre>
              {runOutput && (
                <div className={`border-t border-border px-4 py-2 max-h-40 overflow-y-auto ${
                  runOutput.success ? 'bg-green-900/10' : 'bg-red-900/10'
                }`}>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-xs font-medium ${runOutput.success ? 'text-green-400' : 'text-red-400'}`}>
                      {runOutput.success ? '✓ 全部通过' : '✕ 有失败'}
                    </span>
                    <span className="text-xs text-green-400">{runOutput.passed} passed</span>
                    <span className="text-xs text-red-400">{runOutput.failed} failed</span>
                  </div>
                  <pre className="text-[10px] text-text-muted whitespace-pre-wrap font-mono">{runOutput.output}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <div className="text-center">
                <div className="text-4xl mb-3">🧪</div>
                <p className="text-sm">生成测试代码后会显示在这里</p>
                <p className="text-xs mt-1 text-text-muted">支持 TypeScript / Python 源文件</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
