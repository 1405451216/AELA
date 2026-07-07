import { logError } from '../lib/logger'
import { useEffect, useState } from 'react'
import { useConfigStore } from '../stores/configStore'
import { useViewStore } from '../stores/viewStore'
import { useT } from '../i18n'
import type { AppConfig, PromptVariantInfo } from '@shared/types'
import ModelConfigView from './ModelConfigView'
import MCPManagerView from './MCPManagerView'
import { CostSettings, ContextWindowSettings, HITLSettings, AuditSettings, PromptSettings, SecuritySettings, TelemetryDebugSettings, ToolManagementSettings } from './APSettingsViews'
import DashboardView from './DashboardView'
import OrchestrationView from './OrchestrationView'
import HooksView from './HooksView'
import AgentConfigView from './AgentConfigView'
import MemorySearchView from './MemorySearchView'
import OrchestrationTemplatesView from './OrchestrationTemplatesView'
import ObservabilityDashboardView from './ObservabilityDashboardView'
import FewShotWeightView from './FewShotWeightView'
import ToolLearningView from './ToolLearningView'
import SecurityPresetView from './SecurityPresetView'
import SessionManagerView from './SessionManagerView'
import AdaptiveLearningView from './AdaptiveLearningView'
import ResilienceView from './ResilienceView'
import SDKToolsView from './SDKToolsView'

type SettingsTab = 'system' | 'models' | 'mcp' | 'commands' | 'rules' | 'cost' | 'context' | 'hitl' | 'audit' | 'prompt' | 'security' | 'telemetry' | 'tools' | 'dashboard' | 'orchestration' | 'hooks' | 'agentconfig' | 'memorySearch' | 'orchTemplates' | 'observability' | 'fewShotWeight' | 'toolLearning' | 'securityPreset' | 'sessionManager' | 'adaptiveLearning' | 'resilience' | 'sdkTools'

