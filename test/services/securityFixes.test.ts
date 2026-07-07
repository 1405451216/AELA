/**
 * Security fixes 单元测试
 * 验证 code review 中发现的 CRITICAL/HIGH 安全问题已修复
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mock electron + electron-store =====
const mockStoreData: Record<string, unknown> = {}

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { isPackaged: true, getPath: vi.fn(() => '/tmp/test') },
}))

vi.mock('electron-store', () => {
  class MockStore {
    get(key: string, def?: unknown) { return (mockStoreData[key] ?? def) }
    set(key: string, val: unknown) { mockStoreData[key] = val }
  }
  return { default: MockStore }
})

// ===== 测试 1: TerminalService.runCommand 阻止危险命令 =====
describe('TerminalService.runCommand 安全检查', () => {
  let terminalService: { runCommand: (cmd: string) => Promise<{ exitCode: number; stderr: string }> }

  beforeEach(async () => {
    mockStoreData.commandHistory = []
    const mod = await import('../../src/main/services/TerminalService')
    terminalService = new mod.TerminalService(() => null)
  })

  it('应阻止 rm -rf 等危险命令', async () => {
    const result = await terminalService.runCommand('rm -rf /')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('安全拦截')
    expect(result.stderr).toContain('危险命令')
  })

  it('应阻止 sudo 提权命令', async () => {
    const result = await terminalService.runCommand('sudo cat /etc/shadow')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('安全拦截')
  })

  it('应阻止 disk格式化命令', async () => {
    const result = await terminalService.runCommand('mkfs /dev/sda')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('安全拦截')
  })

  it('应阻止包含命令注入的命令', async () => {
    const result = await terminalService.runCommand('echo hello; rm -rf /')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('安全拦截')
  })

  it('应允许安全的只读命令（不会被安全检查拦截）', async () => {
    // 验证 echo 命令被风险评估为 safe（不会触发安全拦截逻辑）
    const { assessCommandRisk } = await import('../../src/main/services/tools/shellRisk')
    const assessment = assessCommandRisk('echo hello')
    expect(assessment.risk).toBe('safe')
  })
})

// ===== 测试 2: HookConfigService.executeShell 阻止危险命令 =====
describe('HookConfigService.executeShell 安全检查', () => {
  let hookService: {
    executeHooks: (ctx: unknown) => Promise<Array<{ action: string; error?: string }>>
  }

  beforeEach(async () => {
    const mod = await import('../../src/main/services/HookConfigService')
    hookService = new mod.HookConfigService()
  })

  it('危险命令的 shell action 应返回安全拦截', async () => {
    // HookConfigService 使用 rule.actions 数组
    (hookService as unknown as { rules: Array<{ enabled: boolean; eventPoint: string; actions: Array<{ type: string; command: string }> }> }).rules = [
      { enabled: true, eventPoint: 'after_tool', actions: [{ type: 'shell', command: 'rm -rf /tmp/*' }] },
    ]
    const results = await hookService.executeHooks({
      eventPoint: 'after_tool',
      agentId: 'test',
      sessionId: 'test',
      turn: 1,
    })
    expect(results.length).toBeGreaterThan(0)
    const r = results[0]
    // executeShell 的安全拦截消息写入 result.output
    expect(r.output ?? '').toContain('安全拦截')
  })
})

// ===== 测试 3: DebuggerService Inspector 认证 =====
describe('DebuggerService Inspector 安全', () => {
  let debuggerService: {
    startInspector: (port?: number) => number
    getInspectorToken: () => string
    stop: () => void
  }

  beforeEach(async () => {
    const mod = await import('../../src/main/services/DebuggerService')
    debuggerService = new mod.DebuggerService()
  })

  it('应生成 Inspector 认证 token', () => {
    debuggerService.startInspector(19999)
    const token = debuggerService.getInspectorToken()
    expect(token).toBeDefined()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    debuggerService.stop()
  })

  it('每次实例应有不同的 token', async () => {
    const mod = await import('../../src/main/services/DebuggerService')
    const svc1 = new mod.DebuggerService()
    const svc2 = new mod.DebuggerService()
    svc1.startInspector(19998)
    svc2.startInspector(19997)
    expect(svc1.getInspectorToken()).not.toBe(svc2.getInspectorToken())
    svc1.stop()
    svc2.stop()
  })
})

// ===== 测试 4: safeResolve 路径穿越防护 =====
describe('safeResolve 路径穿越防护', () => {
  let safeResolve: (root: string, p: string) => string

  beforeEach(async () => {
    const mod = await import('../../src/main/services/tools/pathSafety')
    safeResolve = mod.safeResolve
  })

  it('应允许根目录内的正常路径', () => {
    expect(() => safeResolve('/workspace', '/workspace/file.ts')).not.toThrow()
    expect(() => safeResolve('/workspace', 'file.ts')).not.toThrow()
    expect(() => safeResolve('/workspace', './src/index.ts')).not.toThrow()
  })

  it('应阻止 ../ 路径穿越', () => {
    expect(() => safeResolve('/workspace', '../../../etc/passwd')).toThrow('路径穿越被阻止')
    expect(() => safeResolve('/workspace', '/workspace/../../etc/shadow')).toThrow('路径穿越被阻止')
  })

  it('应阻止跨驱动器访问（Windows）', () => {
    expect(() => safeResolve('C:\\workspace', 'D:\\secret.txt')).toThrow('路径穿越被阻止')
  })
})
