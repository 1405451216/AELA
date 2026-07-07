import { useMemo } from 'react'
import { useT } from '../../i18n'

export interface RecommendationItem {
  icon: string
  label: string
  prompt: string
}

// 推荐项计算逻辑供 ChatView 使用
export function useRecommendations(mode: string): RecommendationItem[] {
  const t = useT()
  return useMemo(() => {
    if (mode === 'code') {
      return [
        { icon: '🚀', label: t('chat.rec.appDev'), prompt: t('chat.rec.appDev.prompt') },
        { icon: '📖', label: t('chat.rec.projUnderstanding'), prompt: t('chat.rec.projUnderstanding.prompt') },
        { icon: '🎮', label: t('chat.rec.gameIdea'), prompt: t('chat.rec.gameIdea.prompt') },
        { icon: '', label: t('chat.rec.toolScript'), prompt: t('chat.rec.toolScript.prompt') }
      ]
    }
    return [
      { icon: '', label: t('chat.rec.webAnalysis'), prompt: t('chat.rec.webAnalysis.prompt') },
      { icon: '📊', label: t('chat.rec.researchAnalysis'), prompt: t('chat.rec.researchAnalysis.prompt') },
      { icon: '📉', label: t('chat.rec.dataMining'), prompt: t('chat.rec.dataMining.prompt') },
      { icon: '🔬', label: t('chat.rec.deepResearch'), prompt: t('chat.rec.deepResearch.prompt') }
    ]
  }, [mode, t])
}
