/**
 * E2E 核心用户流程走查
 *
 * 在服务层验证 AELA 的核心用户流程：
 * 1. 会话生命周期：创建 → 添加消息 → 读取 → 搜索 → 导出 → 删除
 * 2. 记忆系统：添加 → 混合搜索 → 统计
 * 3. 安全防护：命令风险评估 + 路径穿越防护 + Inspector 认证
 * 4. 国际化：translateF 注入防护 + setLang 隔离
 *
 * 通过真实服务实例（非 mock）验证端到端行为。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync, rmSync, existsSync } from 'fs'

// ===== Mock electron / electron-store（必须在所有 import 之前） =====
const mockStoreData: Record<string, unknown> = {}
const TEST_DATA_DIR = join(tmpdir(), `aela-e2e-core-${process.pid}`)

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { isPackaged: true, getPath: () => TEST_DATA_DIR },
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    get(key: string, def?: unknown) { return (mockStoreData[key] ?? def) }
    set(key: string, val: unknown) { mockStoreData[key] = val }
  },
}))

// 静态 import（在 vi.mock 之后解析）
import { SessionStore } from '../../src/main/services/SessionStore'
import { TerminalService } from '../../src/main/services/TerminalService'
import { DebuggerService } from '../../src/main/services/DebuggerService'
import { assessCommandRisk } from '../../src/main/services/tools/shellRisk'
import { safeResolve } from '../../src/main/services/tools/pathSafety'
import * as i18n from '../../src/shared/i18n'

// ===== 流程 1：会话生命周期 =====
describe('E2E: 会话生命周期', () => {
  let store: SessionStore

  beforeEach(() => {
    if (existsSync(TEST_DATA_DIR)) rmSync(TEST_DATA_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DATA_DIR, { recursive: true })
    mockStoreData.commandHistory = []
    store = new SessionStore()
  })

  afterEach(() => {
    store?.stop()
    rmSync(TEST_DATA_DIR, { recursive: true, force: true })
  })

  it('完整流程：创建 → 添加消息 → 搜索 → 导出 → 删除', () => {
    // 1. 创建会话
    const session = store.createSession({ title: 'E2E 测试会话', workspaceId: 'ws-1' })
    expect(session.id).toBeDefined()
    expect(session.title).toBe('E2E 测试会话')

    // 2. 添加消息
    store.addMessage({ id: randomUUID(), sessionId: session.id, role: 'user', content: '你好 AELA，请帮我分析代码', createdAt: new Date().toISOString() })
    store.addMessage({ id: randomUUID(), sessionId: session.id, role: 'assistant', content: '好的，我来帮你分析。请提供代码文件路径。', createdAt: new Date().toISOString() })
    store.addMessage({ id: randomUUID(), sessionId: session.id, role: 'user', content: '这个项目使用了 React 和 TypeScript', createdAt: new Date().toISOString() })

    // 3. 读取消息
    const messages = store.getMessages(session.id)
    expect(messages.length).toBe(3)
    expect(messages[0].role).toBe('user')
    expect(messages[2].content).toContain('React')

    // 4. 搜索会话（FTS5）
    const searchResults = store.searchSessions('React')
    expect(searchResults.length).toBeGreaterThan(0)
    expect(searchResults[0].session.id).toBe(session.id)

    // 5. 导出会话（Markdown）
    const exported = store.exportSession(session.id, {
      format: 'markdown',
      includeMetrics: true,
      includeToolCalls: true,
      includeSystemMessages: false,
    })
    expect(exported).not.toBeNull()
    expect(exported!.content).toContain('E2E 测试会话')
    expect(exported!.content).toContain('你好 AELA')

    // 6. 删除会话
    store.deleteSession(session.id)
    expect(store.getSession(session.id)).toBeNull()
    expect(store.getMessages(session.id).length).toBe(0)
  })

  it('searchMessages 使用 FTS5 返回跨会话结果', () => {
    const s1 = store.createSession({ title: '会话 A' })
    const s2 = store.createSession({ title: '会话 B' })

    store.addMessage({ id: randomUUID(), sessionId: s1.id, role: 'user', content: 'discuss database optimization', createdAt: new Date().toISOString() })
    store.addMessage({ id: randomUUID(), sessionId: s2.id, role: 'assistant', content: 'database index improves query performance', createdAt: new Date().toISOString() })

    const results = store.searchMessages('database')
    expect(results.length).toBe(2)

    store.deleteSession(s1.id)
    store.deleteSession(s2.id)
  })
})

// ===== 流程 2：安全防护 =====
describe('E2E: 安全防护', () => {
  describe('命令风险评估', () => {
    it('安全命令应通过', () => {
      expect(assessCommandRisk('ls -la').risk).toBe('safe')
      expect(assessCommandRisk('cat file.txt').risk).toBe('safe')
      expect(assessCommandRisk('git status').risk).toBe('safe')
    })

    it('危险命令应被标记', () => {
      expect(assessCommandRisk('rm -rf /').risk).toBe('dangerous')
      expect(assessCommandRisk('sudo su').risk).toBe('dangerous')
      expect(assessCommandRisk('chmod 777 /').risk).toBe('dangerous')
      expect(assessCommandRisk('mkfs /dev/sda').risk).toBe('dangerous')
    })

    it('命令注入应被检测', () => {
      const result = assessCommandRisk('echo hello; rm -rf /')
      expect(result.risk).toBe('dangerous')
      expect(result.reasons.length).toBeGreaterThan(0)
    })

    it('sudo 前缀 + 安全命令仍标记为危险', () => {
      expect(assessCommandRisk('sudo cat /etc/passwd').risk).toBe('dangerous')
    })
  })

  describe('路径穿越防护', () => {
    const root = '/workspace/project'

    it('允许正常路径', () => {
      expect(() => safeResolve(root, 'src/index.ts')).not.toThrow()
      expect(() => safeResolve(root, './components/App.tsx')).not.toThrow()
      expect(() => safeResolve(root, '/workspace/project/lib/utils.js')).not.toThrow()
    })

    it('阻止 ../ 穿越', () => {
      expect(() => safeResolve(root, '../../../etc/passwd')).toThrow('路径穿越被阻止')
      expect(() => safeResolve(root, '/workspace/project/../../etc/shadow')).toThrow('路径穿越被阻止')
    })

    it('阻止绝对路径逃逸', () => {
      expect(() => safeResolve(root, '/etc/passwd')).toThrow('路径穿越被阻止')
    })
  })

  describe('Inspector 认证', () => {
    it('每次实例生成唯一 token', () => {
      const svc1 = new DebuggerService()
      const svc2 = new DebuggerService()
      expect(svc1.getInspectorToken()).not.toBe(svc2.getInspectorToken())
      expect(svc1.getInspectorToken().length).toBeGreaterThan(0)
      svc1.stop(); svc2.stop()
    })

    it('停止后清理资源', () => {
      const svc = new DebuggerService()
      svc.startInspector(19999)
      expect(svc.isInspectorRunning()).toBe(true)
      svc.stopInspector()
      expect(svc.isInspectorRunning()).toBe(false)
      svc.stop()
    })
  })
})

// ===== 流程 4：国际化 =====
describe('E2E: 国际化 (i18n)', () => {
  it('translateF 不应受 $& 等特殊模式影响', () => {
    // 使用真实含 {param} 的 key，传入含特殊替换模式的值
    const result = i18n.translateF('automation.runCount', { n: 'a$&b' })
    // 回调替换：'a$&b' 应原样保留，不会被当作替换模式
    expect(result).toContain('a$&b')
  })

  it('translateF 不应受 regex 特殊字符 key 影响', () => {
    // key 含正则特殊字符 . 应被正确转义
    expect(() => i18n.translateF('skills.dedup.merged', { n: '5' })).not.toThrow()
  })

  it('setLang 监听器异常不应中断其他监听器', () => {
    const calls: string[] = []
    const unsub1 = i18n.subscribeLang(() => { calls.push('first') })
    const unsub2 = i18n.subscribeLang(() => { throw new Error('监听器异常') })
    const unsub3 = i18n.subscribeLang(() => { calls.push('third') })

    i18n.setLang('en')

    expect(calls).toContain('first')
    expect(calls).toContain('third')
    unsub1(); unsub2(); unsub3()
  })
})

// ===== 流程 5：TerminalService 安全 =====
describe('E2E: TerminalService 安全', () => {
  it('runCommand 应拦截危险命令', async () => {
    const service = new TerminalService(() => null)

    const result = await service.runCommand('rm -rf /')
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('安全拦截')

    service.stop()
  })

  it('runCommand 应允许安全命令', async () => {
    const service = new TerminalService(() => null)

    // echo 是安全命令
    const result = await service.runCommand('echo hello')
    expect(result.exitCode).toBe(0)
    expect(result.stderr).not.toContain('安全拦截')

    service.stop()
  })
})
