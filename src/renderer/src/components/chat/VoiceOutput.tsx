import { useState, useCallback, useRef, useEffect } from 'react'

interface VoiceOutputProps {
  text: string
  language?: string
  rate?: number
  disabled?: boolean
}

export default function VoiceOutput({ text, language = 'zh-CN', rate = 1.0, disabled }: VoiceOutputProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    utteranceRef.current = null
  }, [])

  const startSpeaking = useCallback(() => {
    if (!isSupported) return

    if (isSpeaking) {
      stopSpeaking()
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = rate

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => {
      setIsSpeaking(false)
      utteranceRef.current = null
    }
    utterance.onerror = () => {
      setIsSpeaking(false)
      utteranceRef.current = null
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [isSupported, isSpeaking, text, language, rate, stopSpeaking])

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [])

  if (!isSupported || disabled) {
    return null
  }

  return (
    <button
      onClick={startSpeaking}
      className={`flex items-center gap-1 text-xs transition-colors ${
        isSpeaking
          ? 'text-accent-light'
          : 'text-text-muted hover:text-accent-light'
      }`}
      title={isSpeaking ? '停止朗读' : '朗读消息'}
      aria-label={isSpeaking ? '停止朗读' : '朗读消息'}
    >
      {isSpeaking ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      )}
    </button>
  )
}
