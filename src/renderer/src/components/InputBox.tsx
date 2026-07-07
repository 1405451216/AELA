// InputBox - 独立组件文件
// 提取为顶级组件，避免 inline 闭包问题

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react'
import type { Skill, ModelConfig, Workspace, SessionContextInfo, PermissionLevel } from '@shared/types'
import { PERMISSION_OPTIONS, getModelContextWindow } from '@shared/types'
import { useT } from '../i18n'
import { WorkIcon, CodeIcon } from '../assets/modes'
import MentionDropdown from './MentionDropdown'
import type { MentionItem } from '../commands/mentionSystem'
import { buildContextText } from '../commands/mentionSystem'
import { useInlineCompletion } from './useInlineCompletion'
import VoiceInput from './chat/VoiceInput'
import { useVoiceStore } from '../stores/voiceStore'

// ===== 模式定义 =====
// systemPrompt 字段现在只传递模式标识给后端 PromptBuilder
// 完整的提示词由后端 PromptBuilder.build() 动态构建
export interface Mode {
  key: string
  label: string
  Icon: React.FC<{ size?: number }>
  systemPrompt: string   // 模式标识：'code' 或 'office'，传给后端
  placeholder: string
  description: string
}

export const MODES: Mode[] = [
  {
    key: 'code',
    label: '', // set dynamically
    Icon: CodeIcon,
    systemPrompt: 'code',
    placeholder: '',
    description: ''
  },
  {
    key: 'office',
    label: '',
    Icon: WorkIcon,
    systemPrompt: 'office',
    placeholder: '',
    description: ''
  }
]

export interface InputBoxProps {
  // 模式
  selectedMode: string
  setSelectedMode: (mode: string) => void
  // Skills
  showSkillPicker: boolean
  setShowSkillPicker: (v: boolean) => void
  activeSkillIds: string[]
  toggleSkill: (id: string) => void
  skills: Skill[]
  // 模型
  currentModelConfig: ModelConfig | null
  onModelClick: () => void
  modelList: ModelConfig[]
  onModelSelect: (model: ModelConfig) => void
  // 工作区
  currentWorkspace: Workspace | null
  onSelectFolder: () => void
  // 输入
  input: string
  setInput: (value: string | ((prev: string) => string)) => void
  isStreaming: boolean
  onSend: () => void
  onStop: () => void
  // 推荐
  recommendations: Array<{ icon: string; label: string; skillId?: string; prompt?: string }>
  onRecommendation: (rec: { icon: string; label: string; skillId?: string; prompt?: string }) => void
  // 是否按 Enter 发送（false 时需要 Shift+Enter 换行，Enter 也换行，需手动点发送）
  sendOnEnter?: boolean
  // 紧凑模式：对话中只显示输入框 + 发送按钮，隐藏模式切换/技能/模型/推荐等
  compact?: boolean
  // 执行权限
  permissionLevel: PermissionLevel
  onPermissionChange: (level: PermissionLevel) => void
  // 上下文信息
  contextInfo: SessionContextInfo | null
  // @-mention 上下文变化回调（可选，父组件用于获取引用的上下文）
  onMentionContextChange?: (contextText: string) => void
}

export interface InputBoxHandle {
  focus: () => void
}

