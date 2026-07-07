// [升级 2] 编排模板库 + 执行回放 + 性能分析
import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import type { OrchestrationTemplate, OrchestrationRunRecord, OrchestrationPerformanceReport, OrchestrationMode } from '@shared/types'

type TabType = 'templates' | 'history' | 'performance'

export default function OrchestrationTemplatesView() {
  const { setView, modelList } = useAppStore()
  const [tab, setTab] = useState<TabType>('templates')

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">📋</span>
          <h1 className="text-xl font-bold text-text-primary">编排模板与性能</h1>
        </div>
        <p className="text-sm text-text-muted">
          预设编排模板 · 执行历史回放 · 性能分析报告
        </p>
      </div>

      {/* Tab 切换 */}
      <div className="px-8 pt-4">
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit">
          {([
            { key: 'templates', label: '模板库', icon: '📐' },
            { key: 'history', label: '执行历史', icon: '📜' },
            { key: 'performance', label: '性能分析', icon: '📊' },
          ] as Array<{ key: TabType; label: string; icon: string }>).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-8 py-4">
        {tab === 'templates' && <TemplatesTab setView={setView} modelList={modelList} />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'performance' && <PerformanceTab />}
      </div>
    </div>
  )
}

// ===== 模板库 Tab =====
function TemplatesTab({ setView }: { setView: (v: any) => void; modelList: any[] }) {
  const [templates, setTemplates] = useState<OrchestrationTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const list = await window.aela.orchestrationExt.templatesList()
      setTemplates(list)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = (tpl: OrchestrationTemplate) => {
    setView('orchestration')
    // 通过自定义事件将模板传给编排视图
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('aela-use-orchestration-template', { detail: tpl }))
    }, 100)
  }

  if (loading) {
    return <div className="text-center text-text-muted py-12">加载模板中...</div>
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {templates.map(tpl => (
        <div
          key={tpl.id}
          className="bg-surface border border-border rounded-xl p-4 hover:border-blue-500/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold text-text-primary">{tpl.name}</h3>
              <span className="text-[10px] text-text-muted">
                {tpl.category} · {tpl.mode}
              </span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              tpl.mode === 'pipeline' ? 'bg-blue-500/20 text-blue-400' :
              tpl.mode === 'parallel' ? 'bg-green-500/20 text-green-400' :
              tpl.mode === 'handoff' ? 'bg-orange-500/20 text-orange-400' :
              'bg-purple-500/20 text-purple-400'
            }`}>
              {tpl.mode}
            </span>
          </div>
          <p className="text-xs text-text-muted mb-3">{tpl.description}</p>
          <div className="space-y-1 mb-3">
            {tpl.agents.map((agent, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                <span className="text-blue-400">●</span>
                <span className="font-medium">{agent.name}</span>
                <span className="text-text-muted">— {agent.role}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-[10px] text-text-muted">
              {tpl.agents.length} 个 Agent
              {tpl.maxRounds ? ` · ${tpl.maxRounds} 轮` : ''}
              {tpl.maxConcurrent ? ` · 并发 ${tpl.maxConcurrent}` : ''}
            </span>
            <button
              onClick={() => handleUseTemplate(tpl)}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
            >
              使用模板 →
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ===== 执行历史 Tab =====
function HistoryTab() {
  const [runs, setRuns] = useState<OrchestrationRunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRun, setSelectedRun] = useState<OrchestrationRunRecord | null>(null)

  useEffect(() => {
    loadRuns()
  }, [])

  const loadRuns = async () => {
    setLoading(true)
    try {
      const list = await window.aela.orchestrationExt.runsList(50)
      setRuns(list)
    } catch (err) {
      console.error('Failed to load runs:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-text-muted py-12">加载历史记录中...</div>
  }

  return (
    <div className="space-y-2">
      {runs.length === 0 ? (
        <div className="text-center text-text-muted py-12 bg-surface border border-border rounded-lg">
          暂无执行记录
        </div>
      ) : (
        runs.map(run => (
          <div
            key={run.id}
            className="bg-surface border border-border rounded-lg p-3 hover:border-blue-500/50 transition-colors cursor-pointer"
            onClick={() => setSelectedRun(run)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${run.success ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-text-primary">{run.configName}</span>
                <span className="text-[10px] text-text-muted bg-bg-primary px-1.5 py-0.5 rounded">{run.mode}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-text-muted">
                <span>{run.agentCount} Agent</span>
                <span>{(run.duration / 1000).toFixed(1)}s</span>
                <span>{new Date(run.startedAt).toLocaleString()}</span>
              </div>
            </div>
            {run.error && (
              <p className="text-xs text-red-400 mt-1">❌ {run.error}</p>
            )}
          </div>
        ))
      )}

      {/* 回放弹窗 */}
      {selectedRun && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">执行回放 — {selectedRun.configName}</h3>
              <button onClick={() => setSelectedRun(null)} className="text-text-muted hover:text-text-primary">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div><span className="text-text-muted">模式:</span> <span className="text-text-primary">{selectedRun.mode}</span></div>
              <div><span className="text-text-muted">耗时:</span> <span className="text-text-primary">{(selectedRun.duration / 1000).toFixed(2)}s</span></div>
              <div><span className="text-text-muted">Agent数:</span> <span className="text-text-primary">{selectedRun.agentCount}</span></div>
            </div>
            <div className="space-y-3">
              {selectedRun.results.map((result, i) => (
                <div key={i} className="bg-surface border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] text-text-muted">{i + 1}</span>
                    <span className="text-sm font-medium text-text-primary">{result.agentName}</span>
                    {result.skipped && <span className="text-[10px] text-yellow-400">已跳过</span>}
                    {result.error && <span className="text-[10px] text-red-400">出错</span>}
                  </div>
                  <pre className="text-xs text-text-secondary whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {result.content || result.error || '(无输出)'}
                  </pre>
                  {result.metrics && (
                    <div className="flex gap-3 mt-2 text-[10px] text-text-muted">
                      <span>{result.metrics.totalTurns} 轮</span>
                      <span>{result.metrics.totalTools} 次工具</span>
                      <span>{(result.metrics.duration / 1000).toFixed(1)}s</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 性能分析 Tab =====
function PerformanceTab() {
  const [report, setReport] = useState<OrchestrationPerformanceReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReport()
  }, [])

  const loadReport = async () => {
    setLoading(true)
    try {
      const r = await window.aela.orchestrationExt.performance()
      setReport(r)
    } catch (err) {
      console.error('Failed to load performance report:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-text-muted py-12">生成性能报告中...</div>
  }

  if (!report || report.totalRuns === 0) {
    return <div className="text-center text-text-muted py-12 bg-surface border border-border rounded-lg">暂无性能数据</div>
  }

  return (
    <div className="space-y-4">
      {/* 概览 */}
      <div className="grid grid-cols-4 gap-3">
        <PerfStat label="总执行次数" value={report.totalRuns} icon="🔢" />
        <PerfStat label="成功率" value={`${(report.successRate * 100).toFixed(1)}%`} icon="✅" />
        <PerfStat label="平均耗时" value={`${(report.avgDuration / 1000).toFixed(1)}s`} icon="⏱️" />
        <PerfStat label="平均 Agent 数" value={report.avgAgentCount.toFixed(1)} icon="🤖" />
      </div>

      {/* 按模式分析 */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">按编排模式分析</h3>
        <div className="space-y-2">
          {(Object.entries(report.byMode) as Array<[OrchestrationMode, any]>).map(([mode, data]) => (
            <div key={mode} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary w-20">{mode}</span>
              <div className="flex-1 bg-bg-primary rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${data.runs > 0 ? (data.successRate * 100) : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-text-muted w-32 text-right">
                {data.runs} 次 · {(data.avgDuration / 1000).toFixed(1)}s · {(data.successRate * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 最慢的 Agent */}
      {report.slowestAgents.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">最慢的 Agent</h3>
          <div className="space-y-1">
            {report.slowestAgents.map((agent, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">
                  <span className="text-text-muted mr-2">#{i + 1}</span>
                  {agent.agentName}
                </span>
                <span className="text-text-muted">
                  {agent.runs} 次 · 平均 {(agent.avgDuration / 1000).toFixed(1)}s
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 错误模式 */}
      {report.errorPatterns.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-3">常见错误</h3>
          <div className="space-y-1">
            {report.errorPatterns.map((err, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-red-400 truncate flex-1 mr-2">{err.error}</span>
                <span className="text-text-muted shrink-0">{err.count} 次</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PerfStat({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <div className="text-xl font-bold text-text-primary mt-1">{value}</div>
    </div>
  )
}
