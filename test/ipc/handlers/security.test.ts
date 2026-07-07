/**
 * Security IPC handler 单测
 *
 * 覆盖：SECURITY_GET/SET_CONFIG / SECURITY_CHECK_ACCESS / GUARDRAIL_CHECK /
 *       AUDIT_LOG / AUDIT_QUERY / SECURITY_PRESET_APPLY
 * 重点：service 调用透传 + preset 应用级联到 guardrail + hitl
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn)
    },
  },
}))

import { registerSecurityHandlers } from '../../../src/main/ipc/handlers/security'
import { IPC_CHANNELS } from '../../../src/shared/types'

function makeMockSecurityService(overrides: Partial<{
  getConfig: ReturnType<typeof vi.fn>
  setConfig: ReturnType<typeof vi.fn>
  checkAccess: ReturnType<typeof vi.fn>
  listPresets: ReturnType<typeof vi.fn>
  applyPreset: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    getConfig: overrides.getConfig ?? vi.fn().mockReturnValue({ aclRules: [], allowedCommands: [], blockedCommands: [] }),
    setConfig: overrides.setConfig ?? vi.fn(),
    checkAccess: overrides.checkAccess ?? vi.fn().mockReturnValue({ allowed: true }),
    listPresets: overrides.listPresets ?? vi.fn().mockReturnValue([]),
    applyPreset: overrides.applyPreset ?? vi.fn().mockReturnValue({
      applied: true,
      preset: { level: 'standard' },
      sandboxConfig: { aclRules: [], allowedCommands: [], blockedCommands: [] },
      guardrailRules: [],
      hitlInterruptPoints: [],
    }),
  } as never
}

function makeMockGuardrailService(overrides: Partial<{
  check: ReturnType<typeof vi.fn>
  getRules: ReturnType<typeof vi.fn>
  setRules: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    check: overrides.check ?? vi.fn().mockReturnValue({ passed: true, results: [] }),
    getRules: overrides.getRules ?? vi.fn().mockReturnValue([]),
    setRules: overrides.setRules ?? vi.fn(),
  } as never
}

function makeMockAuditService(overrides: Partial<{
  log: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
  generateReport: ReturnType<typeof vi.fn>
  getConfig: ReturnType<typeof vi.fn>
  setConfig: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  count: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    log: overrides.log ?? vi.fn(),
    query: overrides.query ?? vi.fn().mockReturnValue([]),
    generateReport: overrides.generateReport ?? vi.fn().mockReturnValue({}),
    getConfig: overrides.getConfig ?? vi.fn().mockReturnValue({}),
    setConfig: overrides.setConfig ?? vi.fn(),
    clear: overrides.clear ?? vi.fn(),
    count: overrides.count ?? vi.fn().mockReturnValue(0),
  } as never
}

function makeMockHITLService(overrides: Partial<{
  getConfig: ReturnType<typeof vi.fn>
  setConfig: ReturnType<typeof vi.fn>
}> = {}) {
  return {
    getConfig: overrides.getConfig ?? vi.fn().mockReturnValue({ interruptPoints: [] }),
    setConfig: overrides.setConfig ?? vi.fn(),
  } as never
}

describe('security IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
  })

  // ===== SECURITY_GET/SET_CONFIG =====
  describe('SECURITY_GET_CONFIG / SET_CONFIG', () => {
    it('returns sandbox config from getConfig', async () => {
      const getConfig = vi.fn().mockReturnValue({ aclRules: [{ agentId: '*', resource: '*', level: 'read', denied: false }] })
      const svc = makeMockSecurityService({ getConfig })
      registerSecurityHandlers({
        securityService: svc,
        guardrailService: makeMockGuardrailService(),
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_GET_CONFIG)!

      const result = await handler({})
      expect(getConfig).toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        data: { aclRules: [{ agentId: '*', resource: '*', level: 'read', denied: false }] },
      })
    })

    it('applies setConfig to security service', async () => {
      const setConfig = vi.fn()
      const svc = makeMockSecurityService({ setConfig })
      registerSecurityHandlers({
        securityService: svc,
        guardrailService: makeMockGuardrailService(),
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_SET_CONFIG)!

      const newConfig = { aclRules: [], allowedCommands: ['ls'], blockedCommands: ['rm'] }
      const result = await handler({}, newConfig)

      expect(setConfig).toHaveBeenCalledWith(newConfig)
      expect(result).toEqual({ success: true })
    })
  })

  // ===== SECURITY_CHECK_ACCESS =====
  describe('SECURITY_CHECK_ACCESS', () => {
    it('returns allowed: true when access granted', async () => {
      const checkAccess = vi.fn().mockReturnValue({ allowed: true })
      const svc = makeMockSecurityService({ checkAccess })
      registerSecurityHandlers({
        securityService: svc,
        guardrailService: makeMockGuardrailService(),
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_CHECK_ACCESS)!

      const result = await handler({}, 'agent-1', '/etc/passwd', 'read')
      expect(checkAccess).toHaveBeenCalledWith('agent-1', '/etc/passwd', 'read')
      expect(result).toEqual({ success: true, data: { allowed: true } })
    })

    it('returns error message when access denied', async () => {
      const checkAccess = vi.fn().mockReturnValue({ allowed: false, error: 'denied by rule' })
      const svc = makeMockSecurityService({ checkAccess })
      registerSecurityHandlers({
        securityService: svc,
        guardrailService: makeMockGuardrailService(),
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_CHECK_ACCESS)!

      const result = await handler({}, 'agent-1', '/etc/passwd', 'write')
      expect(result).toEqual({ success: true, data: { allowed: false, error: 'denied by rule' } })
    })
  })

  // ===== GUARDRAIL_CHECK =====
  describe('GUARDRAIL_CHECK', () => {
    it('returns passed report', async () => {
      const check = vi.fn().mockReturnValue({ passed: true, results: [] })
      const gsvc = makeMockGuardrailService({ check })
      registerSecurityHandlers({
        securityService: makeMockSecurityService(),
        guardrailService: gsvc,
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.GUARDRAIL_CHECK)!

      const result = await handler({}, 'safe text', 'input')
      expect(check).toHaveBeenCalledWith('safe text', 'input')
      expect(result).toEqual({ success: true, data: { passed: true, results: [] } })
    })

    it('returns blocked report with reasons', async () => {
      const check = vi.fn().mockReturnValue({
        passed: false,
        action: 'block',
        results: [{ message: 'PII detected' }],
      })
      const gsvc = makeMockGuardrailService({ check })
      registerSecurityHandlers({
        securityService: makeMockSecurityService(),
        guardrailService: gsvc,
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.GUARDRAIL_CHECK)!

      const result = await handler({}, 'my SSN is 123-45-6789', 'input')
      expect(result).toMatchObject({ success: true, data: { passed: false } })
    })
  })

  // ===== AUDIT =====
  describe('AUDIT_LOG / QUERY / COUNT', () => {
    it('AUDIT_LOG calls auditService.log and returns success', async () => {
      const log = vi.fn()
      const asvc = makeMockAuditService({ log })
      registerSecurityHandlers({
        securityService: makeMockSecurityService(),
        guardrailService: makeMockGuardrailService(),
        auditService: asvc,
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.AUDIT_LOG)!

      const result = await handler({}, {
        actor: 'user-1',
        action: 'tool_call',
        resource: 'file.txt',
        result: 'success',
      })
      expect(log).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })

    it('AUDIT_QUERY returns array of events', async () => {
      const query = vi.fn().mockReturnValue([{ id: 'e1', actor: 'user-1' }])
      const asvc = makeMockAuditService({ query })
      registerSecurityHandlers({
        securityService: makeMockSecurityService(),
        guardrailService: makeMockGuardrailService(),
        auditService: asvc,
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.AUDIT_QUERY)!

      const result = await handler({}, { actor: 'user-1' })
      expect(result).toEqual({ success: true, data: [{ id: 'e1', actor: 'user-1' }] })
    })

    it('AUDIT_COUNT returns number', async () => {
      const count = vi.fn().mockReturnValue(42)
      const asvc = makeMockAuditService({ count })
      registerSecurityHandlers({
        securityService: makeMockSecurityService(),
        guardrailService: makeMockGuardrailService(),
        auditService: asvc,
        hitlService: makeMockHITLService(),
      })
      const handler = handlers.get(IPC_CHANNELS.AUDIT_COUNT)!

      const result = await handler({})
      expect(result).toEqual({ success: true, data: 42 })
    })
  })

  // ===== SECURITY_PRESET_APPLY =====
  describe('SECURITY_PRESET_APPLY', () => {
    it('cascades preset to guardrail + hitl when rules present', async () => {
      const setRules = vi.fn()
      const setConfig = vi.fn()
      const getConfig = vi.fn().mockReturnValue({ interruptPoints: [] })
      const applyPreset = vi.fn().mockReturnValue({
        applied: true,
        preset: { level: 'strict' },
        sandboxConfig: { aclRules: [], allowedCommands: [], blockedCommands: [] },
        guardrailRules: [{ id: 'r1', name: 'strict-injection', type: 'injection', enabled: true, checkPoint: 'input' }],
        hitlInterruptPoints: [{ type: 'tool_confirm', toolName: '*', message: 'confirm' }],
      })
      registerSecurityHandlers({
        securityService: makeMockSecurityService({ applyPreset }),
        guardrailService: makeMockGuardrailService({ setRules }),
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService({ setConfig, getConfig }),
      })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_PRESET_APPLY)!

      const result = await handler({}, 'strict')

      expect(applyPreset).toHaveBeenCalledWith('strict')
      expect(setRules).toHaveBeenCalledWith([{ id: 'r1', name: 'strict-injection', type: 'injection', enabled: true, checkPoint: 'input' }])
      expect(setConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          interruptPoints: [{ type: 'tool_confirm', toolName: '*', message: 'confirm' }],
        }),
      )
      expect(result).toMatchObject({ success: true })
    })

    it('skips guardrail/hitl apply when preset has no rules', async () => {
      const setRules = vi.fn()
      const setConfig = vi.fn()
      const applyPreset = vi.fn().mockReturnValue({
        applied: true,
        preset: { level: 'relaxed' },
        sandboxConfig: { aclRules: [], allowedCommands: [], blockedCommands: [] },
        guardrailRules: [],
        hitlInterruptPoints: [],
      })
      registerSecurityHandlers({
        securityService: makeMockSecurityService({ applyPreset }),
        guardrailService: makeMockGuardrailService({ setRules }),
        auditService: makeMockAuditService(),
        hitlService: makeMockHITLService({ setConfig }),
      })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_PRESET_APPLY)!

      await handler({}, 'relaxed')

      expect(setRules).not.toHaveBeenCalled()
      expect(setConfig).not.toHaveBeenCalled()
    })
  })
})
