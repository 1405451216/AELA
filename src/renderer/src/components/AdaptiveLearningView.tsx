// [进化 1] Agent 自适应学习 — 学习档案面板
// 展示 Agent 学习进度、经验规则、自适应提示、强弱项分析
import { useState, useEffect, useCallback } from 'react'
import type { AdaptiveLearningProfile, AdaptiveHint, LearningProgress } from '@shared/types'

export default function AdaptiveLearningView() {
  const [profile, setProfile] = useState<AdaptiveLearningProfile | null>(null)
  const [hints, setHints] = useState<AdaptiveHint[]>([])
  const [progress, setProgress] = useState<LearningProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, h, prog] = await Promise.all([
        window.aela.adaptive.getProfile(),
        window.aela.adaptive.getHints(),
        window.aela.adaptive.getProgress(),
      ])
      setProfile(p)
      setHints(h)
      setProgress(prog)
    } catch (err) {
      console.error('Failed to load adaptive learning data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleExtractRules = async () => {
    setExtracting(true)
    try {
      await window.aela.adaptive.extractRules()
      await load()
    } catch (err) {
      console.error('Rule extraction failed:', err)
    } finally {
      setExtracting(false)
    }
  }

  const handleClear = async () => {
    if (!confirm('确定清空 Agent 学习档案？所有积累的经验规则将被删除。')) return
    try {
      await window.aela.adaptive.clearProfile()
      await load()
    } catch (err) {
      console.error('Clear failed:', err)
    }
  }

  if (loading && !profile) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-text-muted py-20">加载学习档案中...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-text-muted py-20">暂无数据</div>
      </div>
    )
  }

  const successRate = profile.totalInteractions > 0
    ? (profile.successfulInteractions / profile.totalInteractions * 100).toFixed(1)
    : '0.0'

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎯</span>
          <h1 className="text-xl font-bold text-text-primary">Agent 自适应学习</h1>
        </div>
        <p className="text-sm text-text-muted">
          经验规则积累 · 自适应提示注入 · 越用越聪明的 Agent
        </p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleExtractRules}
            disabled={extracting}
            className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {extracting ? '提取中...' : '手动提取规则'}
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-bg-secondary text-text-primary rounded-lg text-sm font-medium hover:bg-bg-tertiary transition-colors border border-border"
          >
            清空档案
          </button>
          <button
            onClick={load}
            className="px-4 py-2 bg-bg-secondary text-text-primary rounded-lg text-sm font-medium hover:bg-bg-tertiary transition-colors border border-border"
          >
            刷新
          </button>
        </div>
      </div>

      {/* 学习进度总览 */}
      <div className="px-8 py-6 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary mb-4">学习进度</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <div className="text-3xl font-bold text-accent mb-1">{profile.learningProgress}%</div>
            <div className="text-xs text-text-muted">学习进度</div>
          </div>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <div className="text-3xl font-bold text-text-primary mb-1">{profile.totalInteractions}</div>
            <div className="text-xs text-text-muted">总交互次数</div>
          </div>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <div className="text-3xl font-bold text-green-400 mb-1">{successRate}%</div>
            <div className="text-xs text-text-muted">成功率</div>
          </div>
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <div className="text-3xl font-bold text-blue-400 mb-1">{profile.learnedRules.length}</div>
            <div className="text-xs text-text-muted">已学规则数</div>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-text-muted">整体学习进度</span>
            <span className="text-sm text-text-primary">{profile.learningProgress}%</span>
          </div>
          <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-blue-400 transition-all duration-500"
              style={{ width: `${profile.learningProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* 自适应提示 */}
      {hints.length > 0 && (
        <div className="px-8 py-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            🔄 自适应提示
            <span className="text-sm font-normal text-text-muted ml-2">（注入到 Agent 系统提示词）</span>
          </h2>
          <div className="space-y-3">
            {hints.map((hint, i) => (
              <div
                key={i}
                className={`rounded-xl p-4 border ${
                  hint.priority === 'high'
                    ? 'bg-red-500/10 border-red-500/30'
                    : hint.priority === 'medium'
                    ? 'bg-yellow-500/10 border-yellow-500/30'
                    : 'bg-blue-500/10 border-blue-500/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    hint.priority === 'high'
                      ? 'bg-red-500/20 text-red-400'
                      : hint.priority === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {hint.priority === 'high' ? '高优先级' : hint.priority === 'medium' ? '中优先级' : '低优先级'}
                  </span>
                  <span className="text-xs text-text-muted">{hint.category}</span>
                </div>
                <p className="text-sm text-text-primary">{hint.hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 经验规则列表 */}
      <div className="px-8 py-6 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary mb-4">已学习的经验规则</h2>
        {profile.learnedRules.length === 0 ? (
          <div className="text-center text-text-muted py-8">
            暂无经验规则。Agent 完成 10 次交互后会自动提取规则，或点击「手动提取规则」。
          </div>
        ) : (
          <div className="space-y-3">
            {profile.learnedRules.slice(0, 20).map((rule) => (
              <div key={rule.id} className="bg-bg-secondary rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCategoryColor(rule.category)}`}>
                      {getCategoryLabel(rule.category)}
                    </span>
                    <span className="text-sm font-medium text-text-primary">{rule.pattern}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>置信度: {(rule.confidence * 100).toFixed(0)}%</span>
                    <span>·</span>
                    <span>出现 {rule.occurrences} 次</span>
                  </div>
                </div>
                <p className="text-sm text-text-muted mb-2">{rule.description}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${rule.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted">
                    成功率 {(rule.successRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 强弱项分析 */}
      <div className="px-8 py-6 border-b border-border">
        <div className="grid grid-cols-2 gap-6">
          {/* 强项 */}
          <div>
            <h3 className="text-md font-semibold text-green-400 mb-3 flex items-center gap-2">
              <span>✅</span> 擅长领域
            </h3>
            {profile.strengths.length === 0 ? (
              <p className="text-sm text-text-muted">暂无足够数据</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.strengths.map((s, i) => (
                  <span key={i} className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm border border-green-500/20">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* 弱项 */}
          <div>
            <h3 className="text-md font-semibold text-orange-400 mb-3 flex items-center gap-2">
              <span>⚠️</span> 待改进领域
            </h3>
            {profile.weakAreas.length === 0 ? (
              <p className="text-sm text-text-muted">暂无足够数据</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {profile.weakAreas.map((w, i) => (
                  <span key={i} className="px-3 py-1 bg-orange-500/10 text-orange-400 rounded-full text-sm border border-orange-500/20">
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 类别统计 */}
      {progress && Object.keys(progress.categoryStats).length > 0 && (
        <div className="px-8 py-6 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary mb-4">规则类别统计</h2>
          <div className="space-y-2">
            {Object.entries(progress.categoryStats).map(([cat, stats]) => (
              <div key={cat} className="flex items-center justify-between bg-bg-secondary rounded-lg p-3 border border-border">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getCategoryColor(cat as AdaptiveLearningProfile['learnedRules'][0]['category'])}`}>
                    {getCategoryLabel(cat as AdaptiveLearningProfile['learnedRules'][0]['category'])}
                  </span>
                  <span className="text-sm text-text-primary">{stats.rules} 条规则</span>
                </div>
                <span className="text-sm text-text-muted">平均成功率 {(stats.avgSuccessRate * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近改进 */}
      {progress && progress.recentImprovements.length > 0 && (
        <div className="px-8 py-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">最近改进</h2>
          <div className="space-y-2">
            {progress.recentImprovements.map((imp, i) => (
              <div key={i} className="flex items-center gap-3 bg-green-500/5 rounded-lg p-3 border border-green-500/10">
                <span className="text-green-400">📈</span>
                <div className="flex-1">
                  <span className="text-sm text-text-primary">{imp.description}</span>
                  <span className="text-xs text-text-muted ml-2">
                    {(imp.before * 100).toFixed(0)}% → {(imp.after * 100).toFixed(0)}%
                  </span>
                </div>
                <span className="text-xs text-text-muted">{new Date(imp.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    tool_usage: 'bg-blue-500/20 text-blue-400',
    prompt_pattern: 'bg-purple-500/20 text-purple-400',
    error_avoidance: 'bg-red-500/20 text-red-400',
    task_strategy: 'bg-green-500/20 text-green-400',
  }
  return map[category] || 'bg-gray-500/20 text-gray-400'
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    tool_usage: '工具使用',
    prompt_pattern: '提示模式',
    error_avoidance: '错误规避',
    task_strategy: '任务策略',
  }
  return map[category] || category
}
