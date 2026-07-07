// IPC 输入验证 Schema
// 使用 zod 对 IPC handler 的参数进行运行时验证，防止渲染进程发送非法数据

import { z } from 'zod'

// ===== 通用 Schema =====
export const sessionIdSchema = z.string().min(1).max(128)
export const modelConfigIdSchema = z.string().min(1).max(128)
export const filePathSchema = z.string().min(1).max(1024)
export const nonEmptyStringSchema = z.string().min(1)

// ===== Config 相关 =====
export const modelConfigSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().nonnegative().optional(),
  topP: z.number().min(0).max(1).optional(),
  enabled: z.boolean().optional(),
})

export const setConfigSchema = z.object({}).passthrough()

// ===== Session 相关 =====
export const createSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  mode: z.enum(['code', 'office']).optional(),
})

export const addMessageSchema = z.object({
  sessionId: sessionIdSchema,
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(100000),
})

// ===== Agent 相关 =====
export const agentRunStreamSchema = z.object({
sessionId: sessionIdSchema,
input: z.string().min(1).max(100000),
modelConfigId: modelConfigIdSchema,
systemPrompt: z.string().max(50000).optional(),
mode: z.enum(['code', 'office']).optional(),
permissionLevel: z.enum(['ask', 'auto_edit', 'plan', 'skip']).optional(),
})

export const agentControlSchema = z.object({
  sessionId: sessionIdSchema,
})

// ===== Workspace 扩展 =====
export const workspaceIdSchema = z.string().min(1).max(128)
export const workspaceOpenFolderSchema = z.object({
  path: z.string().min(1).max(1024),
})
export const workspaceFileTreeSchema = z.object({
  rootPath: z.string().min(1).max(1024),
})
export const workspaceSearchSchema = z.object({
  rootPath: z.string().min(1).max(1024),
  query: z.string().min(1).max(500),
  options: z.object({
    extension: z.string().max(20).optional(),
  }).optional(),
})

// ===== Session 扩展 =====
export const sessionDeleteSchema = z.object({
  id: sessionIdSchema,
})
export const sessionGetMessagesSchema = z.object({
  sessionId: sessionIdSchema,
})
export const sessionSetActiveSkillsSchema = z.object({
  sessionId: sessionIdSchema,
  skillIds: z.array(z.string().min(1).max(128)).max(100),
})
export const sessionSearchSchema = z.object({
  query: z.string().min(1).max(500),
  opts: z.object({
    workspaceId: z.string().max(128).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  }).optional(),
})

// ===== Agent 扩展 =====
export const fileChangeIdSchema = z.object({
  id: nonEmptyStringSchema,
})
export const multiFileReadSchema = z.object({
  filePath: filePathSchema,
})
export const multiFileWriteBatchSchema = z.object({
  edits: z.array(z.object({
    filePath: filePathSchema,
    content: z.string().max(5000000),
    action: z.enum(['create', 'edit', 'delete']).optional(),
  })).min(1).max(50),
})
export const shellConfirmRequestSchema = z.object({
  command: z.string().min(1).max(10000),
  cwd: z.string().max(1024).optional(),
  riskLevel: z.enum(['safe', 'moderate', 'dangerous']).optional(),
  riskReason: z.string().max(2000).optional(),
})
export const agentStatusSchema = z.object({
  sessionId: sessionIdSchema,
})

// ===== MCP 扩展 =====
export const mcpIdSchema = z.object({
  id: nonEmptyStringSchema,
})
export const mcpAddSchema = z.object({
  name: z.string().min(1).max(128),
  transport: z.enum(['stdio', 'sse', 'http']).optional(),
  command: z.string().max(1024).optional(),
  args: z.array(z.string().max(1024)).max(100).optional(),
  url: z.string().max(2048).optional(),
  enabled: z.boolean().optional(),
})
export const mcpResourceSchema = z.object({
  serverId: nonEmptyStringSchema,
  uri: z.string().min(1).max(2048),
})

// ===== Terminal 扩展 =====
export const terminalRunCommandSchema = z.object({
  command: z.string().min(1).max(10000),
  opts: z.object({
    cwd: z.string().max(1024).optional(),
    timeout: z.number().int().min(1).max(600000).optional(),
  }).optional(),
})
export const terminalIdSchema = z.object({
  id: nonEmptyStringSchema,
})

// ===== Preview 扩展 =====
export const previewOpenSchema = z.object({
  url: z.string().min(1).max(2048),
})

// ===== RAG 扩展 =====
export const ragIngestSchema = z.object({
  source: z.string().min(1).max(1024),
  content: z.string().min(1).max(5000000),
  metadata: z.record(z.string(), z.string()).optional(),
})

