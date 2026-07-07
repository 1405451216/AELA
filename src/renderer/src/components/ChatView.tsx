import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import { useConfigStore } from '../stores/configStore'
import { useStreamingStore } from '../stores/streaming'
import { useDiffStore } from '../stores/diffStore'
import { useContextStore } from '../stores/contextStore'
import { useT } from '../i18n'
import type { StreamEvent, ChatMessage, HITLResponse, SessionContextInfo, ModelConfig } from '@shared/types'
import MessageBubble from './chat/MessageBubble'
import MessageList from './chat/MessageList'
import ToolCallDisplay from './chat/ToolCallDisplay'
import SubAgentPanel from './chat/SubAgentPanel'
import ChatHeader from './chat/ChatHeader'
import DiffPanel from './chat/DiffPanel'
import DiffCard from './chat/DiffCard'
import HitlPanel from './chat/HitlPanel'
import TerminalPanel from './chat/TerminalPanel'
import ContextBar from './chat/ContextBar'
import EscInterruptToast from './chat/EscInterruptToast'
import { useStreamEvents } from './chat/useStreamEvents'
import { useRecommendations } from './chat/Recommendations'
import { randomUUID } from '../utils'
import InputBox, { type InputBoxHandle } from './InputBox'
import { AelaHeroLogo } from '../assets/AelaHeroLogo'

