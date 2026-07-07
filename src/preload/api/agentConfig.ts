// 自定义 Agent、路由与代码审查 API（agentConfig, modelRoute, codeReview, subAgent, img2code）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  CustomAgentConfig,
  RouteSuggestion,
  ModelRouteConfig,
  CodeReviewResult,
  SubAgentRunConfig,
  SubAgentRunResult,
  SubAgentRunStatus,
  SubAgentPreset,
  ImageToCodeRequest,
  ImageToCodeResult,
  ImageAnalysis,
  CodeFramework,
} from '@shared/types'

export const agentConfigApi = {
  list: (): Promise<CustomAgentConfig[]> => invoke(IPC_CHANNELS.AGENT_CONFIG_LIST),
  get: (id: string): Promise<CustomAgentConfig | null> => invoke(IPC_CHANNELS.AGENT_CONFIG_GET, id),
  add: (config: Omit<CustomAgentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomAgentConfig> => invoke(IPC_CHANNELS.AGENT_CONFIG_ADD, config),
  update: (id: string, partial: Partial<CustomAgentConfig>): Promise<CustomAgentConfig | null> => invoke(IPC_CHANNELS.AGENT_CONFIG_UPDATE, id, partial),
  delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.AGENT_CONFIG_DELETE, id),
}

export const modelRouteApi = {
  suggest: (taskType: string, input: string): Promise<RouteSuggestion> => invoke(IPC_CHANNELS.MODEL_ROUTE_SUGGEST, taskType, input),
  getConfig: (): Promise<ModelRouteConfig> => invoke(IPC_CHANNELS.MODEL_ROUTE_CONFIG),
  setConfig: (config: Partial<ModelRouteConfig>): Promise<ModelRouteConfig> => invoke(IPC_CHANNELS.MODEL_ROUTE_CONFIG, config),
}

export const codeReviewApi = {
  review: (files: string[], modelConfigId: string): Promise<CodeReviewResult> => invoke(IPC_CHANNELS.CODE_REVIEW_REVIEW, files, modelConfigId),
  get: (id: string): Promise<CodeReviewResult | null> => invoke(IPC_CHANNELS.CODE_REVIEW_GET, id),
  list: (): Promise<CodeReviewResult[]> => invoke(IPC_CHANNELS.CODE_REVIEW_LIST),
}

export const subAgentApi = {
  run: (config: SubAgentRunConfig): Promise<SubAgentRunResult> => invoke(IPC_CHANNELS.SUBAGENT_RUN, config),
  stop: (runId: string): Promise<boolean> => invoke(IPC_CHANNELS.SUBAGENT_STOP, runId),
  status: (runId: string): Promise<SubAgentRunStatus | null> => invoke(IPC_CHANNELS.SUBAGENT_STATUS, runId),
  listPresets: (): Promise<SubAgentPreset[]> => invoke(IPC_CHANNELS.SUBAGENT_LIST_PRESETS),
}

export const img2codeApi = {
  analyze: (imagePath: string, modelConfigId: string): Promise<ImageAnalysis> => invoke(IPC_CHANNELS.IMG2CODE_ANALYZE, imagePath, modelConfigId),
  generate: (request: ImageToCodeRequest): Promise<ImageToCodeResult> => invoke(IPC_CHANNELS.IMG2CODE_GENERATE, request),
  refine: (resultId: string, feedback: string, modelConfigId: string): Promise<ImageToCodeResult> => invoke(IPC_CHANNELS.IMG2CODE_REFINE, resultId, feedback, modelConfigId),
  getResult: (id: string): Promise<ImageToCodeResult | null> => invoke(IPC_CHANNELS.IMG2CODE_GET_RESULT, id),
  listFrameworks: (): Promise<Array<{ id: CodeFramework; label: string; extension: string }>> => invoke(IPC_CHANNELS.IMG2CODE_LIST_FRAMEWORKS),
}
