// T5 单元测试：通用 IPC 入参校验 Schema 与 validateInput 辅助函数
// 验证「宽松但非零」的校验：能拒绝明显错误类型（如把对象传给期望字符串的通道），
// 但放行额外字段与可选值，避免误伤历史合法调用方。

import { describe, it, expect } from 'vitest'
import {
  validateInput,
  genericIdSchema,
  genericIdOptionalSchema,
  genericBooleanSchema,
  genericBooleanOptionalSchema,
  genericNumberOptionalSchema,
  genericObjectSchema,
  genericObjectOptionalSchema,
  genericNullableObjectSchema,
  genericArraySchema,
  genericArrayOptionalSchema,
  genericStringSchema,
  genericStringOptionalSchema,
  genericNumberSchema,
} from '@main/ipc/schemas'

describe('validateInput + 通用 Schema（T5）', () => {
  it('validateInput 成功返回 { success: true, data }', () => {
    const r = validateInput(genericIdSchema, 'ok')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('ok')
  })

  it('validateInput 失败返回 { success: false, error }', () => {
    const r = validateInput(genericIdSchema, 123)
    expect(r.success).toBe(false)
    if (!r.success) expect(typeof r.error).toBe('string')
  })

  it('失败信息包含可读原因（供 IPC 错误透传）', () => {
    const r = validateInput(genericIdSchema, 123)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('输入验证失败')
  })

  it('genericIdSchema 拒绝非字符串 / 空串，放行非空串', () => {
    expect(validateInput(genericIdSchema, 123).success).toBe(false)
    expect(validateInput(genericIdSchema, '').success).toBe(false)
    expect(validateInput(genericIdSchema, 'abc').success).toBe(true)
  })

  it('genericIdOptionalSchema 放行 undefined', () => {
    expect(validateInput(genericIdOptionalSchema, undefined).success).toBe(true)
    expect(validateInput(genericIdOptionalSchema, 'x').success).toBe(true)
  })

  it('genericBooleanSchema / genericBooleanOptionalSchema', () => {
    expect(validateInput(genericBooleanSchema, true).success).toBe(true)
    expect(validateInput(genericBooleanSchema, 'true' as unknown as boolean).success).toBe(false)
    expect(validateInput(genericBooleanOptionalSchema, undefined).success).toBe(true)
  })

  it('genericNumberOptionalSchema 放行 number / undefined', () => {
    expect(validateInput(genericNumberOptionalSchema, 5).success).toBe(true)
    expect(validateInput(genericNumberOptionalSchema, undefined).success).toBe(true)
    expect(validateInput(genericNumberOptionalSchema, '5' as unknown as number).success).toBe(false)
  })

  it('genericObjectSchema 放行任意 record，拒绝非对象', () => {
    expect(validateInput(genericObjectSchema, { a: 1, b: 'x' }).success).toBe(true)
    expect(validateInput(genericObjectSchema, 'str').success).toBe(false)
  })

  it('genericObjectOptionalSchema 放行 undefined', () => {
    expect(validateInput(genericObjectOptionalSchema, undefined).success).toBe(true)
    expect(validateInput(genericObjectOptionalSchema, {}).success).toBe(true)
  })

  it('genericNullableObjectSchema 放行 null 与对象', () => {
    expect(validateInput(genericNullableObjectSchema, null).success).toBe(true)
    expect(validateInput(genericNullableObjectSchema, { k: 1 }).success).toBe(true)
    expect(validateInput(genericNullableObjectSchema, 42 as unknown as object).success).toBe(false)
  })

  it('genericArraySchema 放行数组，拒绝非数组', () => {
    expect(validateInput(genericArraySchema, [1, 'a', {}]).success).toBe(true)
    expect(validateInput(genericArraySchema, 'x').success).toBe(false)
  })

  it('genericArrayOptionalSchema 放行 undefined', () => {
    expect(validateInput(genericArrayOptionalSchema, undefined).success).toBe(true)
    expect(validateInput(genericArrayOptionalSchema, []).success).toBe(true)
  })

  it('genericStringSchema / genericStringOptionalSchema', () => {
    expect(validateInput(genericStringSchema, 'free text').success).toBe(true)
    expect(validateInput(genericStringSchema, 123 as unknown as string).success).toBe(false)
    expect(validateInput(genericStringOptionalSchema, undefined).success).toBe(true)
    expect(validateInput(genericStringOptionalSchema, 'x').success).toBe(true)
  })

  it('genericNumberSchema 拒绝非数字', () => {
    expect(validateInput(genericNumberSchema, 1).success).toBe(true)
    expect(validateInput(genericNumberSchema, '1' as unknown as number).success).toBe(false)
  })
})
