// 高/中优先级 AP 特性的设置面板
// 包含: 成本与预算 / 上下文管理 / 人机协作 / 审计日志 / 提示词模板 / 安全与护栏 / 遥测与调试 / 工具管理
//
// 本文件为 AP 特性面板的主容器:
//   - 默认导出 APSettingsViews：Tab 容器，管理 activeTab 状态并调度各面板渲染
//   - 命名导出各子面板：供 SettingsView 等外部容器直接引用
//
// 各子面板独立位于 components/settings/ 目录下。

import { useState } from 'react'
import { useT } from '../i18n'

import { CostSettings } from './settings/CostSettings'
import { ContextWindowSettings } from './settings/ContextWindowSettings'
import { HITLSettings } from './settings/HITLSettings'
import { AuditSettings } from './settings/AuditSettings'
import { PromptSettings } from './settings/PromptSettings'
import { SecuritySettings } from './settings/SecuritySettings'
import { TelemetryDebugSettings } from './settings/TelemetryDebugSettings'
import { ToolManagementSettings } from './settings/ToolManagementSettings'

// 重新导出：保持对 SettingsView.tsx 等现有调用方的向后兼容
export { CostSettings } from './settings/CostSettings'
export { ContextWindowSettings } from './settings/ContextWindowSettings'
export { HITLSettings } from './settings/HITLSettings'
export { AuditSettings } from './settings/AuditSettings'
export { PromptSettings } from './settings/PromptSettings'
export { SecuritySettings } from './settings/SecuritySettings'
export { TelemetryDebugSettings } from './settings/TelemetryDebugSettings'
export { ToolManagementSettings } from './settings/ToolManagementSettings'

type APSettingsTab =
  | 'cost'
  | 'context'
  | 'hitl'
  | 'audit'
  | 'prompt'
  | 'security'
  | 'telemetry'
  | 'tools'

interface TabDef {
  key: APSettingsTab
  label: string
  icon: string
}

const TABS: TabDef[] = [
  { key: 'cost', label: 'ap.tab.cost', icon: '💰' },
  { key: 'context', label: 'ap.tab.context', icon: '📐' },
  { key: 'hitl', label: 'ap.tab.hitl', icon: '🤝' },
  { key: 'audit', label: 'ap.tab.audit', icon: '📋' },
  { key: 'prompt', label: 'ap.tab.prompt', icon: '📝' },
  { key: 'security', label: 'ap.tab.security', icon: '🛡️' },
  { key: 'telemetry', label: 'ap.tab.telemetry', icon: '📡' },
  { key: 'tools', label: 'ap.tab.tools', icon: '🔧' },
]

/**
 * AP 特性设置面板容器。
 * 管理 activeTab 状态，渲染 Tab 导航栏并按 tab 调度对应子面板。
 */
export default function APSettingsViews() {
  const t = useT()
  const [activeTab, setActiveTab] = useState<APSettingsTab>('cost')

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* 左侧 Tab 导航 */}
      <div className="w-56 border-r border-border bg-bg-secondary/50 flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-base font-bold text-text-primary">{t('ap.settings.title')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeTab === tab.key
                  ? 'bg-surface-active text-text-primary font-medium'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {t(tab.label)}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'cost' && <CostSettings />}
        {activeTab === 'context' && <ContextWindowSettings />}
        {activeTab === 'hitl' && <HITLSettings />}
        {activeTab === 'audit' && <AuditSettings />}
        {activeTab === 'prompt' && <PromptSettings />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'telemetry' && <TelemetryDebugSettings />}
        {activeTab === 'tools' && <ToolManagementSettings />}
      </div>
    </div>
  )
}
