// 提示词与规划 API（prompt, planning, reflection, toolLearning, fewShotWeight, toolLearningExt）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  PromptRegistryEntry,
  PromptVariantInfo,
  FewShotExample,
  FewShotExampleWithWeight,
  FewShotWeightConfig,
  Plan,
  ReflectionResult,
  CritiqueResult,
  ToolUsageRecord,
  BestPractice,
  ToolLearningSuggestion,
  ToolLearningVisualization,
} from '@shared/types'

export const promptApi = {
  render: (name: string, vars: Record<string, unknown>): Promise<string> => invoke(IPC_CHANNELS.PROMPT_RENDER, name, vars),
  list: (): Promise<PromptRegistryEntry[]> => invoke(IPC_CHANNELS.PROMPT_LIST),
  register: (name: string, template: string): Promise<boolean> => invoke(IPC_CHANNELS.PROMPT_REGISTER, name, template),
  delete: (name: string): Promise<boolean> => invoke(IPC_CHANNELS.PROMPT_DELETE, name),
  renderMessage: (role: 'system' | 'user' | 'assistant', vars: Record<string, unknown>): Promise<string> => invoke(IPC_CHANNELS.PROMPT_RENDER_MESSAGE, role, vars),
  setMessageTemplate: (role: 'system' | 'user' | 'assistant', template: string): Promise<boolean> => invoke(IPC_CHANNELS.PROMPT_SET_MESSAGE_TEMPLATE, role, template),
  fewshotRender: (name: string, input: string, vars?: Record<string, unknown>): Promise<string> => invoke(IPC_CHANNELS.PROMPT_FEWSHOT_RENDER, name, input, vars),
  fewshotAddExample: (name: string, input: string, output: string): Promise<boolean> => invoke(IPC_CHANNELS.PROMPT_FEWSHOT_ADD_EXAMPLE, name, input, output),
  fewshotGetExamples: (name: string): Promise<FewShotExample[]> => invoke(IPC_CHANNELS.PROMPT_FEWSHOT_GET_EXAMPLES, name),
  variantsList: (): Promise<PromptVariantInfo[]> => invoke(IPC_CHANNELS.PROMPT_VARIANTS_LIST),
}

export const planningApi = {
  decompose: (task: string, modelConfigId?: string): Promise<Plan['subtasks']> => invoke(IPC_CHANNELS.PLANNING_DECOMPOSE, task, modelConfigId),
  generatePlan: (task: string, modelConfigId?: string): Promise<Plan> => invoke(IPC_CHANNELS.PLANNING_GENERATE_PLAN, task, modelConfigId),
}

export const reflectionApi = {
  reflect: (input: string, output: string, modelConfigId?: string): Promise<ReflectionResult> => invoke(IPC_CHANNELS.REFLECTION_REFLECT, input, output, modelConfigId),
  critique: (output: string, modelConfigId?: string): Promise<CritiqueResult> => invoke(IPC_CHANNELS.REFLECTION_CRITIQUE, output, modelConfigId),
  improve: (output: string, feedback: CritiqueResult, modelConfigId?: string): Promise<string> => invoke(IPC_CHANNELS.REFLECTION_IMPROVE, output, feedback, modelConfigId),
  reflectAndImprove: (input: string, output: string, modelConfigId?: string): Promise<{ reflection: ReflectionResult; critique: CritiqueResult; improvedOutput: string }> => invoke(IPC_CHANNELS.REFLECTION_REFLECT_AND_IMPROVE, input, output, modelConfigId),
}

export const toolLearningApi = {
  recordSuccess: (toolName: string, args: string, result: string, sessionId?: string): Promise<boolean> => invoke(IPC_CHANNELS.TOOL_LEARNING_RECORD_SUCCESS, toolName, args, result, sessionId),
  recordFailure: (toolName: string, args: string, errorMsg: string, sessionId?: string): Promise<boolean> => invoke(IPC_CHANNELS.TOOL_LEARNING_RECORD_FAILURE, toolName, args, errorMsg, sessionId),
  bestPractices: (toolName: string): Promise<BestPractice[]> => invoke(IPC_CHANNELS.TOOL_LEARNING_BEST_PRACTICES, toolName),
  suggest: (toolName: string, args: string): Promise<ToolLearningSuggestion> => invoke(IPC_CHANNELS.TOOL_LEARNING_SUGGEST, toolName, args),
  stats: (toolName?: string): Promise<Array<{ toolName: string; totalCalls: number; successCount: number; failureCount: number; successRate: number; avgResultLength: number }>> => invoke(IPC_CHANNELS.TOOL_LEARNING_STATS, toolName),
  records: (toolName?: string, limit?: number): Promise<ToolUsageRecord[]> => invoke(IPC_CHANNELS.TOOL_LEARNING_RECORDS, toolName, limit),
}

export const fewShotWeightApi = {
  add: (name: string, input: string, output: string, metadata?: Record<string, unknown>): Promise<boolean> =>
    invoke(IPC_CHANNELS.PROMPT_FEWSHOT_ADD_WEIGHTED, name, input, output, metadata),
  feedback: (name: string, input: string, positive: boolean): Promise<boolean> =>
    invoke(IPC_CHANNELS.PROMPT_FEWSHOT_FEEDBACK, name, input, positive),
  list: (name: string): Promise<FewShotExampleWithWeight[]> =>
    invoke(IPC_CHANNELS.PROMPT_FEWSHOT_LIST_WEIGHTED, name),
  setConfig: (name: string, config: Partial<FewShotWeightConfig>): Promise<boolean> =>
    invoke(IPC_CHANNELS.PROMPT_FEWSHOT_SET_WEIGHT_CONFIG, name, config),
}

export const toolLearningExtApi = {
  visualization: (): Promise<ToolLearningVisualization> => invoke(IPC_CHANNELS.TOOL_LEARNING_VISUALIZATION),
  failureModes: (): Promise<ToolLearningVisualization['failureModes']> => invoke(IPC_CHANNELS.TOOL_LEARNING_FAILURE_MODES),
  clear: (): Promise<boolean> => invoke(IPC_CHANNELS.TOOL_LEARNING_CLEAR),
}