export default function SettingsView() {
  const t = useT()
  const appConfig = useConfigStore(s => s.appConfig)
  const setAppConfig = useConfigStore(s => s.setAppConfig)
  const theme = useConfigStore(s => s.theme)
  const setTheme = useConfigStore(s => s.setTheme)
  const language = useConfigStore(s => s.language)
  const setLanguage = useConfigStore(s => s.setLanguage)
  const fontSize = useConfigStore(s => s.fontSize)
  const setFontSize = useConfigStore(s => s.setFontSize)
  const setError = useViewStore(s => s.setError)
  const [form, setForm] = useState<AppConfig | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTab>('system')
  const [variants, setVariants] = useState<PromptVariantInfo[]>([])

  const TABS: Array<{ key: SettingsTab; label: string; icon: string; group?: 'config' | 'tools' }> = [
    // 配置类
    { key: 'system', label: t('settings.tab.system'), icon: '⚙️', group: 'config' },
    { key: 'models', label: t('settings.tab.models'), icon: '🤖', group: 'config' },
    { key: 'mcp', label: t('settings.tab.mcp'), icon: '🔌', group: 'config' },
    { key: 'commands', label: t('settings.tab.commands'), icon: '⌘', group: 'config' },
    { key: 'rules', label: t('settings.tab.rules'), icon: '🧠', group: 'config' },
    { key: 'cost', label: t('settings.tab.cost'), icon: '💰', group: 'config' },
    { key: 'context', label: t('settings.tab.context'), icon: '📐', group: 'config' },
    { key: 'hitl', label: t('settings.tab.hitl'), icon: '🤝', group: 'config' },
    { key: 'audit', label: t('settings.tab.audit'), icon: '📋', group: 'config' },
    { key: 'prompt', label: t('settings.tab.prompt'), icon: '📝', group: 'config' },
    { key: 'security', label: t('settings.tab.security'), icon: '🛡️', group: 'config' },
    { key: 'telemetry', label: t('settings.tab.telemetry'), icon: '📡', group: 'config' },
    { key: 'tools', label: t('settings.tab.tools'), icon: '🔧', group: 'config' },
    // 工具类（从侧边栏迁移）
    { key: 'dashboard', label: t('settings.tab.dashboard'), icon: '📊', group: 'tools' },
    { key: 'orchestration', label: t('settings.tab.orchestration'), icon: '🔀', group: 'tools' },
    { key: 'hooks', label: t('settings.tab.hooks'), icon: '🪝', group: 'tools' },
    { key: 'agentconfig', label: t('settings.tab.agentconfig'), icon: '🤖', group: 'tools' },
    { key: 'memorySearch', label: t('settings.tab.memorySearch'), icon: '🔍', group: 'tools' },
    { key: 'orchTemplates', label: t('settings.tab.orchTemplates'), icon: '📋', group: 'tools' },
    { key: 'observability', label: t('settings.tab.observability'), icon: '📊', group: 'tools' },
    { key: 'fewShotWeight', label: t('settings.tab.fewShotWeight'), icon: '⚖️', group: 'tools' },
    { key: 'toolLearning', label: t('settings.tab.toolLearning'), icon: '🧠', group: 'tools' },
    { key: 'securityPreset', label: t('settings.tab.securityPreset'), icon: '🛡️', group: 'tools' },
{ key: 'sessionManager', label: t('settings.tab.sessionManager'), icon: '🗂️', group: 'tools' },
  { key: 'adaptiveLearning', label: t('settings.tab.adaptiveLearning'), icon: '🎯', group: 'tools' },
  { key: 'resilience', label: t('settings.tab.resilience'), icon: '🛡️', group: 'tools' },
  { key: 'sdkTools', label: t('settings.tab.sdkTools'), icon: '🧩', group: 'tools' },
]

  useEffect(() => {
    window.aela?.prompt?.variantsList?.().then(setVariants).catch((err) => logError('settings.promptVariants', err))
  }, [])

  useEffect(() => {
    if (appConfig) {
      setForm({
        ...appConfig,
        globalMemory: appConfig.globalMemory ?? '',
        customRules: appConfig.customRules ?? '',
        includeAgentsMd: appConfig.includeAgentsMd ?? false,
        includeClaudeMd: appConfig.includeClaudeMd ?? false,
        slashCommands: appConfig.slashCommands ?? [],
      })
    } else {
      // 如果 appConfig 尚未加载，尝试直接获取
      window.aela?.config?.get?.().then((cfg) => {
        if (cfg) {
          setForm({
            ...cfg,
            globalMemory: cfg.globalMemory ?? '',
            customRules: cfg.customRules ?? '',
            includeAgentsMd: cfg.includeAgentsMd ?? false,
            includeClaudeMd: cfg.includeClaudeMd ?? false,
            slashCommands: cfg.slashCommands ?? [],
          })
        }
      }).catch((err) => {
        console.error('[SettingsView] Failed to load config:', err)
      })
    }
  }, [appConfig])

  const handleSave = async () => {
    if (!form) return
    try {
      const updated = await window.aela.config.set(form)
      setAppConfig(updated)
      setError(null)
    } catch (err: unknown) {
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 主题切换（即时生效 + 持久化）
  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme)
    setForm({ ...form!, theme: newTheme })
  }

  // 语言切换（即时生效 + 持久化）
  const handleLanguageChange = (lang: 'zh' | 'en') => {
    setLanguage(lang)
    setForm({ ...form!, language: lang })
  }

  // 字体大小（即时生效 + 持久化）
  const handleFontSizeChange = (size: number) => {
    setFontSize(size)
    setForm({ ...form!, fontSize: size })
  }

  if (!form) {
    return <div className="flex-1 flex items-center justify-center text-text-muted">{t('common.loading')}</div>
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* 左侧 Tab 导航 */}
      <div className="w-56 border-r border-border bg-bg-secondary/50 flex flex-col">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-base font-bold text-text-primary">{t('settings.title')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {/* 配置类 */}
          {TABS.filter(t => t.group !== 'tools').map(tab => (
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
              {tab.label}
            </button>
          ))}
          {/* 分隔线 */}
          <div className="px-3 py-1.5 mt-2 mb-1">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">{t('settings.tab.toolsGroup')}</span>
          </div>
          {/* 工具类 */}
          {TABS.filter(t => t.group === 'tools').map(tab => (
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
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 overflow-y-auto">
        {/* ===== 系统设置 ===== */}
        {activeTab === 'system' && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h3 className="text-lg font-semibold text-text-primary">{t('settings.tab.system')}</h3>

            {/* 主题 */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-text-primary">{t('settings.theme')}</label>
              <div className="flex gap-3">
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                    theme === 'dark'
                      ? 'border-accent bg-accent/10 text-accent-light'
                      : 'border-border text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  🌙 {t('settings.dark')}
                </button>
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                    theme === 'light'
                      ? 'border-accent bg-accent/10 text-accent-light'
                      : 'border-border text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  ☀️ {t('settings.light')}
                </button>
              </div>
            </div>

            {/* 语言 & 字体大小 */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
              <label className="text-sm font-medium text-text-primary">{t('settings.interface')}</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">{t('settings.language')}</label>
                  <select
                    value={language}
                    onChange={(e) => handleLanguageChange(e.target.value as 'zh' | 'en')}
                    className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5">{t('settings.fontSize')}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="12"
                      max="20"
                      value={fontSize}
                      onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <span className="text-sm text-text-secondary w-8 text-center">{fontSize}px</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sendOnEnter}
                    onChange={(e) => setForm({ ...form, sendOnEnter: e.target.checked })}
                    className="accent-accent"
                  />
                  {t('settings.sendOnEnter')}
                </label>
              </div>
            </div>

            {/* 提示词变体 */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-text-primary">{t('settings.promptVariant')}</label>
              <p className="text-xs text-text-muted">{t('settings.promptVariantDesc')}</p>
              <div className="space-y-2">
                {variants.map(v => (
                  <button
                    key={v.name}
                    onClick={() => setForm({ ...form, promptVariant: v.name })}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-colors ${
                      form.promptVariant === v.name
                        ? 'border-accent bg-accent/10 text-accent-light'
                        : 'border-border text-text-secondary hover:bg-surface-hover'
                    }`}
                  >
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">{v.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 系统提示词 */}
            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
              <label className="text-sm font-medium text-text-primary">{t('settings.defaultPrompt')}</label>
              <p className="text-xs text-text-muted">{t('settings.defaultPromptDesc')}</p>
              <textarea
                value={form.defaultSystemPrompt}
                onChange={(e) => setForm({ ...form, defaultSystemPrompt: e.target.value })}
                rows={3}
                className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none resize-none"
                placeholder={t('settings.defaultPromptPlaceholder')}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-muted mb-1">{t('settings.maxTurns')}</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.maxTurns}
                    onChange={(e) => setForm({ ...form, maxTurns: parseInt(e.target.value) })}
                    className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">{t('settings.maxMessages')}</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={form.maxMessages}
                    onChange={(e) => setForm({ ...form, maxMessages: parseInt(e.target.value) })}
                    className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
            >
              {t('settings.save')}
            </button>
          </div>
        )}

        {/* ===== 模型配置 ===== */}
        {activeTab === 'models' && <ModelConfigView />}

        {/* ===== MCP 配置 ===== */}
        {activeTab === 'mcp' && <MCPManagerView />}

        {/* ===== 自定义命令 ===== */}
        {activeTab === 'commands' && (
          <CommandsSettings form={form} setForm={setForm} onSave={handleSave} />
        )}

        {/* ===== 规则与记忆 ===== */}
        {activeTab === 'rules' && (
          <RulesSettings form={form} setForm={setForm} onSave={handleSave} />
        )}

        {/* ===== 成本与预算 ===== */}
        {activeTab === 'cost' && <CostSettings />}

        {/* ===== 上下文管理 ===== */}
        {activeTab === 'context' && <ContextWindowSettings />}

        {/* ===== 人机协作 ===== */}
        {activeTab === 'hitl' && <HITLSettings />}

        {/* ===== 审计日志 ===== */}
        {activeTab === 'audit' && <AuditSettings />}

        {/* ===== 提示词模板 ===== */}
        {activeTab === 'prompt' && <PromptSettings />}

        {/* ===== 安全与护栏 ===== */}
        {activeTab === 'security' && <SecuritySettings />}

        {/* ===== 遥测与调试 ===== */}
        {activeTab === 'telemetry' && <TelemetryDebugSettings />}

        {/* ===== 工具管理 ===== */}
        {activeTab === 'tools' && <ToolManagementSettings />}

        {/* ===== 从侧边栏迁移的功能模块 ===== */}
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'orchestration' && <OrchestrationView />}
        {activeTab === 'hooks' && <HooksView />}
        {activeTab === 'agentconfig' && <AgentConfigView />}
        {activeTab === 'memorySearch' && <MemorySearchView />}
        {activeTab === 'orchTemplates' && <OrchestrationTemplatesView />}
        {activeTab === 'observability' && <ObservabilityDashboardView />}
        {activeTab === 'fewShotWeight' && <FewShotWeightView />}
        {activeTab === 'toolLearning' && <ToolLearningView />}
        {activeTab === 'securityPreset' && <SecurityPresetView />}
        {activeTab === 'sessionManager' && <SessionManagerView />}
{activeTab === 'adaptiveLearning' && <AdaptiveLearningView />}
{activeTab === 'resilience' && <ResilienceView />}
{activeTab === 'sdkTools' && <SDKToolsView onError={(msg) => setError(msg)} />}
      </div>
    </div>
  )
}

// ===== 自定义命令设置 =====
function CommandsSettings({
  form,
  setForm,
  onSave
}: {
  form: AppConfig
  setForm: (config: AppConfig) => void
  onSave: () => void
}) {
  const t = useT()
  const [newCommand, setNewCommand] = useState({ command: '', description: '', prompt: '' })

  const handleAdd = () => {
    if (!newCommand.command.trim() || !newCommand.prompt.trim()) return
    const cmd = newCommand.command.trim().startsWith('/')
      ? newCommand.command.trim()
      : '/' + newCommand.command.trim()
    setForm({
      ...form,
      slashCommands: [...form.slashCommands, { command: cmd, description: newCommand.description.trim(), prompt: newCommand.prompt.trim() }]
    })
    setNewCommand({ command: '', description: '', prompt: '' })
  }

  const handleDelete = (index: number) => {
    setForm({ ...form, slashCommands: form.slashCommands.filter((_, i) => i !== index) })
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('settings.commands')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('settings.commandsDesc')} <code className="bg-surface px-1 rounded text-accent-light">/{t('settings.cmdName')}</code> {t('settings.quickInsert')}</p>
      </div>

      {/* 已有命令列表 */}
      <div className="space-y-2">
        {form.slashCommands.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8 bg-surface/50 border border-dashed border-border rounded-xl">
            {t('settings.noCommands')}
          </div>
        ) : (
          form.slashCommands.map((cmd, i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-medium text-accent-light bg-accent/10 px-2 py-0.5 rounded">{cmd.command}</code>
                  {cmd.description && <span className="text-xs text-text-muted">{cmd.description}</span>}
                </div>
                <button
                  onClick={() => handleDelete(i)}
                  className="text-text-muted hover:text-red-400 text-sm transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-text-secondary font-mono bg-bg-primary/50 px-2 py-1.5 rounded line-clamp-2">
                {cmd.prompt}
              </p>
            </div>
          ))
        )}
      </div>

      {/* 新建命令表单 */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-medium text-text-primary">{t('settings.newCommand')}</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('settings.cmdName')}</label>
            <div className="flex items-center">
              <span className="text-text-muted text-sm mr-1">/</span>
              <input
                type="text"
                value={newCommand.command.replace(/^\//, '')}
                onChange={(e) => setNewCommand({ ...newCommand, command: e.target.value })}
                placeholder="review"
                className="flex-1 bg-bg-primary text-text-primary rounded-lg px-2 py-2 text-sm border border-border focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">{t('settings.cmdDesc')}</label>
            <input
              type="text"
              value={newCommand.description}
              onChange={(e) => setNewCommand({ ...newCommand, description: e.target.value })}
              placeholder={t('settings.codeReview')}
              className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1">{t('settings.cmdPrompt')}</label>
          <textarea
            value={newCommand.prompt}
            onChange={(e) => setNewCommand({ ...newCommand, prompt: e.target.value })}
            rows={3}
            placeholder="..."
            className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none resize-none"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newCommand.command.trim() || !newCommand.prompt.trim()}
          className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
        >
          {t('settings.addCommand')}
        </button>
      </div>

      <button
        onClick={onSave}
        className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
      >
        {t('settings.save')}
      </button>
    </div>
  )
}

// ===== 规则与记忆设置 =====
function RulesSettings({
  form,
  setForm,
  onSave
}: {
  form: AppConfig
  setForm: (config: AppConfig) => void
  onSave: () => void
}) {
  const t = useT()
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('settings.rules')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('settings.rulesDesc')}</p>
      </div>

      {/* 全局记忆 */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-sm font-medium text-text-primary">{t('settings.globalMemory')}</label>
          <p className="text-xs text-text-muted mt-0.5">{t('settings.globalMemoryDesc')}</p>
        </div>
        <textarea
          value={form.globalMemory}
          onChange={(e) => setForm({ ...form, globalMemory: e.target.value })}
          rows={5}
          className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none resize-none font-mono"
        />
      </div>

      {/* 自定义规则 */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div>
          <label className="text-sm font-medium text-text-primary">{t('settings.customRules')}</label>
          <p className="text-xs text-text-muted mt-0.5">{t('settings.customRulesDesc')}</p>
        </div>
        <textarea
          value={form.customRules}
          onChange={(e) => setForm({ ...form, customRules: e.target.value })}
          rows={5}
          className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none resize-none font-mono"
        />
      </div>

      {/* 上下文文件包含 */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
        <label className="text-sm font-medium text-text-primary">{t('settings.contextFiles')}</label>
        <p className="text-xs text-text-muted">{t('settings.contextFilesDesc')}</p>

        {/* AGENTS.md */}
        <div className="flex items-start justify-between gap-3 p-3 bg-bg-primary/50 rounded-lg border border-border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <code className="text-sm font-medium text-text-primary bg-surface px-2 py-0.5 rounded">AGENTS.md</code>
            </div>
          </div>
          <ToggleSwitch
            checked={form.includeAgentsMd}
            onChange={(v) => setForm({ ...form, includeAgentsMd: v })}
          />
        </div>

        {/* CLAUDE.md */}
        <div className="flex items-start justify-between gap-3 p-3 bg-bg-primary/50 rounded-lg border border-border">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <code className="text-sm font-medium text-text-primary bg-surface px-2 py-0.5 rounded">CLAUDE.md</code>
            </div>
          </div>
          <ToggleSwitch
            checked={form.includeClaudeMd}
            onChange={(v) => setForm({ ...form, includeClaudeMd: v })}
          />
        </div>
      </div>

      <button
        onClick={onSave}
        className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
      >
        {t('settings.save')}
      </button>
    </div>
  )
}

// ===== Toggle 开关组件 =====
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-accent' : 'bg-border'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
