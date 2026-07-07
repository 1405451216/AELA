import { useState, useCallback, useRef, useEffect } from 'react'

interface VoiceInputProps {
  language: string
  onResult: (text: string) => void
  onInterim?: (text: string) => void
  disabled?: boolean
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
    SpeechRecognition: new () => SpeechRecognitionInstance
  }
}

export default function VoiceInput({ language, onResult, onInterim, disabled }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  const isSupported = typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('语音识别不支持当前浏览器')
      return
    }

    if (isListening) {
      stopListening()
      return
    }

    setError(null)

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setIsListening(true)
      setError(null)
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (final) {
        onResult(final)
      }
      if (interim && onInterim) {
        onInterim(interim)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          setError('麦克风权限被拒绝')
          break
        case 'no-speech':
          setError('未检测到语音')
          break
        case 'network':
          setError('网络错误')
          break
        case 'aborted':
          break
        default:
          setError(`语音识别错误: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, isListening, language, onResult, onInterim, stopListening])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (disabled && isListening) {
      stopListening()
    }
  }, [disabled, isListening, stopListening])

  if (!isSupported) {
    return null
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={startListening}
        disabled={disabled}
        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors shrink-0 ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
            : 'text-text-muted hover:text-text-primary hover:bg-surface-hover disabled:opacity-30 disabled:cursor-not-allowed'
        }`}
        title={isListening ? '停止录音' : '语音输入'}
        aria-label={isListening ? '停止录音' : '语音输入'}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      </button>
      {error && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-48 bg-red-500/90 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}
