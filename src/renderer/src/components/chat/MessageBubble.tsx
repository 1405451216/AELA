import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { memo, useState, type ComponentProps } from 'react'
import type { ChatMessage, ContentBlock } from '@shared/types'
import { useT } from '../../i18n'
import { formatTime } from '../../utils'
import ReflectionPanel from './ReflectionPanel'
import InlineEditButton from './InlineEditButton'
import VoiceOutput from './VoiceOutput'
import { useVoiceStore } from '../../stores/voiceStore'

interface Props {
  message: ChatMessage
  isStreaming?: boolean
}

/**
 * MessageBubble 用 React.memo 包裹：当 ChatView 在流式输出时，
 * 每条 token 都触发 setState，但只有"当前流式消息"内容变化；
 * 历史消息的 props 不变，应跳过 re-render。
 */
function BlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': {
      const level = block.content.startsWith('#') ? 1 : block.content.startsWith('##') ? 2 : 3
      const text = block.content.replace(/^#{1,6}\s*/, '')
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      return <Tag className={`font-bold mt-4 mb-2 ${level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base'}`}>{text}</Tag>
    }
    case 'code':
      return (
        <SyntaxHighlighter
          style={vscDarkPlus as ComponentProps<typeof SyntaxHighlighter>['style']}
          language={block.metadata?.language || 'text'}
          PreTag="div"
        >
          {block.content}
        </SyntaxHighlighter>
      )
    case 'blockquote':
      return (
        <blockquote className="border-l-4 border-accent/40 pl-3 italic text-text-muted my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
        </blockquote>
      )
    case 'tool_call':
      return (
        <pre className="bg-bg-secondary rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">
          {block.metadata?.toolName ?? 'tool_call'}: {block.content}
        </pre>
      )
    case 'list':
      return (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
      )
    case 'paragraph':
    default:
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code(props: Record<string, unknown> & { className?: string; children?: React.ReactNode }) {
              const { className, children } = props
              const match = /language-(\w+)/.exec(className || '')
              const isInline = !match && !String(children).includes('\n')
              if (isInline) {
                return <code className={className}>{children}</code>
              }
              return (
                <SyntaxHighlighter
                  style={vscDarkPlus as ComponentProps<typeof SyntaxHighlighter>['style']}
                  language={match?.[1] || 'text'}
                  PreTag="div"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )
            },
          } as React.ComponentProps<typeof ReactMarkdown>['components']}
        >
          {block.content}
        </ReactMarkdown>
      )
  }
}

function MessageBubbleInner({ message, isStreaming }: Props) {
  const t = useT()
  const isUser = message.role === 'user'
  const [showReflection, setShowReflection] = useState(false)

  const voiceOutputEnabled = useVoiceStore(s => s.voiceOutputEnabled)
  const voiceLanguage = useVoiceStore(s => s.voiceLanguage)
  const voiceRate = useVoiceStore(s => s.voiceRate)

  const safeContent = typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2)

  const blocks: ContentBlock[] = message.contentBlocks?.length
    ? message.contentBlocks
    : [{ id: 'legacy', type: 'paragraph', content: safeContent }]

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`max-w-3xl ${isUser ? 'ml-12' : 'mr-12'}`}>
        <div className={`flex items-center gap-2 mb-1 text-xs text-text-muted ${isUser ? 'justify-end' : ''}`}>
          <span className="font-medium">
            {isUser ? (
              <>
                <span aria-hidden="true">👤</span>
                {t('msg.you')}
                <span className="sr-only">You</span>
              </>
            ) : (
              <>
                <span aria-hidden="true">🤖</span>
                {t('msg.aela')}
                <span className="sr-only">AELA</span>
              </>
            )}
          </span>
          {!isStreaming && message.createdAt && (
            <span>{formatTime(message.createdAt)}</span>
          )}
        </div>

        <div
          className={`selectable rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-accent text-white'
              : 'bg-surface text-text-primary border border-border'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{safeContent}</div>
          ) : (
            <div className="markdown-body">
              {blocks.map((block) => (
                <BlockRenderer key={block.id} block={block} />
              ))}
              {isStreaming && (
                <span className="cursor-blink inline-block w-2 h-4 bg-accent ml-0.5 align-middle" />
              )}
            </div>
          )}
        </div>

        {!isStreaming && message.metrics && (
          <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
            <span>🔄 {message.metrics.totalTurns}{t('msg.turns')}</span>
            <span>🛠 {message.metrics.totalTools}{t('msg.tools')}</span>
            <span>⏱ {(message.metrics.duration / 1000).toFixed(1)}{t('msg.time')}</span>
          </div>
        )}

        {!isStreaming && message.content && (
          <div className="flex items-center gap-2 mt-1">
            <InlineEditButton message={message} />
            {!isUser && voiceOutputEnabled && safeContent && (
              <VoiceOutput
                text={safeContent}
                language={voiceLanguage}
                rate={voiceRate}
              />
            )}
            {!isUser && (
              <button
                onClick={() => setShowReflection(true)}
                className="text-xs text-text-muted hover:text-accent-light transition-colors"
              >
                🔍 {t('refl.reflect')}
              </button>
            )}
          </div>
        )}
      </div>

      {showReflection && (
        <ReflectionPanel
          input=""
          output={message.content}
          onClose={() => setShowReflection(false)}
        />
      )}
    </div>
  )
}

/**
 * 浅比较 props, 优化流式输出性能:
 *
 * 历史消息 (isStreaming=false): 引用相等即跳过 — 最高效。
 * 流式消息 (isStreaming=true): 比较 message.content 而非对象引用,
 *   因为 ChatView 每次渲染会创建新的内联 message 对象,
 *   但 content 只在实际 token 到达时变化. 这样 ReactMarkdown 只在
 *   content 变化时重渲染, 避免了无变化时的无效重渲染。
 *
 * 注意: 由于 streaming store 每 16ms 批量 flush, 重渲染频率已从
 *   每 token 降至每帧, 结合 content 比较可进一步减少无效渲染。
 */
const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  if (prev.isStreaming !== next.isStreaming) return false
  if (prev.isStreaming) {
    return prev.message.content === next.message.content
      && prev.message.contentBlocks === next.message.contentBlocks
  }
  return prev.message === next.message
})

export default MessageBubble
