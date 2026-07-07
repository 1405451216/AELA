// 自适应学习 API（adaptive）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  AdaptiveLearningProfile,
  AdaptiveHint,
  LearningProgress,
} from '@shared/types'

export const adaptiveApi = {
  getProfile: (agentId?: string): Promise<AdaptiveLearningProfile> => invoke(IPC_CHANNELS.ADAPTIVE_GET_PROFILE, agentId),
  getHints: (agentId?: string): Promise<AdaptiveHint[]> => invoke(IPC_CHANNELS.ADAPTIVE_GET_HINTS, agentId),
  getProgress: (agentId?: string): Promise<LearningProgress> => invoke(IPC_CHANNELS.ADAPTIVE_GET_PROGRESS, agentId),
  recordInteraction: (params: {
    agentId?: string
    agentName?: string
    input: string
    output: string
    success: boolean
    toolCalls?: number
    duration?: number
    sessionId?: string
  }): Promise<boolean> => invoke(IPC_CHANNELS.ADAPTIVE_RECORD_INTERACTION, params),
  extractRules: (agentId?: string): Promise<boolean> => invoke(IPC_CHANNELS.ADAPTIVE_EXTRACT_RULES, agentId),
  clearProfile: (agentId?: string): Promise<boolean> => invoke(IPC_CHANNELS.ADAPTIVE_CLEAR_PROFILE, agentId),
}
