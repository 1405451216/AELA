// 子 Agent 运行面板 — 展示多轮 ReAct / 并行 Agent 的实时运行过程
// 参考 TRAE Code 风格：每个子 Agent 一个可折叠卡片，显示名称、状态、工具调用、输出内容

import { useState } from 'react'
import { useT } from '../../i18n'

export interface SubAgentState {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  content: string           // 累积的文本输出（思考过程）
  toolCalls: SubAgentToolCall[]
  metrics?: { totalTurns: number; totalTools: number; duration: number }
}

export interface SubAgentToolCall {
  name: string
  args: string
  result?: string
  isError?: boolean
  isPending?: boolean
}

interface Props {
  agents: SubAgentState[]
  /** 是否正在流式执行中 */
  isStreaming?: boolean
}

const STATUS_ICON: Record<string, string> = {
  running: '⏳',
  done: '✅',
  error: '❌',
}

const STATUS_LABEL: Record<string, (t: ReturnType<typeof useT>) => string> = {
  running: t => t('subagent.running'),
  done: t => t('subagent.done'),
  error: t => t('subagent.error'),
}

export default function SubAgentPanel({ agents }: Props) {
  const t = useT()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (agents.length === 0) return null

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 自动展开第一个 running 的 agent
  const hasRunning = agents.some(a => a.status === 'running')

  return (
    <div className="space-y-2">
      {/* 思考过程标题栏 */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span>{t('subagent.thinkingProcess')}</span>
        {hasRunning && (
          <>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span>{agents.filter(a => a.status === 'running').length} {t('subagent.active')}</span>
          </>
        )}
        <button
          onClick={() => {
            if (expandedIds.size > 0) setExpandedIds(new Set())
            else setExpandedIds(new Set(agents.map(a => a.id)))
          }}
          className="ml-auto text-text-muted hover:text-text-primary transition-colors"
        >
          {expandedIds.size > 0 ? t('subagent.collapseAll') : t('subagent.expandAll')}
        </button>
      </div>

      {/* 子 Agent 卡片列表 */}
      {agents.map(agent => {
        const isExpanded = expandedIds.has(agent.id) || agent.status === 'running'
        const statusIcon = STATUS_ICON[agent.status] || '⏳'
        const statusLabel = STATUS_LABEL[agent.status]?.(t) || ''

        return (
          <div
            key={agent.id}
            className={`rounded-lg border overflow-hidden transition-colors ${
              agent.status === 'running'
                ? 'border-blue-500/40 bg-blue-500/5'
                : agent.status === 'error'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-border bg-surface/50'
            }`}
          >
            {/* 卡片头部 — 始终可见 */}
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-label={agent.name}
              onClick={() => toggleExpand(agent.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleExpand(agent.id)
                }
              }}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-surface-hover/50 transition-colors"
            >
              {/* 状态图标 */}
              <span className="text-sm shrink-0">{statusIcon}</span>

              {/* Agent 名称 */}
              <span className="text-xs font-medium text-text-primary">
                {agent.name}
              </span>

              {/* 任务描述（取 content 前 60 字符） */}
              {agent.content && (
                <span className="text-[11px] text-text-muted truncate flex-1 ml-1">
                  {agent.content.slice(0, 80)}{agent.content.length > 80 ? '...' : ''}
                </span>
              )}

              {/* 状态标签 */}
              <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium ${
                agent.status === 'running'
                  ? 'bg-blue-500/15 text-blue-400'
                  : agent.status === 'error'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-green-500/15 text-green-400'
              }`}>
                {statusLabel}
              </span>

              {/* 工具调用计数 */}
              {agent.toolCalls.length > 0 && (
                <span className="text-[10px] text-text-muted shrink-0">
                  🛠 {agent.toolCalls.length}
                </span>
              )}

              {/* 展开/收起箭头 */}
              <span className="text-text-muted text-[10px] shrink-0">
                {isExpanded ? '▴' : '▾'}
              </span>
            </div>

            {/* 可折叠内容区 */}
            {isExpanded && (
              <div className="border-t border-border/50 px-3 py-2 space-y-2">
                {/* 工具调用记录 */}
                {agent.toolCalls.length > 0 && (
                  <div className="space-y-1">
                    {agent.toolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        className={`rounded-md border text-[11px] overflow-hidden ${
                          tc.isError
                            ? 'border-red-700/30 bg-red-900/10'
                            : tc.isPending
                              ? 'border-yellow-700/30 bg-yellow-900/10'
                              : 'border-border/50 bg-bg-primary/30'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <span>{tc.isError ? '❌' : tc.isPending ? '⏳' : '✅'}</span>
                          <span className="font-mono font-medium text-text-secondary">{tc.name}</span>
                          {!tc.isError && !tc.isPending && (
                            <span className="text-green-400 text-[10px]">{t('subagent.toolDone')}</span>
                          )}
                        </div>
                        {/* 工具参数 */}
                        <div className="px-2 pb-1">
                          <div className="font-mono text-text-muted whitespace-pre-wrap break-all max-h-20 overflow-y-auto text-[10px]">
                            {tc.args}
                          </div>
                        </div>
                        {/* 工具结果 */}
                        {tc.result && !tc.isPending && (
                          <div className="border-t border-border/30 px-2 py-1 font-mono text-text-secondary whitespace-pre-wrap break-all max-h-32 overflow-y-auto text-[10px]">
                            {tc.result.length > 300 ? tc.result.slice(0, 300) + '\n...' : tc.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 文本输出（思考内容） */}
                {agent.content && (
                  <div className="text-xs text-text-secondary whitespace-pre-wrap break-words max-h-64 overflow-y-auto leading-relaxed">
                    {agent.content}
                    {agent.status === 'running' && (
                      <span className="cursor-blink inline-block w-1.5 h-3.5 bg-blue-400 ml-0.5 align-middle" />
                    )}
                  </div>
                )}

                {/* 指标信息 */}
                {agent.metrics && (
                  <div className="flex items-center gap-3 text-[10px] text-text-muted pt-1 border-t border-border/30">
                    <span>🔄 {agent.metrics.totalTurns}{t('msg.turns')}</span>
                    <span>🛠 {agent.metrics.totalTools}{t('msg.tools')}</span>
                    <span>⏱ {(agent.metrics.duration / 1000).toFixed(1)}{t('msg.time')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
