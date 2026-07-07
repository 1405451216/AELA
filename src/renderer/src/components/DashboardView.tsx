import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import type { ViewType } from '../stores/viewStore'
import type { HookConfigSummary, CostSummary } from '@shared/types'
import { logError } from '../lib/logger'

interface QuickStat {
  label: string
  value: string | number
  icon: string
  color: string
}

interface AdvantageCard {
  title: string
  icon: string
  description: string
  features: string[]
  gradient: string
  action?: { label: string; view: ViewType }
}

const ADVANTAGES: AdvantageCard[] = [
  {
    title: '协作辩论模式',
    icon: '🎭',
    description: '多 Agent 角色对抗 + 辩论收敛，通过 Critic → Reflector → Builder 三角协作产出更高质量的结果',
    features: [
      'Builder 负责生成初始方案',
      'Critic 从安全/性能/架构多维度批判',
      'Reflector 综合反馈迭代改进',
      '支持 Pipeline / Parallel / Handoff / Pool 四种编排',
    ],
    gradient: 'from-purple-600/20 to-blue-600/20',
    action: { label: '进入编排', view: 'orchestration' },
  },
  {
    title: '成本感知中断',
    icon: '💰',
    description: '实时追踪每次 LLM 调用的 Token 消耗和费用，预算超限时自动触发 HITL 中断',
    features: [
      '按模型/会话/Agent 维度统计成本',
      '支持设置预算上限和告警阈值',
      '超预算自动暂停并请求人工确认',
      '内置主流模型价格表，自动计算费用',
    ],
    gradient: 'from-green-600/20 to-teal-600/20',
  },
  {
    title: '工具学习闭环',
    icon: '🧠',
    description: 'Agent 自动记录工具调用的成功/失败经验，形成 Best Practices 指导后续操作',
    features: [
      '自动记录成功工具调用模式',
      '失败时记录错误原因和上下文',
      '基于相似度检索历史经验',
      'Few-Shot 示例自动注入提示词',
    ],
    gradient: 'from-orange-600/20 to-red-600/20',
  },
  {
    title: '6 种角色变体',
    icon: '🎨',
    description: 'PromptBuilder 支持 6 种提示词变体，让同一 Agent 展现不同专业角色',
    features: [
      'architect — 架构设计师视角',
      'reviewer — 代码审查者视角',
      'debugger — 调试专家视角',
      'optimizer — 性能优化师视角',
      'documenter — 文档编写者视角',
      'explorer — 探索分析师视角',
    ],
    gradient: 'from-indigo-600/20 to-purple-600/20',
  },
  {
    title: 'ResilientProvider',
    icon: '🛡️',
    description: '自动重试 + 熔断器 + Fallback 链，保障 LLM 调用的高可用性',
    features: [
      '指数退避重试（可配次数和间隔）',
      '熔断器模式防止级联故障',
      '多模型 Fallback 自动切换',
      '实时监控 Provider 健康状态',
    ],
    gradient: 'from-cyan-600/20 to-blue-600/20',
  },
]

const PLATFORM_FEATURES = [
  { icon: '🔀', label: '多模式编排', desc: 'Pipeline / Parallel / DAG / Collaboration' },
  { icon: '🔒', label: '安全沙箱', desc: 'ACL + Guardrail + Shell 风险评估' },
  { icon: '📊', label: '可观测性', desc: 'Tracing + Metrics + Audit Log' },
  { icon: '💵', label: '成本控制', desc: 'Token 计费 + 预算中断 + HITL' },
  { icon: '🪝', label: '用户 Hooks', desc: '10 个生命周期 Hook 点可配置' },
  { icon: '📚', label: 'RAG 管道', desc: '文档摄入 + 向量检索 + 上下文增强' },
]

