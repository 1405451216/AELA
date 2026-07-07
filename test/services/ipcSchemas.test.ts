/**
 * IPC Schema 单元测试
 *
 * 覆盖: agentRunStreamSchema / workspaceReadFileSchema / modelConfigSchema / hitlRespondSchema
 *       validateInput 成功/失败
 */

import { describe, it, expect } from 'vitest'
import {
  agentRunStreamSchema,
  workspaceReadFileSchema,
  modelConfigSchema,
  hitlRespondSchema,
  validateInput,
} from '../../src/main/ipc/schemas'

// ===== agentRunStreamSchema =====

describe('agentRunStreamSchema', () => {
  it('合法输入通过', () => {
    const data = {
      sessionId: 'session-123',
      input: 'hello world',
      modelConfigId: 'model-1',
      systemPrompt: 'You are helpful',
      mode: 'code' as const,
    }
    const result = agentRunStreamSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('缺少 sessionId 失败', () => {
    const data = {
      input: 'hello',
      modelConfigId: 'model-1',
    }
    const result = agentRunStreamSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('input 过长失败', () => {
    const data = {
      sessionId: 'session-123',
      input: 'x'.repeat(100001),
      modelConfigId: 'model-1',
    }
    const result = agentRunStreamSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('mode 不在枚举中失败', () => {
    const data = {
      sessionId: 'session-123',
      input: 'hello',
      modelConfigId: 'model-1',
      mode: 'invalid-mode',
    }
    const result = agentRunStreamSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('systemPrompt 过长失败', () => {
    const data = {
      sessionId: 'session-123',
      input: 'hello',
      modelConfigId: 'model-1',
      systemPrompt: 'x'.repeat(50001),
    }
    const result = agentRunStreamSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('可选字段可省略', () => {
    const data = {
      sessionId: 'session-123',
      input: 'hello',
      modelConfigId: 'model-1',
    }
    const result = agentRunStreamSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

// ===== workspaceReadFileSchema =====

describe('workspaceReadFileSchema', () => {
  it('合法路径通过', () => {
    const result = workspaceReadFileSchema.safeParse({ filePath: '/home/user/project/src/index.ts' })
    expect(result.success).toBe(true)
  })

  it('空路径失败', () => {
    const result = workspaceReadFileSchema.safeParse({ filePath: '' })
    expect(result.success).toBe(false)
  })

  it('路径过长失败', () => {
    const result = workspaceReadFileSchema.safeParse({ filePath: 'x'.repeat(1025) })
    expect(result.success).toBe(false)
  })
})

// ===== modelConfigSchema =====

describe('modelConfigSchema', () => {
  it('合法配置通过', () => {
    const data = {
      id: 'model-1',
      name: 'GPT-4o',
      provider: 'openai',
      model: 'gpt-4o',
    }
    const result = modelConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('temperature 超出范围失败', () => {
    const data = {
      id: 'model-1',
      name: 'GPT-4o',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 3.0,
    }
    const result = modelConfigSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('temperature 为负数失败', () => {
    const data = {
      id: 'model-1',
      name: 'GPT-4o',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: -0.5,
    }
    const result = modelConfigSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('temperature 边界值 0 和 2 通过', () => {
    const data0 = {
      id: 'model-1',
      name: 'GPT-4o',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0,
    }
    expect(modelConfigSchema.safeParse(data0).success).toBe(true)

    const data2 = {
      id: 'model-1',
      name: 'GPT-4o',
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 2,
    }
    expect(modelConfigSchema.safeParse(data2).success).toBe(true)
  })

  it('缺少必填字段失败', () => {
    const data = {
      id: 'model-1',
      name: 'GPT-4o',
      // 缺少 provider 和 model
    }
    const result = modelConfigSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ===== hitlRespondSchema =====

describe('hitlRespondSchema', () => {
  it('合法输入通过', () => {
    const data = {
      requestId: 'req-123',
      approved: true,
      reason: 'Looks good',
    }
    const result = hitlRespondSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('approved 为 false 也通过', () => {
    const data = {
      requestId: 'req-123',
      approved: false,
      reason: 'Dangerous operation',
    }
    const result = hitlRespondSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('reason 可省略', () => {
    const data = {
      requestId: 'req-123',
      approved: true,
    }
    const result = hitlRespondSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('requestId 为空失败', () => {
    const data = {
      requestId: '',
      approved: true,
    }
    const result = hitlRespondSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('reason 过长失败', () => {
    const data = {
      requestId: 'req-123',
      approved: true,
      reason: 'x'.repeat(1001),
    }
    const result = hitlRespondSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

// ===== validateInput 辅助函数 =====

describe('validateInput', () => {
  it('成功时返回 data', () => {
    const result = validateInput(agentRunStreamSchema, {
      sessionId: 'session-1',
      input: 'hello',
      modelConfigId: 'model-1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sessionId).toBe('session-1')
      expect(result.data.input).toBe('hello')
    }
  })

  it('失败时返回错误消息', () => {
    const result = validateInput(agentRunStreamSchema, {
      input: 'hello',
      // 缺少 sessionId 和 modelConfigId
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('输入验证失败')
    }
  })

  it('错误消息包含字段路径', () => {
    const result = validateInput(workspaceReadFileSchema, { filePath: '' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('filePath')
    }
  })
})
