import { create } from 'zustand'

type VoiceLanguage = 'zh-CN' | 'en-US'

interface VoiceState {
  voiceInputEnabled: boolean
  voiceOutputEnabled: boolean
  voiceLanguage: VoiceLanguage
  voiceRate: number
  setVoiceInputEnabled: (enabled: boolean) => void
  setVoiceOutputEnabled: (enabled: boolean) => void
  setVoiceLanguage: (lang: VoiceLanguage) => void
  setVoiceRate: (rate: number) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  voiceInputEnabled: false,
  voiceOutputEnabled: true,
  voiceLanguage: 'zh-CN',
  voiceRate: 1.0,
  setVoiceInputEnabled: (enabled) => set({ voiceInputEnabled: enabled }),
  setVoiceOutputEnabled: (enabled) => set({ voiceOutputEnabled: enabled }),
  setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),
  setVoiceRate: (rate) => set({ voiceRate: Math.max(0.5, Math.min(2.0, rate)) }),
}))