export default function DashboardView() {
  const { setView } = useAppStore()
  const [hookSummary, setHookSummary] = useState<HookConfigSummary | null>(null)
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [sessionCount, setSessionCount] = useState(0)

  const loadData = useCallback(async () => {
    try {
      const [hooks, cost, sessions] = await Promise.all([
        window.aela.hookConfig.summary().catch((err) => { logError('dashboard.hookSummary', err); return null }),
        window.aela.cost?.summary?.().catch((err) => { logError('dashboard.costSummary', err); return null }) || null,
        window.aela.session.list().catch((err) => { logError('dashboard.sessionList', err); return [] }),
      ])
      setHookSummary(hooks)
      setCostSummary(cost)
      setSessionCount(Array.isArray(sessions) ? sessions.length : 0)
    } catch {
      // 忽略错误
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const quickStats: QuickStat[] = [
    { label: '会话数', value: sessionCount, icon: '💬', color: 'text-blue-400' },
    { label: 'Hook 规则', value: hookSummary?.enabledRules || 0, icon: '🪝', color: 'text-orange-400' },
    { label: '总费用', value: `$${costSummary?.totalCostUSD?.toFixed(4) || '0.0000'}`, icon: '💰', color: 'text-green-400' },
    { label: 'Token 用量', value: costSummary?.totalTokens || 0, icon: '🔤', color: 'text-purple-400' },
  ]

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 顶部 Hero 区域 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-bg-secondary via-bg-primary to-bg-secondary border-b border-border">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, var(--accent-primary) 0%, transparent 50%), radial-gradient(circle at 80% 50%, var(--accent-secondary) 0%, transparent 50%)',
        }} />
        <div className="relative max-w-5xl mx-auto px-8 py-12">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">⚡</span>
            <h1 className="text-3xl font-bold text-text-primary">AELA</h1>
            <span className="text-sm text-text-muted bg-surface px-2 py-0.5 rounded">v0.2.0</span>
          </div>
          <p className="text-lg text-text-secondary">
            AI Agent <span className="text-text-primary font-medium">工程平台</span>
          </p>
          <p className="text-sm text-text-muted mt-2 max-w-2xl">
            强调编排、安全、可观测、成本控制，面向企业开发团队。
            让 AI Agent 的每一步操作都可追溯、可控制、可优化。
          </p>

          {/* 快速统计 */}
          <div className="grid grid-cols-4 gap-3 mt-8">
            {quickStats.map(stat => (
              <div key={stat.label} className="bg-surface/60 backdrop-blur rounded-xl border border-border/50 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{stat.icon}</span>
                  <span className="text-xs text-text-muted">{stat.label}</span>
                </div>
                <div className={`text-2xl font-bold mt-1 ${stat.color}`}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 平台特性 */}
      <div className="max-w-5xl mx-auto px-8 py-8">
        <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-4">平台能力</h2>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PLATFORM_FEATURES.map(feat => (
            <div
              key={feat.label}
              className="bg-surface border border-border rounded-lg p-3 hover:border-blue-500/50 transition-colors cursor-default"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{feat.icon}</span>
                <span className="text-sm font-medium text-text-primary">{feat.label}</span>
              </div>
              <p className="text-xs text-text-muted">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* 5 大独有优势 */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-text-muted uppercase tracking-wider">
            独有优势
          </h2>
          <span className="text-[10px] text-text-muted bg-surface px-2 py-0.5 rounded border border-border">
            竞品不具备
          </span>
        </div>

        <div className="space-y-3">
          {ADVANTAGES.map((adv, idx) => (
            <div
              key={adv.title}
              className={`relative overflow-hidden rounded-xl border border-border bg-gradient-to-r ${adv.gradient} p-5`}
            >
              <div className="flex items-start gap-4">
                {/* 编号 + 图标 */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-muted">#{idx + 1}</span>
                  <span className="text-3xl">{adv.icon}</span>
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-text-primary">{adv.title}</h3>
                    {adv.action && (
                      <button
                        onClick={() => setView(adv.action?.view ?? 'chat')}
                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {adv.action.label} →
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mt-1">{adv.description}</p>

                  {/* 特性列表 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
                    {adv.features.map((feat, fi) => (
                      <div key={fi} className="flex items-center gap-1.5 text-xs text-text-muted">
                        <span className="text-green-400 flex-shrink-0">✓</span>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部 CTA */}
        <div className="mt-8 flex items-center justify-center gap-3 pb-8">
          <button
            onClick={() => setView('chat')}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            开始对话
          </button>
          <button
            onClick={() => setView('hooks')}
            className="px-6 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-secondary text-sm font-medium transition-colors"
          >
            配置 Hooks
          </button>
          <button
            onClick={() => setView('terminal')}
            className="px-6 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-secondary text-sm font-medium transition-colors"
          >
            打开终端
          </button>
        </div>
      </div>
    </div>
  )
}