const InputBox = forwardRef<InputBoxHandle, InputBoxProps>(function InputBox(props, ref) {
  const t = useT()
  const {
    selectedMode, setSelectedMode,
    showSkillPicker, setShowSkillPicker,
    activeSkillIds, toggleSkill,
    skills,
    currentModelConfig, onModelClick,
    modelList, onModelSelect,
    currentWorkspace, onSelectFolder,
    input, setInput, isStreaming,
    onSend, onStop,
    recommendations, onRecommendation,
    sendOnEnter = true,
    compact = false,
    permissionLevel, onPermissionChange,
    contextInfo,
    onMentionContextChange,
  } = props

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [showPermissionDropdown, setShowPermissionDropdown] = useState(false)
  const [cursorPos, setCursorPos] = useState(0)
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([])
  const [interimText, setInterimText] = useState('')

  const voiceInputEnabled = useVoiceStore(s => s.voiceInputEnabled)
  const voiceLanguage = useVoiceStore(s => s.voiceLanguage)

  // Inline Completion（Tab 补全）
  const inlineCompletion = useInlineCompletion(
    textareaRef,
    !isStreaming,  // 流式输出时禁用补全
    currentWorkspace?.path || '',
    'typescript',  // 可根据当前文件类型动态调整
    input,
  )

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus()
  }), [])
  const activeSkills = skills.filter(s => activeSkillIds.includes(s.id))

  // 当前模式对象
  const currentMode = MODES.find(m => m.key === selectedMode) || MODES[0]

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && sendOnEnter) {
      // 如果 mention 下拉可见，不触发发送（由 MentionDropdown 处理 Enter）
      const hasMention = detectMentionAtCursor(input, cursorPos)
      if (hasMention) return
      e.preventDefault()
      onSend()
    }
  }

  // 检测当前光标是否在 @-mention 输入中
  const detectMentionAtCursor = (text: string, pos: number): boolean => {
    const before = text.substring(0, pos)
    return /@(\w*)$/.test(before) || /@(file|memory|web):(\S*)$/.test(before)
  }

  // 处理 mention 选中
  const handleMentionSelect = useCallback((item: MentionItem) => {
    setMentionItems(prev => [...prev, item])
    // 从输入文本中移除 @-mention 输入标记
    const before = input.substring(0, cursorPos)
    const after = input.substring(cursorPos)
    // 找到 @ 的位置并移除到光标位置
    const atIdx = before.lastIndexOf('@')
    const newInput = before.substring(0, atIdx) + after
    setInput(newInput)
    // 重新聚焦 textarea
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      const newPos = atIdx
      textareaRef.current?.setSelectionRange(newPos, newPos)
      setCursorPos(newPos)
    })
  }, [input, cursorPos, setInput])

  // 发送时附加 mention 上下文
  useEffect(() => {
    if (input === '' && mentionItems.length > 0) {
      // 输入清空时不清除 mention（保留供下次发送）
    }
  }, [input, mentionItems])

  // 通知父组件 mention 上下文变化
  useEffect(() => {
    if (onMentionContextChange) {
      onMentionContextChange(buildContextText(mentionItems))
    }
  }, [mentionItems, onMentionContextChange])

  const handleVoiceResult = useCallback((text: string) => {
    setInput((prev: string) => prev + text)
    setInterimText('')
  }, [setInput])

  const handleVoiceInterim = useCallback((text: string) => {
    setInterimText(text)
  }, [])

  const adjustTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 320) + 'px'
    }
  }, [])

  // 输入内容变化时（含编程式赋值）自动调整高度
  useEffect(() => {
    adjustTextarea()
  }, [input, adjustTextarea])

  // 触发 inline completion（输入停止 300ms 后）
  useEffect(() => {
    if (!input || isStreaming) return
    inlineCompletion.trigger()
  }, [input, isStreaming, inlineCompletion.trigger])

  // 监听 inline completion 接受事件 → 插入补全文本
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (text) {
        setInput(prev => prev + text)
        // 重新聚焦
        requestAnimationFrame(() => textareaRef.current?.focus())
      }
    }
    window.addEventListener('aela-inline-accept', handler)
    return () => window.removeEventListener('aela-inline-accept', handler)
  }, [setInput])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-model-dropdown]') && !target.closest('[data-model-trigger]')) {
        setShowModelDropdown(false)
      }
      if (!target.closest('[data-permission-dropdown]') && !target.closest('[data-permission-trigger]')) {
        setShowPermissionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 渲染模式段控件（pill 风格切换按钮）
  const renderModeSwitcher = () => (
    <div className="flex items-center bg-bg-secondary border border-border rounded-full p-1.5">
      {MODES.map(mode => {
        const active = selectedMode === mode.key
        return (
          <button
            key={mode.key}
            onClick={() => setSelectedMode(mode.key)}
            disabled={isStreaming}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-full text-base transition-all disabled:opacity-50 ${
              active
                ? 'bg-text-primary text-bg-primary shadow-md font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <mode.Icon size={32} />
          </button>
        )
      })}
    </div>
  )

  // ===== 上下文使用度计算 =====
  const contextWindowSize = currentModelConfig ? getModelContextWindow(currentModelConfig.model) : 8000
  const usedTokens = contextInfo?.estimatedTokens ?? 0
  const usagePercent = contextWindowSize > 0 ? Math.min(100, (usedTokens / contextWindowSize) * 100) : 0
  const remainingTokens = Math.max(0, contextWindowSize - usedTokens)
  const usageColor = usagePercent < 50 ? 'text-green-400' : usagePercent < 80 ? 'text-yellow-400' : 'text-red-400'
  const usageBarColor = usagePercent < 50 ? 'bg-green-500' : usagePercent < 80 ? 'bg-yellow-500' : 'bg-red-500'

  // 当前权限选项
  const currentPermission = PERMISSION_OPTIONS.find(p => p.level === permissionLevel) || PERMISSION_OPTIONS[0]

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* 模式段控件 - 仅新建任务时显示 */}
      {!compact && (
        <div className="flex justify-center mb-5">
          {renderModeSwitcher()}
        </div>
      )}

      {/* 已激活的 skill 标签 - 仅新建任务时显示 */}
      {!compact && activeSkills.length > 0 && (
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {activeSkills.map(s => (
            <span
              key={s.id}
              className="flex items-center gap-1 px-2 py-0.5 bg-accent/15 text-accent-light text-xs rounded-md"
            >
              {s.asTool ? '🔧' : '✦'} {s.name}
              <button
                onClick={() => toggleSkill(s.id)}
                className="hover:text-white ml-0.5"
              >✕</button>
            </span>
          ))}
        </div>
      )}

      {/* 输入框主体 */}
      <div className={`relative bg-bg-primary border border-border rounded-2xl focus-within:border-accent/40 transition-colors shadow-sm overflow-hidden ${compact ? '' : 'mt-3'}`}>
        {/* @-mention 引用标签 */}
        {mentionItems.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 pt-3 flex-wrap">
            {mentionItems.map((item, idx) => (
              <span
                key={`mention-${idx}`}
                className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent-light text-xs rounded-md"
              >
                {item.icon} {item.label}
                <button
                  onClick={() => setMentionItems(prev => prev.filter((_, i) => i !== idx))}
                  className="hover:text-white ml-0.5"
                >✕</button>
              </span>
            ))}
          </div>
        )}
        {/* 文本输入区 */}
        <div className="relative">
          {/* Ghost text 补全层（半透明显示在 textarea 上方） */}
          {inlineCompletion.isVisible && inlineCompletion.completionText && (
            <div
              aria-hidden="true"
              className="absolute inset-0 px-6 pt-5 pb-4 text-[15px] pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
              style={{
                color: 'transparent',
                caretColor: 'transparent',
              }}
            >
              <span className="text-text-primary/30">{inlineCompletion.completionText}</span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustTextarea(); setCursorPos(e.target.selectionStart) }}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
            onClick={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
            placeholder={compact ? t('input.typeMessage') : (currentMode.key === 'code' ? t('input.codePlaceholder') : t('input.dailyPlaceholder'))}
            disabled={isStreaming}
            className="relative w-full bg-transparent text-text-primary px-6 pt-5 pb-4 text-[15px] focus:outline-none resize-none disabled:opacity-50 min-h-[72px] max-h-[320px]"
            rows={1}
          />
        </div>
        {/* @-mention 补全下拉 */}
        <MentionDropdown
          input={input}
          cursorPos={cursorPos}
          workspace={currentWorkspace}
          onSelect={handleMentionSelect}
          visible={!isStreaming}
        />

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 gap-2">
          {/* 左侧：技能 + 权限 */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* 技能按钮 - 始终显示 */}
            <button
              onClick={() => setShowSkillPicker(!showSkillPicker)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors shrink-0 ${
                activeSkillIds.length > 0 || showSkillPicker
                  ? 'bg-accent/15 text-accent-light'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
              }`}
            >
              <span>✦</span> {t('input.skills')}
              {activeSkillIds.length > 0 && (
                <span className="text-[10px] bg-accent text-white rounded-full px-1.5 min-w-[16px] text-center">
                  {activeSkillIds.length}
                </span>
              )}
            </button>

            {/* 执行权限下拉框 - 始终显示 */}
            <div className="relative shrink-0">
                <button
                  data-permission-trigger
                  onClick={() => setShowPermissionDropdown(!showPermissionDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    showPermissionDropdown
                      ? 'bg-surface-active text-text-primary'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                  }`}
                  title={currentPermission.description}
                >
                  <span>{currentPermission.icon}</span>
                  <span className="text-xs">{currentPermission.label}</span>
                  <svg className="w-3 h-3 opacity-60" viewBox="0 0 12 12" fill="none">
                    <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                {showPermissionDropdown && (
                  <div
                    data-permission-dropdown
                    className="absolute bottom-full mb-1 left-0 z-50 w-64 bg-bg-primary border border-border rounded-lg shadow-xl overflow-hidden"
                  >
                    {PERMISSION_OPTIONS.map(opt => (
                      <button
                        key={opt.level}
                        onClick={() => {
                          onPermissionChange(opt.level)
                          setShowPermissionDropdown(false)
                        }}
                        className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-border/50 last:border-0 ${
                          permissionLevel === opt.level
                            ? 'bg-accent/10'
                            : 'hover:bg-surface-hover'
                        }`}
                      >
                        <span className="text-sm shrink-0 mt-0.5">{opt.icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                            {opt.label}
                            {permissionLevel === opt.level && <span className="text-accent">✓</span>}
                          </div>
                          <div className="text-[10px] text-text-muted mt-0.5">{opt.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

          </div>

          {/* 右侧：上下文使用度 + 模型 + 发送 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Inline Completion 加载指示器 */}
            {inlineCompletion.isLoading && (
              <span className="text-[10px] text-accent animate-pulse">✨ 补全中...</span>
            )}

            {/* 上下文使用度按钮 - 始终显示 */}
            <div className="relative group">
              <button
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                title="上下文使用度"
              >
                {/* 迷你进度条 */}
                <div className="w-10 h-1.5 bg-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usageBarColor}`}
                    style={{ width: `${Math.max(2, usagePercent)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${usageColor}`}>
                  {Math.round(usagePercent)}%
                </span>
              </button>
              {/* hover 弹窗 */}
              <div className="absolute bottom-full mb-2 right-0 z-50 w-72 bg-bg-primary border border-border rounded-lg shadow-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none">
                <div className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                  <span>📊</span> 上下文使用情况
                </div>
                {/* 模型名称 */}
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-text-muted">模型</span>
                  <span className="text-text-primary truncate ml-2 max-w-[160px]">{currentModelConfig?.name || currentModelConfig?.model || '未选择'}</span>
                </div>
                {/* 使用百分比 */}
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="text-text-muted">使用率</span>
                  <span className={`font-medium ${usageColor}`}>{usagePercent.toFixed(1)}%</span>
                </div>
                {/* 进度条 */}
                <div className="w-full h-2 bg-surface rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${usageBarColor}`}
                    style={{ width: `${Math.max(2, usagePercent)}%` }}
                  />
                </div>
                {/* 已使用 */}
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-text-muted">已使用</span>
                  <span className="text-text-primary">{usedTokens.toLocaleString()} tokens</span>
                </div>
                {/* 剩余 */}
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-text-muted">剩余</span>
                  <span className="text-text-primary">{remainingTokens.toLocaleString()} tokens</span>
                </div>
                {/* 分割线 */}
                <div className="border-t border-border/50 my-1.5" />
                {/* 总窗口 */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">窗口</span>
                  <span className="text-text-primary">{contextWindowSize.toLocaleString()} tokens</span>
                </div>
              </div>
            </div>

            {/* 模型下拉框 - 新建对话和对话过程中都显示 */}
              <div className="relative">
                <button
                  data-model-trigger
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  disabled={isStreaming}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
                  title={t('input.switchModel')}
                >
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                  <span className="truncate max-w-[120px]">
                    {currentModelConfig?.name || t('input.selectModel')}
                  </span>
                  <svg className="w-3.5 h-3.5 opacity-60 shrink-0" viewBox="0 0 12 12" fill="none">
                    <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                {showModelDropdown && (
                  <div
                    data-model-dropdown
                    className="absolute bottom-full mb-1 right-0 z-50 w-64 bg-bg-primary border border-border rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto"
                  >
                    {modelList.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <div className="text-text-muted text-xs mb-2">暂无可用模型</div>
                        <button
                          onClick={() => {
                            onModelClick()
                            setShowModelDropdown(false)
                          }}
                          className="text-xs text-accent-light hover:text-accent"
                        >
                          到设置页面添加 →
                        </button>
                      </div>
                    ) : (
                      modelList.map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            onModelSelect(model)
                            setShowModelDropdown(false)
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/50 last:border-0 ${
                            currentModelConfig?.id === model.id
                              ? 'bg-accent/10'
                              : 'hover:bg-surface-hover'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${currentModelConfig?.id === model.id ? 'bg-accent' : 'bg-green-500'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-text-primary truncate flex items-center gap-1.5">
                              {model.name}
                              {currentModelConfig?.id === model.id && <span className="text-accent">✓</span>}
                            </div>
                            <div className="text-[10px] text-text-muted truncate">{model.model}</div>
                          </div>
                          {model.isDefault && (
                            <span className="text-[9px] text-text-muted bg-surface px-1 rounded shrink-0">默认</span>
                          )}
                        </button>
                      ))
                    )}
                    {/* 管理模型入口 */}
                    <button
                      onClick={() => {
                        onModelClick()
                        setShowModelDropdown(false)
                      }}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-accent-light hover:bg-surface-hover transition-colors border-t border-border"
                    >
                      ⚙️ 管理模型
                    </button>
                  </div>
                )}
              </div>

            {voiceInputEnabled && !isStreaming && (
              <VoiceInput
                language={voiceLanguage}
                onResult={handleVoiceResult}
                onInterim={handleVoiceInterim}
                disabled={isStreaming}
              />
            )}

            {isStreaming ? (
              <button
                onClick={onStop}
                className="ml-1 w-9 h-9 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
                title={t('input.stopGen')}
              >
                <svg className="w-4 h-4" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="3" y="3" width="8" height="8" rx="1"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!input.trim() || !currentModelConfig}
                className="ml-1 w-9 h-9 bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors shrink-0"
                title={t('input.send')}
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 13V3M3 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Skills 选择面板 - 始终显示 */}
        {showSkillPicker && (
          <div className="mx-3 mb-3 p-3 bg-bg-secondary border border-border rounded-lg max-h-72 overflow-y-auto">
            {skills.length === 0 ? (
              <div className="text-center py-4">
                <div className="text-text-muted text-xs mb-2">{t('input.noSkill')}</div>
                <button
                  onClick={onSelectFolder}
                  className="text-xs text-accent-light hover:text-accent"
                >
                  {t('input.goSkills')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {skills.map(skill => {
                  const active = activeSkillIds.includes(skill.id)
                  return (
                    <div
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={`p-2.5 rounded-md cursor-pointer border transition-colors ${
                        active
                          ? 'bg-accent/15 border-accent/50'
                          : 'bg-surface border-border hover:border-accent/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-text-primary truncate">
                          {skill.asTool ? '🔧' : '✦'} {skill.name}
                        </span>
                        {active && <span className="text-accent text-xs shrink-0">✓</span>}
                      </div>
                      <p className="text-[10px] text-text-muted line-clamp-2">
                        {skill.description}
                      </p>
                      {skill.trigger && (
                        <span className="text-[10px] text-text-muted mt-1 inline-block">
                          /{skill.trigger}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 工作空间提示行 - 仅新建任务时显示 */}
      {!compact && (
        <div className="flex items-center justify-between mt-2.5 px-1 text-[11px] text-text-muted">
          <div className="flex items-center gap-3">
            <button
              onClick={onSelectFolder}
              className="flex items-center gap-1 hover:text-text-primary transition-colors"
            >
              <span>📂</span>
              {currentWorkspace ? currentWorkspace.name : t('input.selectWorkspace')}
            </button>
            {activeSkillIds.length === 0 && skills.length > 0 && (
              <span className="hidden sm:inline">{t('input.activateSkill')} <code className="text-text-secondary bg-surface px-1 rounded">/skill</code> {t('input.activateSkill2')}</span>
            )}
          </div>
          <span>{t('input.sendHint')}</span>
        </div>
      )}

      {/* 智能推荐 - 仅新建任务时显示 */}
      {!compact && recommendations.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-5 justify-center">
          {recommendations.map((rec, i) => (
            <button
              key={rec.label + i}
              onClick={() => onRecommendation(rec)}
              className="flex items-center gap-2 px-6 py-3 bg-bg-primary border border-border rounded-xl text-[15px] text-text-secondary hover:border-accent/40 hover:text-accent transition-colors"
            >
              <span className="text-lg">{rec.icon}</span>
              {rec.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

export default InputBox
