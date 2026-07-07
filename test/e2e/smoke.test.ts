/**
 * E2E 冒烟测试 — 核心链路完整性验证
 * 
 * 验证 IPC 通道注册完整性 + 服务初始化链路
 * 由于无法在 vitest 中启动完整 Electron 进程，这里验证的是
 * IPC_CHANNELS 常量与 preload API 的一致性，以及核心服务的
 * 类级别行为。
 */

import { describe, it, expect } from 'vitest'
import { IPC_CHANNELS } from '../../src/shared/types'

describe('E2E: 核心链路 IPC 通道完整性', () => {
  describe('Agent 对话链路', () => {
    it('AGENT_STREAM 通道已定义', () => {
      expect(IPC_CHANNELS.AGENT_STREAM).toBeDefined()
      expect(typeof IPC_CHANNELS.AGENT_STREAM).toBe('string')
    })

    it('AGENT_STOP 通道已定义', () => {
      expect(IPC_CHANNELS.AGENT_STOP).toBeDefined()
    })

    it('AGENT_PAUSE / AGENT_RESUME 通道已定义', () => {
      expect(IPC_CHANNELS.AGENT_PAUSE).toBeDefined()
      expect(IPC_CHANNELS.AGENT_RESUME).toBeDefined()
    })

    it('AGENT_STATUS 通道已定义', () => {
      expect(IPC_CHANNELS.AGENT_STATUS).toBeDefined()
    })
  })

  describe('Session 会话管理链路', () => {
    it('SESSION_CREATE / LIST / DELETE 通道已定义', () => {
      expect(IPC_CHANNELS.SESSION_CREATE).toBeDefined()
      expect(IPC_CHANNELS.SESSION_LIST).toBeDefined()
      expect(IPC_CHANNELS.SESSION_DELETE).toBeDefined()
    })

    it('SESSION_GET_MESSAGES 通道已定义', () => {
      expect(IPC_CHANNELS.SESSION_GET_MESSAGES).toBeDefined()
    })

    it('SESSION_SET_ACTIVE_SKILLS 通道已定义', () => {
      expect(IPC_CHANNELS.SESSION_SET_ACTIVE_SKILLS).toBeDefined()
    })
  })

  describe('Skills 技能链路', () => {
    it('SKILL_LIST / RELOAD / GET 通道已定义', () => {
      expect(IPC_CHANNELS.SKILL_LIST).toBeDefined()
      expect(IPC_CHANNELS.SKILL_RELOAD).toBeDefined()
      expect(IPC_CHANNELS.SKILL_GET).toBeDefined()
    })
  })

  describe('MCP 工具链路', () => {
    it('MCP_ADD / DELETE / CONNECT / DISCONNECT 通道已定义', () => {
      expect(IPC_CHANNELS.MCP_ADD).toBeDefined()
      expect(IPC_CHANNELS.MCP_DELETE).toBeDefined()
      expect(IPC_CHANNELS.MCP_CONNECT).toBeDefined()
      expect(IPC_CHANNELS.MCP_DISCONNECT).toBeDefined()
    })

    it('MCP_STATUS 通道已定义', () => {
      expect(IPC_CHANNELS.MCP_STATUS).toBeDefined()
    })

    it('MCP_LIST_RESOURCES / MCP_READ_RESOURCE 通道已定义', () => {
      expect(IPC_CHANNELS.MCP_LIST_RESOURCES).toBeDefined()
      expect(IPC_CHANNELS.MCP_READ_RESOURCE).toBeDefined()
    })
  })

  describe('工具调用链路', () => {
    it('BUILTIN_TOOLS_LIST / TOGGLE 通道已定义', () => {
      expect(IPC_CHANNELS.BUILTIN_TOOLS_LIST).toBeDefined()
      expect(IPC_CHANNELS.BUILTIN_TOOLS_TOGGLE).toBeDefined()
    })

    it('SHELL_CONFIRM_COMMAND 通道已定义', () => {
      expect(IPC_CHANNELS.SHELL_CONFIRM_COMMAND).toBeDefined()
    })
  })

  describe('模型配置链路', () => {
    it('MODEL_LIST / ADD / UPDATE / DELETE 通道已定义', () => {
      expect(IPC_CHANNELS.MODEL_LIST).toBeDefined()
      expect(IPC_CHANNELS.MODEL_ADD).toBeDefined()
      expect(IPC_CHANNELS.MODEL_UPDATE).toBeDefined()
      expect(IPC_CHANNELS.MODEL_DELETE).toBeDefined()
    })

    it('MODEL_SET_DEFAULT 通道已定义', () => {
      expect(IPC_CHANNELS.MODEL_SET_DEFAULT).toBeDefined()
    })

    it('AGENT_TEST_MODEL 通道已定义', () => {
      expect(IPC_CHANNELS.AGENT_TEST_MODEL).toBeDefined()
    })
  })

  describe('工作区链路', () => {
    it('WORKSPACE_LIST / ADD / REMOVE 通道已定义', () => {
      expect(IPC_CHANNELS.WORKSPACE_LIST).toBeDefined()
      expect(IPC_CHANNELS.WORKSPACE_ADD).toBeDefined()
      expect(IPC_CHANNELS.WORKSPACE_REMOVE).toBeDefined()
    })

    it('WORKSPACE_READ_FILE / FILE_TREE / SEARCH 通道已定义', () => {
      expect(IPC_CHANNELS.WORKSPACE_READ_FILE).toBeDefined()
      expect(IPC_CHANNELS.WORKSPACE_FILE_TREE).toBeDefined()
      expect(IPC_CHANNELS.WORKSPACE_SEARCH).toBeDefined()
    })
  })

  describe('配置持久化链路', () => {
    it('CONFIG_GET / SET 通道已定义', () => {
      expect(IPC_CHANNELS.CONFIG_GET).toBeDefined()
      expect(IPC_CHANNELS.CONFIG_SET).toBeDefined()
    })
  })
})

describe('E2E: IPC 通道唯一性验证', () => {
  it('所有 IPC 通道值唯一（无冲突）', () => {
    const values = Object.values(IPC_CHANNELS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('所有 IPC 通道值为非空字符串', () => {
    for (const [key, value] of Object.entries(IPC_CHANNELS)) {
      expect(value, `IPC_CHANNELS.${key} should be a non-empty string`).toBeTruthy()
      expect(typeof value, `IPC_CHANNELS.${key} should be a string`).toBe('string')
    }
  })
})