// ===== Prompt 扩展 =====
export const promptNameSchema = z.object({
  name: z.string().min(1).max(128),
})
export const promptRegisterSchema = z.object({
  name: z.string().min(1).max(128),
  template: z.string().min(1).max(50000),
})
export const promptRenderSchema = z.object({
  name: z.string().min(1).max(128),
  vars: z.record(z.string(), z.unknown()),
})
export const promptFewShotAddSchema = z.object({
  name: z.string().min(1).max(128),
  input: z.string().min(1).max(50000),
  output: z.string().min(1).max(50000),
})

// ===== Hook Config 扩展 =====
export const hookConfigIdSchema = z.object({
  id: nonEmptyStringSchema,
})
export const hookConfigAddSchema = z.object({
  event: z.string().min(1).max(128),
  pattern: z.string().max(500).optional(),
  action: z.enum(['allow', 'block', 'ask', 'transform']).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
})

// ===== Code Review 扩展 =====
export const codeReviewSchema = z.object({
  files: z.array(z.string().min(1).max(1024)).min(1).max(100),
  modelConfigId: modelConfigIdSchema,
})

// ===== Misc 扩展 =====
export const testgenGenerateSchema = z.object({
  filePath: filePathSchema,
  modelConfigId: modelConfigIdSchema,
})
export const wikiGenerateSchema = z.object({
  workspaceId: nonEmptyStringSchema,
  modelConfigId: modelConfigIdSchema,
})
export const img2CodeAnalyzeSchema = z.object({
  imagePath: filePathSchema,
  modelConfigId: modelConfigIdSchema,
})
export const img2CodeRefineSchema = z.object({
  resultId: nonEmptyStringSchema,
  feedback: z.string().min(1).max(10000),
  modelConfigId: modelConfigIdSchema,
})
export const subagentRunSchema = z.object({
  config: z.object({}).passthrough(),
})

// ===== Workspace 相关 =====
export const workspaceSetRootsSchema = z.object({
  roots: z.array(filePathSchema).min(1).max(100),
})

export const workspaceReadFileSchema = z.object({
  filePath: filePathSchema,
})

export const workspaceWriteFileSchema = z.object({
  filePath: filePathSchema,
  content: z.string().max(5000000),
})

// ===== Tool 相关 =====
export const toolCallSchema = z.object({
  sessionId: sessionIdSchema,
  toolName: nonEmptyStringSchema,
  args: z.record(z.string(), z.unknown()),
})

// ===== HITL 相关 =====
export const hitlRespondSchema = z.object({
  requestId: nonEmptyStringSchema,
  approved: z.boolean(),
  reason: z.string().max(1000).optional(),
})

// ===== Orchestration 相关 =====
export const orchestrationRunSchema = z.object({
  runId: nonEmptyStringSchema.optional(),
  goal: z.string().min(1).max(10000),
  mode: z.enum(['basic', 'dag', 'collaboration', 'dynamic_dag', 'supervisor']).optional(),
  modelConfigId: modelConfigIdSchema.optional(),
})

export const orchestrationControlSchema = z.object({
  runId: nonEmptyStringSchema,
})

// ===== T5：补齐未校验 IPC handler 的通用参数 Schema =====
// 这些 Schema 用于对尚未校验的 IPC handler 做「宽松但非零」的输入校验：
// 校验类型（拒绝明显错误类型，如把对象传给期望字符串的通道），但放行额外字段，避免误伤历史合法调用方。
export const genericIdSchema = z.string().min(1).max(4096)
export const genericIdOptionalSchema = z.string().min(1).max(4096).optional()
export const genericBooleanSchema = z.boolean()
export const genericBooleanOptionalSchema = z.boolean().optional()
export const genericObjectSchema = z.record(z.string(), z.unknown())
export const genericObjectOptionalSchema = z.record(z.string(), z.unknown()).optional()
export const genericNullableObjectSchema = z.union([z.record(z.string(), z.unknown()), z.null()])
export const genericArraySchema = z.array(z.unknown())
export const genericArrayOptionalSchema = z.array(z.unknown()).optional()

// 任意字符串（可为空）：用于自由文本类入参（任务描述、反思内容等），避免 min/max 约束误伤历史合法调用
export const genericStringSchema = z.string()
export const genericStringOptionalSchema = z.string().optional()

// 任意数字（必填）/可选
export const genericNumberSchema = z.number()
export const genericNumberOptionalSchema = z.number().optional()

// ===== 验证辅助函数 =====
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  return { success: false, error: `输入验证失败: ${errors}` }
}