export default function ChatView() {
  const t = useT()
  const {
    currentSession,
    setCurrentSession,
    currentModelConfig,
    messages,
    addMessage,
    setError,
    currentWorkspace,
    setView,
    setCurrentWorkspace,
    skills,
    appConfig
  } = useAppStore()

  const {
    isStreaming,
    setStreaming,
    streamingContent,
    contentBlocks,
    resetStreamingContent,
    clearStreamEvents,
    streamEvents,
  } = useStreamingStore()

  const {
    fileChanges,
    setFileChanges,
    hitlRequest,
    setHitlRequest,
    subAgents,
    setSubAgents,
    handleStreamEvent,
  } = useStreamEvents()

  const [input, setInput] = useState('')
  const [selectedMode, setSelectedMode] = useState<string>('code')
  const [showSkillPicker, setShowSkillPicker] = useState(false)
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([])
  const [showDiffPanel, setShowDiffPanel] = useState(false)
  const [showTerminal, setShowTerminal] = useState(false)
  const [contextInfo, setContextInfo] = useState<SessionContextInfo | null>(null)
  /** Esc 中断状态：连续按 Esc 的次数 */
  const [escToast, setEscToast] = useState<{ show: boolean; progress: number }>({ show: false, progress: 0 })
  const escCountRef = useRef(0)
  const escTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const escIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const diffStoreDiffs = useDiffStore(s => s.diffs)
  const acceptDiffStoreDiff = useDiffStore(s => s.acceptDiff)
  const rejectDiffStoreDiff = useDiffStore(s => s.rejectDiff)
  const contextStore = useContextStore()

  // 从 configStore 获取模型列表和权限等级
  const modelList = useConfigStore(s => s.modelList)
  const permissionLevel = useConfigStore(s => s.permissionLevel)
  const setPermissionLevel = useConfigStore(s => s.setPermissionLevel)
  const setCurrentModelConfig = useConfigStore(s => s.setCurrentModelConfig)

  // 处理模型选择
  const handleModelSelect = useCallback((model: ModelConfig) => {
    setCurrentModelConfig(model)
  }, [setCurrentModelConfig])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputBoxRef = useRef<InputBoxHandle>(null)

  // 流式 IPC 订阅句柄（component unmount 或新一轮 runStream 时清理，防止监听器泄漏）
  const streamUnsubRef = useRef<(() => void) | null>(null)
  const hitlUnsubRef = useRef<(() => void) | null>(null)

  // —— Esc 双按中断逻辑 ——
  useEffect(() => {
    if (!isStreaming) return

    const ESC_TIMEOUT = 2000
    let progressInterval: ReturnType<typeof setInterval> | null = null

    const cleanup = () => {
      if (escTimerRef.current) { clearTimeout(escTimerRef.current); escTimerRef.current = null }
      if (escIntervalRef.current) { clearInterval(escIntervalRef.current); escIntervalRef.current = null }
    }

    const startProgress = () => {
      const start = performance.now()
      escIntervalRef.current = setInterval(() => {
        const elapsed = performance.now() - start
        const p = 1 - Math.min(elapsed / ESC_TIMEOUT, 1)
        setEscToast({ show: true, progress: p })
      }, 50)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 面板（dialog/panel）打开时走原有 Esc 链路，不进入中断分支
      if (e.key !== 'Escape') return
      const openPanels = document.querySelectorAll('[role="dialog"], [data-panel-open="true"]').length > 0
      if (openPanels) return
      
      e.preventDefault()
      e.stopPropagation()

      if (escCountRef.current === 0) {
        // 第一次 Esc：显示提示
        escCountRef.current = 1
        setEscToast({ show: true, progress: 1 })
        startProgress()
        escTimerRef.current = setTimeout(() => {
          escCountRef.current = 0
          setEscToast({ show: false, progress: 0 })
          cleanup()
        }, ESC_TIMEOUT)
      } else {
        // 第二次 Esc：立即中断
        escCountRef.current = 0
        cleanup()
        setEscToast({ show: false, progress: 0 })
        handleStop()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // capture 阶段拦截

    return () => {
      cleanup()
      window.removeEventListener('keydown', handleKeyDown, true)
      escCountRef.current = 0
      setEscToast({ show: false, progress: 0 })
    }
  }, [isStreaming])

  useEffect(() => {
    return () => {
      streamUnsubRef.current?.()
      streamUnsubRef.current = null
      hitlUnsubRef.current?.()
      hitlUnsubRef.current = null
    }
  }, [])

  const recommendations = useRecommendations(selectedMode)

  // 读取从自动化页面「在对话中试运行」传递过来的 prompt
  useEffect(() => {
    const autoPrompt = sessionStorage.getItem('aela-automation-prompt')
    if (autoPrompt) {
      setInput(autoPrompt)
      sessionStorage.removeItem('aela-automation-prompt')
      setTimeout(() => inputBoxRef.current?.focus(), 100)
    }
  }, [])

  // 自动滚动
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // 切换会话同步 skills + 模式
  useEffect(() => {
    if (currentSession) {
      setActiveSkillIds(currentSession.activeSkillIds || [])
    } else {
      setActiveSkillIds([])
    }
  }, [currentSession?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSkill = useCallback((skillId: string) => {
    setActiveSkillIds(prev => {
      const next = prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
      return next
    })
  }, [])

  // activeSkillIds 变化后异步持久化（不放在 setState updater 中以避免严格模式下重复执行）
  useEffect(() => {
    if (!currentSession) return
    const target = activeSkillIds
    if ((currentSession.activeSkillIds || []) === target ||
        (currentSession.activeSkillIds?.length === target.length &&
         currentSession.activeSkillIds?.every((id, i) => id === target[i]))) {
      return
    }
    let cancelled = false
    window.aela.session
      .setActiveSkills(currentSession.id, target)
      .then((updated) => {
        if (!cancelled && updated) setCurrentSession(updated)
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to persist active skills:', err)
      })
    return () => {
      cancelled = true
    }
  }, [activeSkillIds, currentSession, setCurrentSession])

  // 获取上下文信息（当有会话且有消息时）
  const fetchContextInfo = useCallback(async () => {
    if (!currentSession) {
      setContextInfo(null)
      return
    }
    try {
      const info = await window.aela.sessionExt.contextInfo(currentSession.id)
      setContextInfo(info)
    } catch {
      // 忽略错误
    }
  }, [currentSession])

  // 会话变化或消息变化时刷新上下文信息
  useEffect(() => {
    fetchContextInfo()
  }, [fetchContextInfo, messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // /skill 语法快速激活（支持 trigger 和 name）
  useEffect(() => {
    const match = input.match(/^\/(\S+)$/)
    if (!match) return
    const query = match[1].toLowerCase()
    const found = skills.find(s =>
      s.name.toLowerCase().includes(query) ||
      (s.trigger && s.trigger.toLowerCase() === query) ||
      s.id.toLowerCase().includes(query)
    )
    if (!found) return
    // 副作用（setInput/showSkillPicker）放 effect 中;setActiveSkillIds 由 persist effect 统一处理
    setActiveSkillIds(prev => (prev.includes(found.id) ? prev : [...prev, found.id]))
    setInput('')
    setShowSkillPicker(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  // ===== 构建运行参数 =====
  const getMode = useCallback((): 'code' | 'office' => {
    return selectedMode === 'office' ? 'office' : 'code'
  }, [selectedMode])

  const handleSelectFolder = async () => {
    try {
      const ws = await window.aela.workspace.add()
      if (ws) {
        setCurrentWorkspace(ws)
        await window.aela.workspace.open(ws.path)
      }
    } catch (err: unknown) {
      setError(`${t('chat.folderFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return
    if (!currentModelConfig) {
      setError(t('chat.selectModel'))
      setView('models')
      return
    }

    let session = currentSession
    if (!session) {
      try {
        session = await window.aela.session.create({
          workspaceId: currentWorkspace?.id,
          modelConfigId: currentModelConfig.id
        })
        setCurrentSession(session)
      } catch (err: unknown) {
        setError(`${t('chat.createFailed')}: ${err instanceof Error ? err.message : String(err)}`)
        return
      }
    }

    const userMessage: ChatMessage = {
      id: randomUUID(),
      sessionId: session.id,
      role: 'user',
      content: input.trim(),
      createdAt: new Date().toISOString()
    }
    addMessage(userMessage)

    const userInput = input.trim()
    setInput('')
    setStreaming(true)
    resetStreamingContent()
    clearStreamEvents()
    setSubAgents([])
    setError(null)

    const unsubscribe = window.aela.agent.onStreamEvent(session.id, (event: StreamEvent) => {
      handleStreamEvent(event)
    })
    const unsubscribeHITL = window.aela.hitl.onPendingAdded((req) => {
      setHitlRequest(req)
    })

    // 持有 unsubscribe 句柄，组件 unmount / 切换 session 时会清理
    streamUnsubRef.current = unsubscribe
    hitlUnsubRef.current = unsubscribeHITL

    try {
      await window.aela.agent.runStream({
        sessionId: session.id,
        input: userInput,
        modelConfigId: currentModelConfig.id,
        mode: getMode(),
        permissionLevel: permissionLevel
      })
    } catch (err: unknown) {
      setError(`${t('chat.runFailed')}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setStreaming(false)
      unsubscribe()
      if (streamUnsubRef.current === unsubscribe) streamUnsubRef.current = null
      unsubscribeHITL()
      if (hitlUnsubRef.current === unsubscribeHITL) hitlUnsubRef.current = null
      setHitlRequest(null)
      try {
        const changes = await window.aela.fileChange.list(session.id)
        if (changes.length > 0) {
          setFileChanges(changes)
          setShowDiffPanel(true)
        }
      } catch {
        // 忽略拉取错误
      }
      // 刷新侧边栏会话列表（标题可能已更新为第一条消息内容）
      window.dispatchEvent(new CustomEvent('aela-refresh-sessions'))
    }
  }

  const handleHITLRespond = async (response: HITLResponse) => {
    try {
      await window.aela.hitl.resume(response)
    } catch (err) {
      console.error('Failed to resume HITL:', err)
    }
    setHitlRequest(null)
  }

  const handleStop = async () => {
    if (currentSession) {
      await window.aela.agent.stop(currentSession.id)
      setStreaming(false)
      setHitlRequest(null)
      // 先 flush 缓冲区，否则未刷新的 token 会被 resetStreamingContent 丢弃
      useStreamingStore.getState().flush()
      const content = useStreamingStore.getState().streamingContent
      if (content) {
        const assistantMsg: ChatMessage = {
          id: randomUUID(),
          sessionId: currentSession.id,
          role: 'assistant',
          content: content + '\n\n' + t('chat.stopped'),
          createdAt: new Date().toISOString()
        }
        addMessage(assistantMsg)
      }
      resetStreamingContent()
    }
  }

  const handleAcceptChange = useCallback(async (id: string) => {
    try {
      await window.aela.fileChange.accept(id)
      setFileChanges(prev => prev.map(c => c.id === id ? { ...c, accepted: true, rejected: false } : c))
    } catch (err) {
      console.error('Failed to accept change:', err)
    }
  }, [setFileChanges])

  const handleRejectChange = useCallback(async (id: string) => {
    try {
      await window.aela.fileChange.reject(id)
      setFileChanges(prev => prev.map(c => c.id === id ? { ...c, rejected: true, accepted: false } : c))
    } catch (err) {
      console.error('Failed to reject change:', err)
    }
  }, [setFileChanges])

  const handleRecommendation = useCallback((rec: { skillId?: string; prompt?: string; label: string }) => {
    if (rec.skillId) toggleSkill(rec.skillId)
    else {
      setInput(rec.prompt || rec.label + '：')
      inputBoxRef.current?.focus()
    }
  }, [toggleSkill])

  const currentToolEvents = streamEvents.filter(
    e => e.type === 'tool_call' || e.type === 'tool_result'
  )

  // ========== 欢迎页（无消息时居中显示） ==========
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center overflow-y-auto px-6 py-8">
          <div className="w-full max-w-5xl">
            {/* AELA Hero Logo */}
            <div className="flex justify-center mb-8">
              <AelaHeroLogo size={120} />
            </div>
            <InputBox
              ref={inputBoxRef}
              selectedMode={selectedMode}
              setSelectedMode={setSelectedMode}
              showSkillPicker={showSkillPicker}
              setShowSkillPicker={setShowSkillPicker}
              activeSkillIds={activeSkillIds}
              toggleSkill={toggleSkill}
              skills={skills}
              currentModelConfig={currentModelConfig}
              onModelClick={() => setView('models')}
              modelList={modelList}
              onModelSelect={handleModelSelect}
              currentWorkspace={currentWorkspace}
              onSelectFolder={handleSelectFolder}
              input={input}
              setInput={setInput}
              isStreaming={isStreaming}
              onSend={handleSend}
              onStop={handleStop}
              recommendations={recommendations}
              onRecommendation={handleRecommendation}
              sendOnEnter={appConfig?.sendOnEnter ?? true}
              permissionLevel={permissionLevel}
              onPermissionChange={setPermissionLevel}
              contextInfo={contextInfo}
            />
          </div>
        </div>

        <HitlPanel request={hitlRequest} onRespond={handleHITLRespond} />
      </div>
    )
  }

  // ========== 对话中 ==========
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatHeader
        sessionTitle={currentSession?.title}
        selectedMode={selectedMode}
        activeSkillCount={activeSkillIds.length}
        fileChanges={fileChanges}
        showDiffPanel={showDiffPanel}
        showTerminal={showTerminal}
        onToggleDiffPanel={() => setShowDiffPanel(!showDiffPanel)}
        onToggleTerminal={() => setShowTerminal(!showTerminal)}
      />

      <EscInterruptToast show={escToast.show} progress={escToast.progress} />

      <ContextBar
        activeFile={contextStore.activeFile}
        errorCount={0}
        warningCount={0}
        gitModified={0}
      />

      {/* Diff 变更面板 */}
      {showDiffPanel && fileChanges.length > 0 && (
        <DiffPanel fileChanges={fileChanges} onAccept={handleAcceptChange} onReject={handleRejectChange} onClose={() => setShowDiffPanel(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden px-6 py-6">
        <MessageList messages={messages} />

        <div className="max-w-4xl mx-auto w-full mt-4 space-y-4">
          {diffStoreDiffs.filter(d => d.status === 'pending').map((diff) => (
            <DiffCard
              key={diff.id}
              diffId={diff.id}
              filePath={diff.filePath}
              description={diff.description}
              originalContent={diff.originalContent}
              fixedContent={diff.fixedContent}
              onAccept={acceptDiffStoreDiff}
              onReject={rejectDiffStoreDiff}
            />
          ))}

          {isStreaming && (
            <div className="space-y-3">
              <SubAgentPanel agents={subAgents} isStreaming />

              {currentToolEvents.map((evt, idx) => {
                if (evt.type === 'tool_call') {
                  return (
                    <div key={idx} className="animate-fade-in">
                      <ToolCallDisplay
                        toolCallId={evt.toolCall.id}
                        content={`${t('chat.callTool')}: ${evt.toolCall.name}\n${t('chat.params')}: ${evt.toolCall.arguments}`}
                        isError={false}
                        isPending
                      />
                    </div>
                  )
                }
                if (evt.type === 'tool_result') {
                  return (
                    <div key={idx} className="animate-fade-in">
                      <ToolCallDisplay
                        toolCallId={evt.result.toolCallId}
                        content={evt.result.content}
                        isError={evt.result.isError}
                      />
                    </div>
                  )
                }
                return null
              })}

              {streamingContent && (
                <MessageBubble
                  key={`streaming-${currentSession?.id ?? 'none'}`}
                  message={{
                    id: `streaming-${currentSession?.id ?? 'none'}`,
                    sessionId: currentSession?.id ?? '',
                    role: 'assistant',
                    content: streamingContent,
                    contentBlocks,
                    createdAt: new Date().toISOString()
                  }}
                  isStreaming
                />
              )}

              {!streamingContent && currentToolEvents.length === 0 && subAgents.length === 0 && (
                <div className="flex items-center gap-2 text-text-muted text-sm py-4">
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                  {t('chat.thinking')}
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border bg-bg-secondary/30 px-6 py-4">
        <InputBox
          ref={inputBoxRef}
          compact
          selectedMode={selectedMode}
          setSelectedMode={setSelectedMode}
          showSkillPicker={showSkillPicker}
          setShowSkillPicker={setShowSkillPicker}
          activeSkillIds={activeSkillIds}
          toggleSkill={toggleSkill}
          skills={skills}
          currentModelConfig={currentModelConfig}
          onModelClick={() => setView('models')}
          modelList={modelList}
          onModelSelect={handleModelSelect}
          currentWorkspace={currentWorkspace}
          onSelectFolder={handleSelectFolder}
          input={input}
          setInput={setInput}
          isStreaming={isStreaming}
          onSend={handleSend}
          onStop={handleStop}
          recommendations={recommendations}
          onRecommendation={handleRecommendation}
          sendOnEnter={appConfig?.sendOnEnter ?? true}
          permissionLevel={permissionLevel}
          onPermissionChange={setPermissionLevel}
          contextInfo={contextInfo}
        />
      </div>

      <HitlPanel request={hitlRequest} onRespond={handleHITLRespond} />

      {showTerminal && (
        <TerminalPanel
          cwd={currentWorkspace?.path}
          onClose={() => setShowTerminal(false)}
        />
      )}
    </div>
  )
}
