// Planning 任务规划 + Reflection 自我反思 IPC handlers
// PLANNING_DECOMPOSE, PLANNING_GENERATE_PLAN,
// REFLECTION_REFLECT, REFLECTION_CRITIQUE, REFLECTION_IMPROVE, REFLECTION_REFLECT_AND_IMPROVE

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { CritiqueResult } from '@shared/types'
import type { ConfigStore } from '../../services/ConfigStore'
import type { PlanningService } from '../../services/PlanningService'
import type { ReflectionService } from '../../services/ReflectionService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericStringSchema, genericStringOptionalSchema, genericObjectSchema } from '../schemas'

export function registerPlanningHandlers(params: {
  planningService: PlanningService
  reflectionService: ReflectionService
  configStore: ConfigStore
}): void {
  const { planningService, reflectionService, configStore } = params

  // ===== Planning 任务规划 =====
  ipcMain.handle(IPC_CHANNELS.PLANNING_DECOMPOSE, async (_, task: string, modelConfigId?: string) => {
    const v1 = validateInput(genericStringSchema, task)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringOptionalSchema, modelConfigId)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => planningService.decompose(task, modelConfigId))
  })

  ipcMain.handle(IPC_CHANNELS.PLANNING_GENERATE_PLAN, async (_, task: string, modelConfigId?: string) => {
    const v1 = validateInput(genericStringSchema, task)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringOptionalSchema, modelConfigId)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(async () => {
      if (modelConfigId) {
        const modelConfig = configStore.getModel(modelConfigId)
        if (!modelConfig) {
          throw new Error(`未找到模型配置: ${modelConfigId}`)
        }
      }
      return planningService.generatePlan(task, modelConfigId)
    })
  })

  // ===== Reflection 自我反思 =====
  ipcMain.handle(IPC_CHANNELS.REFLECTION_REFLECT, async (_, input: string, output: string, modelConfigId?: string) => {
    const v1 = validateInput(genericStringSchema, input)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, output)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericStringOptionalSchema, modelConfigId)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(() => reflectionService.reflect(input, output, modelConfigId))
  })

  ipcMain.handle(IPC_CHANNELS.REFLECTION_CRITIQUE, async (_, output: string, modelConfigId?: string) => {
    const v1 = validateInput(genericStringSchema, output)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringOptionalSchema, modelConfigId)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => reflectionService.critique(output, modelConfigId))
  })

  ipcMain.handle(IPC_CHANNELS.REFLECTION_IMPROVE, async (_, output: string, feedback: CritiqueResult, modelConfigId?: string) => {
    const v1 = validateInput(genericStringSchema, output)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericObjectSchema, feedback)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericStringOptionalSchema, modelConfigId)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(() => reflectionService.improve(output, feedback, modelConfigId))
  })

  ipcMain.handle(IPC_CHANNELS.REFLECTION_REFLECT_AND_IMPROVE, async (_, input: string, output: string, modelConfigId?: string) => {
    const v1 = validateInput(genericStringSchema, input)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, output)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericStringOptionalSchema, modelConfigId)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(() => reflectionService.reflectAndImprove(input, output, modelConfigId))
  })
}
