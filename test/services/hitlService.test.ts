/**
 * HITLService 单元测试
 *
 * 覆盖: 配置管理 / 中断点 / 自动批准 / shouldInterrupt / requestInterrupt / resume / 超时
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HITLService } from '../../src/main/services/HITLService'
import type { HITLConfig, HITLResponse } from '@shared/types'

describe('HITLService', () => {
  let service: HITLService

  beforeEach(() => {
    service = new HITLService({ timeoutMs: 5000 })
  })

  describe('配置管理', () => {
    it('默认配置启用 HITL', () => {
      const config = service.getConfig()
      expect(config.enabled).toBe(true)
    })

    it('默认配置包含 tool_confirm 中断点', () => {
      const config = service.getConfig()
      expect(config.interruptPoints).toContainEqual(
        expect.objectContaining({ type: 'tool_confirm' })
      )
    })

    it('默认自动批准列表包含 read_file', () => {
      const config = service.getConfig()
      expect(config.autoApproveTools).toContain('read_file')
    })

    it('setConfig 更新配置', () => {
      service.setConfig({ enabled: false })
      expect(service.getConfig().enabled).toBe(false)
    })

    it('setEnabled 切换启用状态', () => {
      service.setEnabled(false)
      expect(service.getConfig().enabled).toBe(false)
      service.setEnabled(true)
      expect(service.getConfig().enabled).toBe(true)
    })

    it('自定义构造参数生效', () => {
      const custom = new HITLService({
        enabled: false,
        timeoutMs: 10000,
        autoApproveTools: ['custom_tool'],
      })
      const config = custom.getConfig()
      expect(config.enabled).toBe(false)
      expect(config.autoApproveTools).toContain('custom_tool')
    })
  })

  describe('中断点管理', () => {
    it('addInterruptPoint 添加中断点', () => {
      service.addInterruptPoint({ type: 'decision_point', toolName: 'execute_command', message: '确认执行' })
      const config = service.getConfig()
      expect(config.interruptPoints).toContainEqual(
        expect.objectContaining({ type: 'decision_point', toolName: 'execute_command' })
      )
    })

    it('removeInterruptPoint 按类型移除中断点', () => {
      service.addInterruptPoint({ type: 'decision_point', toolName: '', message: '决策点' })
      service.removeInterruptPoint('decision_point')
      const config = service.getConfig()
      expect(config.interruptPoints.find(ip => ip.type === 'decision_point')).toBeUndefined()
    })

    it('removeInterruptPoint 按类型和工具名移除', () => {
      service.addInterruptPoint({ type: 'tool_confirm', toolName: 'shell', message: '确认' })
      service.addInterruptPoint({ type: 'tool_confirm', toolName: 'write_file', message: '确认' })
      service.removeInterruptPoint('tool_confirm', 'shell')
      const config = service.getConfig()
      const remaining = config.interruptPoints.filter(ip => ip.type === 'tool_confirm')
      expect(remaining.find(ip => ip.toolName === 'shell')).toBeUndefined()
      expect(remaining.find(ip => ip.toolName === 'write_file')).toBeDefined()
    })
  })

  describe('自动批准列表', () => {
    it('addAutoApproveTool 添加工具', () => {
      service.addAutoApproveTool('new_tool')
      expect(service.getConfig().autoApproveTools).toContain('new_tool')
    })

    it('addAutoApproveTool 不重复添加', () => {
      service.addAutoApproveTool('read_file')
      const count = service.getConfig().autoApproveTools.filter(t => t === 'read_file').length
      expect(count).toBe(1)
    })

    it('removeAutoApproveTool 移除工具', () => {
      service.addAutoApproveTool('temp_tool')
      service.removeAutoApproveTool('temp_tool')
      expect(service.getConfig().autoApproveTools).not.toContain('temp_tool')
    })
  })

  describe('shouldInterrupt', () => {
    it('HITL 禁用时返回 false', () => {
      service.setEnabled(false)
      expect(service.shouldInterrupt('execute_command', 'tool_confirm')).toBe(false)
    })

    it('自动批准的工具返回 false', () => {
      expect(service.shouldInterrupt('read_file', 'tool_confirm')).toBe(false)
    })

    it('非自动批准的工具且匹配中断点返回 true', () => {
      // 默认配置有 tool_confirm 中断点，toolName 为空匹配所有
      expect(service.shouldInterrupt('write_file', 'tool_confirm')).toBe(true)
    })

    it('中断点指定特定工具名时只匹配该工具', () => {
      const customService = new HITLService({
        interruptPoints: [
          { type: 'tool_confirm', toolName: 'execute_command', message: '确认' },
        ],
      })
      expect(customService.shouldInterrupt('execute_command', 'tool_confirm')).toBe(true)
      expect(customService.shouldInterrupt('write_file', 'tool_confirm')).toBe(false)
    })

    it('reason 不匹配任何中断点时返回 false', () => {
      expect(service.shouldInterrupt('write_file', 'decision_point')).toBe(false)
    })
  })

  describe('requestInterrupt / resume', () => {
    it('requestInterrupt 设置 pending 请求', async () => {
      const promise = service.requestInterrupt({
        id: 'req-1',
        agentId: 'agent-1',
        reason: 'tool_confirm',
        toolName: 'execute_command',
        message: '确认执行命令',
      })

      expect(service.hasPending()).toBe(true)
      expect(service.getPending()?.id).toBe('req-1')

      // 恢复以避免悬挂 promise
      service.resume({ requestId: 'req-1', approved: true })
      const response = await promise
      expect(response.approved).toBe(true)
    })

    it('resume 传递拒绝响应', async () => {
      const promise = service.requestInterrupt({
        id: 'req-2',
        agentId: 'agent-1',
        reason: 'tool_confirm',
        toolName: 'write_file',
        message: '确认写入',
      })

      service.resume({ requestId: 'req-2', approved: false, feedback: '拒绝操作' })
      const response = await promise
      expect(response.approved).toBe(false)
      expect(response.feedback).toBe('拒绝操作')
    })

    it('resume 后 pending 清空', async () => {
      const promise = service.requestInterrupt({
        id: 'req-3',
        agentId: 'agent-1',
        reason: 'tool_confirm',
        toolName: 'shell',
        message: '确认',
      })

      service.resume({ requestId: 'req-3', approved: true })
      await promise
      expect(service.hasPending()).toBe(false)
      expect(service.getPending()).toBeNull()
    })

    it('onInterrupt 回调被调用', async () => {
      const callback = vi.fn()
      service.onInterrupt(callback)

      const promise = service.requestInterrupt({
        id: 'req-4',
        agentId: 'agent-1',
        reason: 'tool_confirm',
        toolName: 'shell',
        message: '确认',
      })

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ id: 'req-4' }))

      service.resume({ requestId: 'req-4', approved: true })
      await promise
    })

    it('setSendEventCallback 推送事件', async () => {
      const sendEvent = vi.fn()
      service.setSendEventCallback(sendEvent)

      const promise = service.requestInterrupt({
        id: 'req-5',
        agentId: 'agent-1',
        reason: 'tool_confirm',
        toolName: 'shell',
        message: '确认',
      })

      expect(sendEvent).toHaveBeenCalledWith('hitl:pending-added', expect.objectContaining({ id: 'req-5' }))

      service.resume({ requestId: 'req-5', approved: true })
      await promise
    })
  })

  describe('超时机制', () => {
    it('超时后自动拒绝', async () => {
      const shortTimeoutService = new HITLService({ timeoutMs: 100 })

      const promise = shortTimeoutService.requestInterrupt({
        id: 'req-timeout',
        agentId: 'agent-1',
        reason: 'tool_confirm',
        toolName: 'shell',
        message: '确认',
      })

      const response = await promise
      expect(response.approved).toBe(false)
      expect(response.feedback).toContain('超时')
    })

    it('timeoutMs 为 0 时不超时', async () => {
      const noTimeoutService = new HITLService({ timeoutMs: 0 })

      const promise = noTimeoutService.requestInterrupt({
        id: 'req-no-timeout',
        agentId: 'agent-1',
        reason: 'tool_confirm',
        toolName: 'shell',
        message: '确认',
      })

      // 等待一段时间确认没有自动拒绝
      await new Promise(resolve => setTimeout(resolve, 200))
      expect(noTimeoutService.hasPending()).toBe(true)

      // 手动恢复
      noTimeoutService.resume({ requestId: 'req-no-timeout', approved: true })
      const response = await promise
      expect(response.approved).toBe(true)
    })
  })

  describe('stop 生命周期', () => {
    it('stop 不抛出异常', () => {
      expect(() => service.stop()).not.toThrow()
    })
  })
})
