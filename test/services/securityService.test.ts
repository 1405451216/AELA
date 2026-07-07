/**
 * SecurityService 单元测试
 *
 * 覆盖: ACL 访问控制 / 命令白名单黑名单 / 文件作用域 / 安全策略模板
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityService } from '../../src/main/services/SecurityService'
import type { SandboxConfig, ACLRule } from '@shared/types'

describe('SecurityService', () => {
  let service: SecurityService

  beforeEach(() => {
    service = new SecurityService()
  })

  describe('默认配置', () => {
    it('默认配置为空（不含 ACL 规则）', () => {
      const config = service.getConfig()
      expect(config.aclRules).toHaveLength(0)
      expect(config.allowedCommands).toHaveLength(0)
      expect(config.blockedCommands).toHaveLength(0)
    })
  })

  describe('ACL 规则管理', () => {
    it('addACLRule 添加允许规则', () => {
      const rule: ACLRule = {
        agentId: 'agent-1',
        resource: '/project/*',
        level: 'write',
        denied: false,
      }
      service.addACLRule(rule)
      const config = service.getConfig()
      expect(config.aclRules).toContainEqual(rule)
    })

    it('addACLRule 添加拒绝规则', () => {
      const rule: ACLRule = {
        agentId: 'agent-1',
        resource: '/secret/*',
        level: 'read',
        denied: true,
      }
      service.addACLRule(rule)
      const config = service.getConfig()
      expect(config.aclRules).toContainEqual(rule)
    })

    it('setConfig 重建配置', () => {
      const config: SandboxConfig = {
        aclRules: [
          { agentId: '*', resource: '*', level: 'read', denied: false },
          { agentId: '*', resource: '*', level: 'write', denied: false },
        ],
        allowedCommands: ['git', 'npm'],
        blockedCommands: ['rm'],
      }
      service.setConfig(config)

      const newConfig = service.getConfig()
      expect(newConfig.allowedCommands).toContain('git')
      expect(newConfig.allowedCommands).toContain('npm')
      expect(newConfig.blockedCommands).toContain('rm')
      expect(newConfig.aclRules).toHaveLength(2)
    })
  })

  describe('命令管理', () => {
    it('allowCommand 添加允许的命令', () => {
      service.allowCommand('git')
      const config = service.getConfig()
      expect(config.allowedCommands).toContain('git')
    })

    it('allowCommand 不重复添加', () => {
      service.allowCommand('git')
      service.allowCommand('git')
      const config = service.getConfig()
      expect(config.allowedCommands.filter(c => c === 'git')).toHaveLength(1)
    })

    it('blockCommand 添加阻止的命令', () => {
      service.blockCommand('rm')
      const config = service.getConfig()
      expect(config.blockedCommands).toContain('rm')
    })

    it('blockCommand 不重复添加', () => {
      service.blockCommand('rm')
      service.blockCommand('rm')
      const config = service.getConfig()
      expect(config.blockedCommands.filter(c => c === 'rm')).toHaveLength(1)
    })

    it('checkCommand 阻止的命令返回 false', () => {
      service.blockCommand('rm')
      const result = service.checkCommand('agent-1', 'rm -rf /')
      expect(result.allowed).toBe(false)
    })

    it('checkCommand 允许的命令返回 true', () => {
      service.allowCommand('git')
      const result = service.checkCommand('agent-1', 'git status')
      expect(result.allowed).toBe(true)
    })
  })

  describe('文件作用域', () => {
    it('setAgentScope / getAgentScope', () => {
      service.setAgentScope('agent-1', ['/project/src', '/project/test'])
      const scope = service.getAgentScope('agent-1')
      expect(scope).toEqual(['/project/src', '/project/test'])
    })

    it('getAgentScope 未设置的 Agent 返回 undefined', () => {
      expect(service.getAgentScope('unknown-agent')).toBeUndefined()
    })

    it('removeAgentScope 移除作用域', () => {
      service.setAgentScope('agent-1', ['/project/src'])
      service.removeAgentScope('agent-1')
      expect(service.getAgentScope('agent-1')).toBeUndefined()
    })

    it('isPathInScope 检查路径是否在作用域内', () => {
      service.setAgentScope('agent-1', ['/project/src'])
      expect(service.isPathInScope('agent-1', '/project/src/index.ts')).toBe(true)
    })

    it('isPathInScope 不在作用域内返回 false', () => {
      service.setAgentScope('agent-1', ['/project/src'])
      expect(service.isPathInScope('agent-1', '/etc/passwd')).toBe(false)
    })

    it('validateScopes 验证无冲突返回 valid', () => {
      const scopes = new Map([
        ['agent-1', ['/project/src']],
        ['agent-2', ['/project/test']],
      ])
      const result = service.validateScopes(scopes)
      expect(result.valid).toBe(true)
    })
  })

  describe('安全策略模板', () => {
    it('listPresets 返回三个模板', () => {
      const presets = service.listPresets()
      expect(presets).toHaveLength(3)
      const levels = presets.map(p => p.level)
      expect(levels).toContain('strict')
      expect(levels).toContain('standard')
      expect(levels).toContain('relaxed')
    })

    it('getPreset 返回指定模板', () => {
      const strict = service.getPreset('strict')
      expect(strict).toBeDefined()
      expect(strict?.level).toBe('strict')
      expect(strict?.name).toBe('严格模式')
    })

    it('getPreset 未知级别返回 undefined', () => {
      expect(service.getPreset('unknown' as never)).toBeUndefined()
    })

    it('applyPreset strict 应用严格配置', () => {
      const result = service.applyPreset('strict')
      expect(result.applied).toBe(true)
      expect(result.preset.level).toBe('strict')
      expect(result.sandboxConfig.blockedCommands).toContain('rm')
      expect(result.guardrailRules.length).toBeGreaterThan(0)
      expect(result.hitlInterruptPoints.length).toBeGreaterThan(0)

      // strict 模式下写入应该被拒绝（配置中 deny write）
      const writeResult = service.checkAccess('agent-1', '/file', 'write')
      expect(writeResult.allowed).toBe(false)
    })

    it('applyPreset standard 应用标准配置', () => {
      const result = service.applyPreset('standard')
      expect(result.applied).toBe(true)
      expect(result.preset.level).toBe('standard')
      expect(result.sandboxConfig.allowedCommands).toContain('git')
      expect(result.sandboxConfig.blockedCommands).toContain('sudo')
    })

    it('applyPreset relaxed 应用宽松配置', () => {
      const result = service.applyPreset('relaxed')
      expect(result.applied).toBe(true)
      expect(result.preset.level).toBe('relaxed')
      expect(result.sandboxConfig.allowedCommands).toContain('*')
      expect(result.guardrailRules).toHaveLength(0)
      expect(result.hitlInterruptPoints).toHaveLength(0)
    })

    it('applyPreset 未知级别抛出异常', () => {
      expect(() => service.applyPreset('unknown' as never)).toThrow()
    })

    it('strict 模板阻止 rm 命令', () => {
      service.applyPreset('strict')
      const result = service.checkCommand('agent-1', 'rm -rf /')
      expect(result.allowed).toBe(false)
    })

    it('standard 模板允许 git 命令', () => {
      service.applyPreset('standard')
      const result = service.checkCommand('agent-1', 'git status')
      expect(result.allowed).toBe(true)
    })

    it('standard 模板阻止 sudo 命令', () => {
      service.applyPreset('standard')
      const result = service.checkCommand('agent-1', 'sudo rm -rf /')
      expect(result.allowed).toBe(false)
    })

    it('relaxed 模板阻止 rm -rf /', () => {
      service.applyPreset('relaxed')
      const result = service.checkCommand('agent-1', 'rm -rf /')
      expect(result.allowed).toBe(false)
    })
  })

  describe('底层对象获取', () => {
    it('getACL 返回 ACL 实例', () => {
      expect(service.getACL()).toBeDefined()
    })

    it('getSandbox 返回 Sandbox 实例', () => {
      expect(service.getSandbox()).toBeDefined()
    })

    it('getScopePolicy 返回 FileScopePolicy 实例', () => {
      expect(service.getScopePolicy()).toBeDefined()
    })
  })

  describe('stop 生命周期', () => {
    it('stop 不抛出异常', () => {
      expect(() => service.stop()).not.toThrow()
    })
  })
})
