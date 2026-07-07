// [升级 6] 安全策略模板
// 预配置的安全等级模板，一键应用 ACL + Guardrail + HITL 配置
import { useState, useEffect, useCallback } from 'react'
import type { SecurityPreset, SecurityPresetLevel } from '@shared/types'

export default function SecurityPresetView() {
  const [presets, setPresets] = useState<SecurityPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [appliedLevel, setAppliedLevel] = useState<SecurityPresetLevel | null>(null)

  const loadPresets = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.aela.securityPreset.list()
      setPresets(list)
    } catch (err) {
      console.error('Failed to load presets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  const handleApply = async (level: SecurityPresetLevel) => {
    if (!confirm(`确定应用 "${level}" 安全策略？这将覆盖当前的安全配置。`)) return
    setApplying(level)
    try {
      await window.aela.securityPreset.apply(level)
      setAppliedLevel(level)
    } catch (err) {
      console.error('Apply preset failed:', err)
    } finally {
      setApplying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-text-muted py-20">加载安全策略中...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🛡️</span>
          <h1 className="text-xl font-bold text-text-primary">安全策略模板</h1>
        </div>
        <p className="text-sm text-text-muted">
          预配置的安全等级，一键应用 ACL 规则、护栏策略和 HITL 中断点
        </p>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        <div className="grid grid-cols-3 gap-4">
          {presets.map(preset => (
            <div
              key={preset.level}
              className={`bg-surface border-2 rounded-xl p-5 transition-all ${
                appliedLevel === preset.level
                  ? 'border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'border-border hover:border-blue-500/50'
              }`}
            >
              {/* 图标 + 等级 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-3xl">
                  {preset.level === 'strict' ? '🔒' :
                   preset.level === 'standard' ? '🔓' : '⚡'}
                </span>
                <div>
                  <h3 className="text-base font-bold text-text-primary">{preset.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    preset.level === 'strict' ? 'bg-red-500/20 text-red-400' :
                    preset.level === 'standard' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {preset.level}
                  </span>
                </div>
              </div>

              <p className="text-xs text-text-muted mb-4">{preset.description}</p>

              {/* ACL 规则数 */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">ACL 规则</span>
                  <span className="text-text-primary font-medium">{preset.config.aclRules.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">护栏规则</span>
                  <span className="text-text-primary font-medium">{preset.guardrailRules.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">HITL 中断点</span>
                  <span className="text-text-primary font-medium">{preset.hitlInterruptPoints.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">允许命令</span>
                  <span className="text-green-400 font-medium">{preset.config.allowedCommands.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">禁止命令</span>
                  <span className="text-red-400 font-medium">{preset.config.blockedCommands.length}</span>
                </div>
              </div>

              {/* 命令列表预览 */}
              {preset.config.blockedCommands.length > 0 && (
                <div className="mb-4">
                  <span className="text-[10px] text-text-muted">禁止的命令:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {preset.config.blockedCommands.slice(0, 5).map((cmd, i) => (
                      <span key={i} className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-mono">
                        {cmd}
                      </span>
                    ))}
                    {preset.config.blockedCommands.length > 5 && (
                      <span className="text-[9px] text-text-muted">+{preset.config.blockedCommands.length - 5}</span>
                    )}
                  </div>
                </div>
              )}

              {/* 应用按钮 */}
              <button
                onClick={() => handleApply(preset.level)}
                disabled={applying !== null}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  appliedLevel === preset.level
                    ? 'bg-blue-600 text-white'
                    : preset.level === 'strict'
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30'
                    : preset.level === 'standard'
                    ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30'
                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/30'
                } disabled:opacity-50`}
              >
                {applying === preset.level ? '应用中...' :
                 appliedLevel === preset.level ? '✓ 已应用' : '应用此策略'}
              </button>
            </div>
          ))}
        </div>

        {/* 说明 */}
        <div className="mt-6 bg-surface border border-border rounded-lg p-4">
          <h3 className="text-sm font-medium text-text-primary mb-2">📋 策略说明</h3>
          <div className="space-y-2 text-xs text-text-muted">
            <p><span className="text-red-400 font-medium">Strict（严格）:</span> 所有工具调用需确认，禁止危险命令，启用注入检测和 PII 脱敏</p>
            <p><span className="text-blue-400 font-medium">Standard（标准）:</span> 高风险工具需确认，启用基础护栏，平衡安全与效率</p>
            <p><span className="text-green-400 font-medium">Relaxed（宽松）:</span> 自动批准大部分工具，仅保留关键安全检查，适合可信环境</p>
          </div>
        </div>
      </div>
    </div>
  )
}
