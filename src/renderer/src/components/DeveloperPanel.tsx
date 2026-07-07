// 开发者面板 — Ctrl+Shift+D 呼出
import { useState, useEffect, useCallback } from 'react'

interface IpcLogEntry {
  seq: number
  channel: string
  args: unknown[]
  startTime: number
  endTime: number
  duration: number
  error: boolean
  result?: unknown
}

const SLOW_THRESHOLD = 2000

interface DeveloperPanelProps {
  open: boolean
  onClose: () => void
}

type TabKey = 'ipc' | 'agent' | 'perf' | 'diag'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'ipc', label: '📡 IPC 日志' },
  { key: 'agent', label: '🤖 Agent 运行' },
  { key: 'perf', label: '⚡ 性能' },
  { key: 'diag', label: '🔍 诊断导出' },
]

export default function DeveloperPanel({ open, onClose }: DeveloperPanelProps) {
  const [tab, setTab] = useState<TabKey>('ipc')
  const [logs, setLogs] = useState<IpcLogEntry[]>([])

  const refreshLogs = useCallback(async () => {
    try {
      const entries = await window.aela.ipcMonitor.getEntries()
      setLogs(entries)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!open) return
    refreshLogs()
    const unsubscribe = window.aela.ipcMonitor.onLog(() => {
      refreshLogs()
    })
    return unsubscribe
  }, [open, refreshLogs])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* 左侧遮罩 — 点击关闭 */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* 右侧面板 60% 宽度 */}
      <div className="w-[60%] min-w-[600px] max-w-[900px] h-full bg-[#1e1e1e] border-l border-[#333] flex flex-col shadow-2xl">
        {/* 顶部 Tab 栏 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] bg-[#252526]">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-[#094771] text-white'
                    : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#858585]">DEV ONLY</span>
            <button
              onClick={async () => {
                await window.aela.ipcMonitor.clear()
                setLogs([])
              }}
              className="px-2 py-1 text-[10px] text-[#cccccc] bg-[#333] rounded hover:bg-[#444]"
            >
              清空
            </button>
            <button onClick={onClose} className="text-[#cccccc] hover:text-white text-lg leading-none">×</button>
          </div>
        </div>

        {/* Tab 内容区 */}
        <div className="flex-1 overflow-hidden">
          {tab === 'ipc' && <IpcLogTab logs={logs} />}
          {tab === 'agent' && <AgentRunsTab />}
          {tab === 'perf' && <PerformanceTab />}
          {tab === 'diag' && <DiagnosticTab />}
        </div>
      </div>
    </div>
  )
}

function IpcLogTab({ logs }: { logs: IpcLogEntry[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggle = (seq: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(seq)) next.delete(seq)
      else next.add(seq)
      return next
    })
  }

  const copyAll = () => {
    const text = JSON.stringify(logs, null, 2)
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-[#333] flex items-center justify-between">
        <span className="text-xs text-[#858585]">{logs.length} 条调用</span>
        <button onClick={copyAll} className="px-2 py-1 text-[10px] text-[#cccccc] bg-[#333] rounded hover:bg-[#444]">
          复制全部
        </button>
      </div>
      <div className="flex-1 overflow-y-auto font-mono text-[11px]">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#858585]">
            暂无 IPC 调用记录
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-[#252526]">
              <tr className="text-[#858585] text-left">
                <th className="px-2 py-1 w-16">#</th>
                <th className="px-2 py-1">Channel</th>
                <th className="px-2 py-1 w-20">耗时</th>
                <th className="px-2 py-1 w-16">状态</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr
                  key={log.seq}
                  onClick={() => toggle(log.seq)}
                  className={`cursor-pointer border-b border-[#2a2d2e] hover:bg-[#2a2d2e] ${
                    log.error
                      ? 'bg-[#5a1d1d]/30'
                      :                       log.duration > SLOW_THRESHOLD ? 'bg-[#5a4a1d]/30' : ''
                  }`}
                >
                  <td className="px-2 py-1 text-[#858585]">{log.seq}</td>
                  <td className="px-2 py-1 text-[#9cdcfe]">{log.channel}</td>
                  <td className={`px-2 py-1 ${
                    log.duration > IpcMonitorService.SLOW_THRESHOLD ? 'text-[#dcdcaa]' : 'text-[#b5cea8]'
                  }`}>
                    {log.duration.toFixed(1)}ms
                  </td>
                  <td className="px-2 py-1">
                    {log.error ? (
                      <span className="text-[#f48771]">❌</span>
                    ) : (
                      <span className="text-[#b5cea8]">✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function AgentRunsTab() {
  return (
    <div className="h-full flex items-center justify-center text-[#858585] text-sm">
      Agent 运行视图（暂无数据）
    </div>
  )
}

function PerformanceTab() {
  return (
    <div className="h-full flex items-center justify-center text-[#858585] text-sm">
      性能视图（暂无数据）
    </div>
  )
}

function DiagnosticTab() {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const summary = await window.aela.cost.summary()
      const trend = await window.aela.cost.dailyTrend(30)
      const budget = await window.aela.cost.getBudget()

      const diag = {
        exportedAt: new Date().toISOString(),
        budget,
        summary,
        dailyTrend: trend,
      }

      const blob = new Blob([JSON.stringify(diag, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aela-diag-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-xs text-[#cccccc]">
        <h3 className="font-medium text-[#cccccc] mb-2">诊断导出</h3>
        <p className="text-[#858585] mb-4">导出预算配置、成本汇总和最近 30 天趋势。</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-[#0e639c] hover:bg-[#1177bb] disabled:opacity-50 text-white rounded text-sm"
        >
          {exporting ? '导出中...' : '📥 下载诊断 JSON'}
        </button>
      </div>
    </div>
  )
}