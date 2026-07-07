/**
 * TerminalService 单元测试
 *
 * 覆盖: 会话创建 / 输入与命令记录 / 多 Tab 管理 / 销毁 / 命令历史
 *       runCommand 安全拦截（危险命令）+ 正常执行（mocked exec）
 *
 * 通过 vi.mock 隔离 node:child_process 与 electron-store，避免真实派生终端进程。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ===== 隔离原生依赖 =====

const cp = vi.hoisted(() => {
  const makeFakeProcess = () => ({
    stdin: { write: vi.fn() },
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    emit: vi.fn(),
  })
  const spawnMock = vi.fn((..._args: unknown[]) => makeFakeProcess())
  const execMock = vi.fn((_cmd: unknown, _opts: unknown, cb: (err: unknown, stdout: string, stderr: string) => void) => cb(null, '', ''))
  return { spawnMock, execMock }
})

vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => cp.spawnMock(...args),
  exec: (...args: unknown[]) => cp.execMock(...args),
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
  default: class MockBrowserWindow {},
}))

vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, unknown> = {}
    constructor(opts: { defaults?: Record<string, unknown> }) {
      this.data = { ...(opts?.defaults ?? {}) }
    }
    get(key: string, defaultValue?: unknown) {
      return key in this.data ? this.data[key] : defaultValue
    }
    set(key: string, value: unknown) {
      this.data[key] = value
    }
    clear() {
      this.data = {}
    }
  },
}))

import { TerminalService } from '../../src/main/services/TerminalService'

describe('TerminalService', () => {
  let service: TerminalService
  const getMainWindow = () => null

  beforeEach(() => {
    cp.spawnMock.mockClear()
    cp.execMock.mockImplementation((_cmd, _opts, cb) => cb(null, '', ''))
    service = new TerminalService(getMainWindow)
  })

  afterEach(() => {
    service.stop()
  })

  // ===== 创建与列表 =====

  describe('create / list', () => {
    it('构造函数不应抛出异常', () => {
      expect(() => new TerminalService(getMainWindow)).not.toThrow()
    })

    it('create 返回唯一 id 并出现在 list() 中', () => {
      const id = service.create()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(service.list()).toContain(id)
    })

    it('listTabs 反映新会话为 active', () => {
      const id = service.create()
      const tabs = service.listTabs()
      expect(tabs).toHaveLength(1)
      expect(tabs[0].id).toBe(id)
      expect(tabs[0].isActive).toBe(true)
    })

    it('create 可自定义标题', () => {
      const id = service.create({ title: 'My Term' })
      expect(service.listTabs().find(t => t.id === id)?.title).toBe('My Term')
    })
  })

  // ===== 输入与命令记录 =====

  describe('input', () => {
    it('向存在的会话发送输入返回 true', () => {
      const id = service.create()
      expect(service.input(id, 'ls')).toBe(true)
    })

    it('向不存在的会话发送输入返回 false', () => {
      expect(service.input('nope', 'ls')).toBe(false)
    })

    it('回车触发命令历史记录（先缓冲字符再回车）', () => {
      const id = service.create()
      const before = service.getCommandHistory().length
      // 真实终端按字符缓冲，回车时提交整条命令
      service.input(id, 'echo hello')
      service.input(id, '\r')
      const after = service.getCommandHistory().length
      expect(after).toBe(before + 1)
      const hist = service.getCommandHistory()
      expect(hist[0].command).toBe('echo hello')
    })
  })

  // ===== 多 Tab 管理 =====

  describe('Tab 管理', () => {
    it('setActiveTab 更新 activeTab', () => {
      const a = service.create({ title: 'A' })
      const b = service.create({ title: 'B' })
      expect(service.setActiveTab(b)).toBe(true)
      expect(service.getActiveTab()).toBe(b)
      expect(service.setActiveTab(a)).toBe(true)
      expect(service.getActiveTab()).toBe(a)
    })

    it('setActiveTab 对未知 id 返回 false', () => {
      service.create()
      expect(service.setActiveTab('ghost')).toBe(false)
    })

    it('setTabTitle 更新标题', () => {
      const id = service.create({ title: 'old' })
      expect(service.setTabTitle(id, 'renamed')).toBe(true)
      expect(service.listTabs().find(t => t.id === id)?.title).toBe('renamed')
    })

    it('setTabTitle 对未知 id 返回 false', () => {
      expect(service.setTabTitle('ghost', 'x')).toBe(false)
    })

    it('linkToAgent 标记 agentLinked 并改名', () => {
      const id = service.create({ title: 't' })
      expect(service.linkToAgent(id)).toBe(true)
      const tab = service.listTabs().find(t => t.id === id)
      expect(tab?.agentLinked).toBe(true)
      expect(tab?.title).toBe('Agent Terminal')
    })
  })

  // ===== 销毁 =====

  describe('destroy', () => {
    it('destroy 移除会话', () => {
      const id = service.create()
      expect(service.destroy(id)).toBe(true)
      expect(service.list()).not.toContain(id)
    })

    it('destroy 未知 id 返回 false', () => {
      expect(service.destroy('ghost')).toBe(false)
    })

    it('destroyAll 清空所有会话', () => {
      service.create()
      service.create()
      service.destroyAll()
      expect(service.list()).toHaveLength(0)
    })
  })

  // ===== 命令历史 =====

  describe('命令历史', () => {
    it('getCommandHistory 按时间倒序', () => {
      const id = service.create()
      service.input(id, 'cmd-one')
      service.input(id, '\r')
      service.input(id, 'cmd-two')
      service.input(id, '\r')
      const hist = service.getCommandHistory()
      expect(hist[0].command).toBe('cmd-two')
      expect(hist[1].command).toBe('cmd-one')
    })

    it('getCommandHistory 可按 terminalId 过滤', () => {
      const id = service.create()
      service.input(id, 'abc\r')
      service.runCommand('echo xyz')
      const agentHist = service.getCommandHistory('agent-exec')
      expect(agentHist.length).toBeGreaterThanOrEqual(1)
      expect(agentHist.every(h => h.terminalId === 'agent-exec')).toBe(true)
    })

    it('clearCommandHistory 清空历史', () => {
      const id = service.create()
      service.input(id, 'something\r')
      service.clearCommandHistory()
      expect(service.getCommandHistory()).toHaveLength(0)
    })
  })

  // ===== runCommand =====

  describe('runCommand', () => {
    it('危险命令被安全拦截（不调用 exec）', async () => {
      cp.execMock.mockClear()
      const result = await service.runCommand('rm -rf /')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('安全拦截')
      expect(cp.execMock).not.toHaveBeenCalled()
    })

    it('安全命令通过 exec 执行并返回输出', async () => {
      cp.execMock.mockImplementation((_cmd, _opts, cb) => cb(null, 'hello-out', ''))
      const result = await service.runCommand('echo hello')
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('hello-out')
    })

    it('exec 错误时退出码非 0', async () => {
      cp.execMock.mockImplementation((_cmd, _opts, cb) =>
        cb(Object.assign(new Error('boom'), { code: 'ENOENT' }), '', 'err'),
      )
      const result = await service.runCommand('missing-binary')
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toBe('err')
    })

    it('runCommand 记录到命令历史', async () => {
      cp.execMock.mockImplementation((_cmd, _opts, cb) => cb(null, 'ok', ''))
      const before = service.getCommandHistory('agent-exec').length
      await service.runCommand('echo recorded')
      const after = service.getCommandHistory('agent-exec').length
      expect(after).toBe(before + 1)
    })
  })
})
