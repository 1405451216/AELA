// Security/Guardrail/Audit IPC handlers
// SECURITY_GET_CONFIG, SECURITY_SET_CONFIG, SECURITY_CHECK_ACCESS,
// SECURITY_PRESETS_LIST, SECURITY_PRESET_APPLY,
// GUARDRAIL_SET_RULES, GUARDRAIL_GET_RULES, GUARDRAIL_CHECK,
// AUDIT_LOG, AUDIT_QUERY, AUDIT_REPORT, AUDIT_GET_CONFIG, AUDIT_SET_CONFIG,
// AUDIT_CLEAR, AUDIT_COUNT

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { SandboxConfig, AccessLevel, GuardrailCheckPoint, GuardrailRuleConfig, AuditEvent, AuditQueryFilter, AuditConfig, SecurityPresetLevel } from '@shared/types'
import type { SecurityService } from '../../services/SecurityService'
import type { GuardrailService } from '../../services/GuardrailService'
import type { AuditService } from '../../services/AuditService'
import type { HITLService } from '../../services/HITLService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema, genericStringSchema, genericObjectSchema, genericArraySchema } from '../schemas'

export function registerSecurityHandlers(params: {
  securityService: SecurityService
  guardrailService: GuardrailService
  auditService: AuditService
  hitlService: HITLService
}): void {
  const { securityService, guardrailService, auditService, hitlService } = params

  // ===== 安全沙箱 =====
  ipcMain.handle(IPC_CHANNELS.SECURITY_GET_CONFIG, async () => {
    return wrap(() => securityService.getConfig())
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_SET_CONFIG, async (_, config: SandboxConfig) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    securityService.setConfig(config)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_CHECK_ACCESS, async (_, agentId: string, resource: string, level: AccessLevel) => {
    const v1 = validateInput(genericIdSchema, agentId)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, resource)
    if (!v2.success) return { success: false, error: v2.error }
    const v3 = validateInput(genericStringSchema, level)
    if (!v3.success) return { success: false, error: v3.error }
    return wrap(() => securityService.checkAccess(agentId, resource, level))
  })

  // ===== 安全护栏 =====
  ipcMain.handle(IPC_CHANNELS.GUARDRAIL_CHECK, async (_, input: string, point: GuardrailCheckPoint) => {
    const v1 = validateInput(genericStringSchema, input)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, point)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => guardrailService.check(input, point))
  })

  ipcMain.handle(IPC_CHANNELS.GUARDRAIL_GET_RULES, async () => {
    return wrap(() => guardrailService.getRules())
  })

  ipcMain.handle(IPC_CHANNELS.GUARDRAIL_SET_RULES, async (_, rules: GuardrailRuleConfig[]) => {
    const v = validateInput(genericArraySchema, rules)
    if (!v.success) return { success: false, error: v.error }
    guardrailService.setRules(rules)
    return { success: true }
  })

  // ===== Audit Logger 审计日志 =====
  ipcMain.handle(IPC_CHANNELS.AUDIT_LOG, async (_, event: Omit<AuditEvent, 'timestamp'> & { timestamp?: string }) => {
    const v = validateInput(genericObjectSchema, event)
    if (!v.success) return { success: false, error: v.error }
    auditService.log(event)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_QUERY, async (_, filter: AuditQueryFilter) => {
    const v = validateInput(genericObjectSchema, filter)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => auditService.query(filter))
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_REPORT, async (_, start: string, end: string) => {
    const v1 = validateInput(genericStringSchema, start)
    if (!v1.success) return { success: false, error: v1.error }
    const v2 = validateInput(genericStringSchema, end)
    if (!v2.success) return { success: false, error: v2.error }
    return wrap(() => auditService.generateReport(start, end))
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_GET_CONFIG, async () => {
    return wrap(() => auditService.getConfig())
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_SET_CONFIG, async (_, config: Partial<AuditConfig>) => {
    const v = validateInput(genericObjectSchema, config)
    if (!v.success) return { success: false, error: v.error }
    auditService.setConfig(config)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_CLEAR, async () => {
    auditService.clear()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.AUDIT_COUNT, async () => {
    return wrap(() => auditService.count())
  })

  // ===== [升级 6] 安全策略模板 =====
  ipcMain.handle(IPC_CHANNELS.SECURITY_PRESETS_LIST, async () => {
    return wrap(() => securityService.listPresets())
  })

  ipcMain.handle(IPC_CHANNELS.SECURITY_PRESET_APPLY, async (_, level: SecurityPresetLevel) => {
    const v = validateInput(genericStringSchema, level)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => {
      const result = securityService.applyPreset(level)
      // 应用护栏规则
      if (result.guardrailRules.length > 0) {
        guardrailService.setRules(result.guardrailRules)
      }
      // 应用 HITL 中断点
      if (result.hitlInterruptPoints.length > 0) {
        hitlService.setConfig({
          ...hitlService.getConfig(),
          interruptPoints: result.hitlInterruptPoints,
        })
      }
      return result
    })
  })
}
