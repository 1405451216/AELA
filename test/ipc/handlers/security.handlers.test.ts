/**
 * Security IPC handler 单测（.security.handlers.test.ts）
 *
 * 覆盖核心 handler：security:get-config / security:set-config / security:check-access / guardrail:check
 * 重点：handler 存在 + 调用正确的 service 方法 + 参数正确 + 多个 service 协作
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron 模块 =====
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

// ===== Mock 服务 =====

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

// ===== 测试用例 =====
describe('Security IPC Handlers (.handlers)', () => {
  let mockSecurityService: ReturnType<typeof makeMockSecurityService>
  let mockGuardrailService: ReturnType<typeof makeMockGuardrailService>
  let mockAuditService: ReturnType<typeof makeMockAuditService>
  let mockHITLService: ReturnType<typeof makeMockHITLService>

  /** 注册 handler 的便捷封装 */
  function register() {
    registerSecurityHandlers({
      securityService: mockSecurityService,
      guardrailService: mockGuardrailService,
      auditService: mockAuditService,
      hitlService: mockHITLService,
    })
  }

  beforeEach(() => {
    handlers.clear()
    mockSecurityService = makeMockSecurityService()
    mockGuardrailService = makeMockGuardrailService()
    mockAuditService = makeMockAuditService()
    mockHITLService = makeMockHITLService()
    register()
  })

  // ===== security:get-config =====
  describe('security:get-config', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.SECURITY_GET_CONFIG)).toBeDefined()
    })

    it('返回 securityService.getConfig 的内容', async () => {
      const getConfig = vi.fn().mockReturnValue({
        aclRules: [{ agentId: '*', resource: '*', level: 'read' }],
        allowedCommands: ['ls'],
        blockedCommands: ['rm'],
      })
      Object.assign(mockSecurityService, { getConfig })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_GET_CONFIG)!

      const result = await handler({})
      expect(getConfig).toHaveBeenCalled()
      expect(result).toEqual({
        success: true,
        data: {
          aclRules: [{ agentId: '*', resource: '*', level: 'read' }],
          allowedCommands: ['ls'],
          blockedCommands: ['rm'],
        },
      })
    })
  })

  // ===== security:set-config =====
  describe('security:set-config', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.SECURITY_SET_CONFIG)).toBeDefined()
    })

    it('调用 securityService.setConfig 并传入参数', async () => {
      const setConfig = vi.fn()
      Object.assign(mockSecurityService, { setConfig })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_SET_CONFIG)!

      const newConfig = { aclRules: [], allowedCommands: ['ls'], blockedCommands: ['rm'] }
      const result = await handler({}, newConfig)
      expect(setConfig).toHaveBeenCalledWith(newConfig)
      expect(result).toEqual({ success: true })
    })
  })

  // ===== security:check-access =====
  describe('security:check-access', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.SECURITY_CHECK_ACCESS)).toBeDefined()
    })

    it('透传 agentId、resource、level 三个参数到 securityService.checkAccess', async () => {
      const checkAccess = vi.fn().mockReturnValue({ allowed: true })
      Object.assign(mockSecurityService, { checkAccess })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_CHECK_ACCESS)!

      const result = await handler({}, 'agent-1', '/path/to/file', 'read')
      expect(checkAccess).toHaveBeenCalledWith('agent-1', '/path/to/file', 'read')
      expect(result).toEqual({ success: true, data: { allowed: true } })
    })

    it('访问被拒绝时返回拒绝原因', async () => {
      const checkAccess = vi.fn().mockReturnValue({ allowed: false, error: 'denied by rule' })
      Object.assign(mockSecurityService, { checkAccess })
      const handler = handlers.get(IPC_CHANNELS.SECURITY_CHECK_ACCESS)!

      const result = await handler({}, 'agent-1', '/etc/passwd', 'write')
      expect(result).toEqual({ success: true, data: { allowed: false, error: 'denied by rule' } })
    })
  })

  // ===== guardrail:check =====
  describe('guardrail:check', () => {
    it('应存在 handler', () => {
      expect(handlers.get(IPC_CHANNELS.GUARDRAIL_CHECK)).toBeDefined()
    })

    it('透传 input 和 point 到 guardrailService.check', async () => {
      const check = vi.fn().mockReturnValue({ passed: true, results: [] })
      Object.assign(mockGuardrailService, { check })
      const handler = handlers.get(IPC_CHANNELS.GUARDRAIL_CHECK)!

      const result = await handler({}, 'safe text', 'input')
      expect(check).toHaveBeenCalledWith('safe text', 'input')
      expect(result).toEqual({ success: true, data: { passed: true, results: [] } })
    })

    it('检测到违规时返回 blocked 报告', async () => {
      const check = vi.fn().mockReturnValue({
        passed: false,
        action: 'block',
        results: [{ message: 'PII detected' }],
      })
      Object.assign(mockGuardrailService, { check })
      const handler = handlers.get(IPC_CHANNELS.GUARDRAIL_CHECK)!

      const result = await handler({}, 'my SSN is 123-45-6789', 'input')
      expect(result).toMatchObject({ success: true, data: { passed: false } })
    })
  })
})
