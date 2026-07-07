// 工具学习 IPC handlers
// TOOL_LEARNING_RECORD_SUCCESS, TOOL_LEARNING_RECORD_FAILURE,
// TOOL_LEARNING_BEST_PRACTICES, TOOL_LEARNING_SUGGEST,
// TOOL_LEARNING_STATS, TOOL_LEARNING_RECORDS,
// TOOL_LEARNING_VISUALIZATION, TOOL_LEARNING_FAILURE_MODES, TOOL_LEARNING_CLEAR

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { ToolLearningService } from '../../services/ToolLearningService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericStringSchema, genericStringOptionalSchema, genericIdOptionalSchema, genericNumberOptionalSchema } from '../schemas'

export function registerToolLearningHandlers(params: {
  toolLearningService: ToolLearningService
}): void {
  const { toolLearningService } = params

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_RECORD_SUCCESS, async (_, toolName: string, args: string, result: string, sessionId?: string) => {
    const v1 = validateInput(genericStringSchema, toolName)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, args)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericStringSchema, result)
    if (!v3.success) return { success: false, error: v3.error }
    const v4 = validateInput(genericIdOptionalSchema, sessionId)
    if (!v4.success) return { success: false, error: v4.error }
    return wrap(() => toolLearningService.recordSuccess(toolName, args, result, sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_RECORD_FAILURE, async (_, toolName: string, args: string, errorMsg: string, sessionId?: string) => {
    const v1 = validateInput(genericStringSchema, toolName)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, args)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericStringSchema, errorMsg)
    if (!v3.success) return { success: false, error: v3.error }
    const v4 = validateInput(genericIdOptionalSchema, sessionId)
    if (!v4.success) return { success: false, error: v4.error }
    return wrap(() => toolLearningService.recordFailure(toolName, args, errorMsg, sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_BEST_PRACTICES, async (_, toolName: string) => {
    const v = validateInput(genericStringSchema, toolName)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => toolLearningService.getBestPractices(toolName))
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_SUGGEST, async (_, toolName: string, args: string) => {
    const v1 = validateInput(genericStringSchema, toolName)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, args)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => toolLearningService.suggestImprovement(toolName, args))
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_STATS, async (_, toolName?: string) => {
    const v = validateInput(genericStringOptionalSchema, toolName)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => toolLearningService.getToolStats(toolName))
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_RECORDS, async (_, toolName?: string, limit?: number) => {
    const v1 = validateInput(genericStringOptionalSchema, toolName)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericNumberOptionalSchema, limit)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => toolLearningService.getRecords(toolName, limit))
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_VISUALIZATION, async () => {
    return wrap(() => toolLearningService.getVisualization())
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_FAILURE_MODES, async () => {
    return wrap(() => toolLearningService.analyzeFailureModes())
  })

  ipcMain.handle(IPC_CHANNELS.TOOL_LEARNING_CLEAR, async () => {
    return wrap(() => {
      toolLearningService.clearAll()
      return true
    })
  })
}
