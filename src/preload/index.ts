// AELA Preload - 桥接层
import { contextBridge } from 'electron'

import { modelApi } from './api/model'
import { workspaceApi } from './api/workspace'
import { sessionApi } from './api/session'
import { agentApi } from './api/agent'
import { mcpApi, mcpResourceApi } from './api/mcp'
import { configApi, shellApi, skillApi, automationApi } from './api/config'
import { orchestrationApi, dagApi, collaborationApi, dynamicDagApi } from './api/orchestration'
import { securityApi, guardrailApi, securityPresetApi } from './api/security'
import { memoryApi, memoryCompressApi, memoryFTSApi } from './api/memory'
import { metricsApi, telemetryApi, debuggerApi, observabilityApi } from './api/observability'
import { costApi, builtinToolsApi, contextWindowApi } from './api/cost'
import { auditApi } from './api/audit'
import { promptApi, planningApi, reflectionApi, toolLearningApi, fewShotWeightApi, toolLearningExtApi } from './api/prompt'
import { hitlApi } from './api/hitl'
import { multimodalApi, screenshotApi } from './api/multimodal'
import { fileChangeApi, multiFileApi, testGenApi, wikiApi } from './api/files'
import { terminalApi, terminalExtApi, previewApi } from './api/terminal'
import { hookConfigApi } from './api/hooks'
import { agentConfigApi, modelRouteApi, codeReviewApi, subAgentApi, img2codeApi } from './api/agentConfig'
import { supervisorApi } from './api/supervisor'
import { ragApi, ragExtApi } from './api/rag'
import { sessionExtApi } from './api/sessionExt'
import { adaptiveApi } from './api/adaptive'
import { resilienceApi, orchestrationExtApi } from './api/resilience'
import { sdkEnhancementsApi, perfApi } from './api/sdk'
import { sdkPhase4Api } from './api/sdkPhase4'
import { checkpointApi, inlineCompletionApi, lspApi, pluginApi, embeddingApi } from './api/advanced'
import { taskBoardApi, agentBusApi, supervisorSessionApi } from './api/multiAgent'
import { syncApi } from './api/sync'
import { ipcMonitorApi } from './api/ipcMonitor'
import { skillMarketApi } from './api/skillMarket'
import { dialogApi } from './api/dialog'

const api = {
  model: modelApi,
  workspace: workspaceApi,
  session: sessionApi,
  agent: agentApi,
  mcp: mcpApi,
  shell: shellApi,
  skill: skillApi,
  automation: automationApi,
  config: configApi,
  orchestration: orchestrationApi,
  metrics: metricsApi,
  memory: memoryApi,
  security: securityApi,
  guardrail: guardrailApi,
  dag: dagApi,
  collaboration: collaborationApi,
  debugger: debuggerApi,
  mcpResource: mcpResourceApi,
  supervisor: supervisorApi,
  dynamicDag: dynamicDagApi,
  rag: ragApi,
  memoryCompress: memoryCompressApi,
  telemetry: telemetryApi,
  builtinTools: builtinToolsApi,
  cost: costApi,
  contextWindow: contextWindowApi,
  audit: auditApi,
  prompt: promptApi,
  planning: planningApi,
  reflection: reflectionApi,
  toolLearning: toolLearningApi,
  hitl: hitlApi,
  multimodal: multimodalApi,
  fileChange: fileChangeApi,
  terminal: terminalApi,
  hookConfig: hookConfigApi,
  preview: previewApi,
  multiFile: multiFileApi,
  testGen: testGenApi,
  wiki: wikiApi,
  agentConfig: agentConfigApi,
  modelRoute: modelRouteApi,
  codeReview: codeReviewApi,
  subAgent: subAgentApi,
  img2code: img2codeApi,
  memoryFTS: memoryFTSApi,
  orchestrationExt: orchestrationExtApi,
  observability: observabilityApi,
  fewShotWeight: fewShotWeightApi,
  toolLearningExt: toolLearningExtApi,
  securityPreset: securityPresetApi,
  sessionExt: sessionExtApi,
  terminalExt: terminalExtApi,
  adaptive: adaptiveApi,
  screenshot: screenshotApi,
  resilience: resilienceApi,
  ragExt: ragExtApi,
  sdkEnhancements: sdkEnhancementsApi,
  perf: perfApi,
  sdkPhase4: sdkPhase4Api,
  checkpoint: checkpointApi,
  inlineCompletion: inlineCompletionApi,
  lsp: lspApi,
  plugin: pluginApi,
  embedding: embeddingApi,
  taskBoard: taskBoardApi,
  agentBus: agentBusApi,
  supervisorSession: supervisorSessionApi,
  sync: syncApi,
  ipcMonitor: ipcMonitorApi,
  skillMarket: skillMarketApi,
  dialog: dialogApi,
}

contextBridge.exposeInMainWorld('aela', api)

export type AELAApi = typeof api
