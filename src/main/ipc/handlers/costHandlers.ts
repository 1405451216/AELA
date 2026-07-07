// Cost / Budget / Cost Analysis / Anomaly IPC handlers
// COST_SUMMARY, COST_RECORDS, COST_RESET, COST_SET_BUDGET, COST_GET_BUDGET,
// COST_ANALYSIS, ANOMALY_LIST, ANOMALY_ACKNOWLEDGE, ANOMALY_CHECK

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { BudgetConfig as BudgetConfigType } from '@shared/types'
import type { CostTrackerService } from '../../services/CostTrackerService'
import type { ObservabilityService } from '../../services/ObservabilityService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericNumberOptionalSchema, genericNullableObjectSchema, genericBooleanOptionalSchema } from '../schemas'

export function registerCostHandlers(params: {
  costTrackerService: CostTrackerService
  observabilityService: ObservabilityService
}): void {
  const { costTrackerService, observabilityService } = params

  // ===== Cost Tracker 成本追踪 =====
  ipcMain.handle(IPC_CHANNELS.COST_SUMMARY, async () => {
    return wrap(() => costTrackerService.summary())
  })

  ipcMain.handle(IPC_CHANNELS.COST_RECORDS, async (_, limit?: number) => {
    const v = validateInput(genericNumberOptionalSchema, limit)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => costTrackerService.getRecords(limit))
  })

  ipcMain.handle(IPC_CHANNELS.COST_RESET, async () => {
    costTrackerService.reset()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.COST_SET_BUDGET, async (_, budget: BudgetConfigType | null) => {
    const v = validateInput(genericNullableObjectSchema, budget)
    if (!v.success) return { success: false, error: v.error }
    costTrackerService.setBudget(budget)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.COST_GET_BUDGET, async () => {
    return wrap(() => costTrackerService.getBudget())
  })

  // COST_SET_PRICING 在 modelConfig.ts 中注册（与模型配置流程一致）

  // COST_LIST_PRICING 在 modelConfig.ts 中注册（与模型配置流程一致）

  // ===== [升级 3] 可观测性增强 — 成本分析与异常 =====
  ipcMain.handle(IPC_CHANNELS.COST_ANALYSIS, async () => {
    return wrap(() => {
      const summary = costTrackerService.summary()
      const records = costTrackerService.getRecords(5000)
      const budget = costTrackerService.getBudget()
      const report = observabilityService.generateCostAnalysis(summary, records, budget)
      // 同时检查预算异常
      observabilityService.checkCostAnomalies(summary, budget)
      return report
    })
  })

  ipcMain.handle(IPC_CHANNELS.ANOMALY_LIST, async (_, includeAcknowledged?: boolean) => {
    const v = validateInput(genericBooleanOptionalSchema, includeAcknowledged)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => observabilityService.getAlerts(includeAcknowledged ?? false))
  })

  ipcMain.handle(IPC_CHANNELS.ANOMALY_ACKNOWLEDGE, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => observabilityService.acknowledgeAlert(id))
  })

  ipcMain.handle(IPC_CHANNELS.ANOMALY_CHECK, async () => {
    return wrap(() => {
      const summary = costTrackerService.summary()
      const budget = costTrackerService.getBudget()
      observabilityService.checkCostAnomalies(summary, budget)
      return observabilityService.getAlerts(false)
    })
  })
}
