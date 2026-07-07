// Prompt Management + Few-Shot IPC handlers
// PROMPT_RENDER, PROMPT_LIST, PROMPT_REGISTER, PROMPT_DELETE,
// PROMPT_RENDER_MESSAGE, PROMPT_SET_MESSAGE_TEMPLATE,
// PROMPT_FEWSHOT_RENDER, PROMPT_FEWSHOT_ADD_EXAMPLE, PROMPT_FEWSHOT_GET_EXAMPLES,
// PROMPT_VARIANTS_LIST,
// PROMPT_FEWSHOT_ADD_WEIGHTED, PROMPT_FEWSHOT_FEEDBACK,
// PROMPT_FEWSHOT_LIST_WEIGHTED, PROMPT_FEWSHOT_SET_WEIGHT_CONFIG

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { PromptService } from '../../services/PromptService'
import { PromptBuilder } from '../../services/PromptBuilder'
import { wrap } from '../../utils/ipcHelpers'
import {
  validateInput,
  promptNameSchema, promptRegisterSchema, promptRenderSchema, promptFewShotAddSchema,
} from '../schemas'

export function registerPromptHandlers(params: {
  promptService: PromptService
}): void {
  const { promptService } = params

  // ===== Prompt Management 提示词管理 =====
  ipcMain.handle(IPC_CHANNELS.PROMPT_RENDER, async (_, name: string, vars: Record<string, unknown>) => {
    const validation = validateInput(promptRenderSchema, { name, vars })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => promptService.render(name, vars))
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_LIST, async () => {
    return wrap(() => promptService.listDetailed())
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_REGISTER, async (_, name: string, template: string) => {
    const validation = validateInput(promptRegisterSchema, { name, template })
    if (!validation.success) return { success: false, error: validation.error }
    promptService.register(name, template)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_DELETE, async (_, name: string) => {
    const validation = validateInput(promptNameSchema, { name })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => promptService.delete(name))
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_RENDER_MESSAGE, async (_, role: 'system' | 'user' | 'assistant', vars: Record<string, unknown>) => {
    return wrap(() => promptService.renderMessage(role, vars))
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_SET_MESSAGE_TEMPLATE, async (_, role: 'system' | 'user' | 'assistant', template: string) => {
    promptService.setMessageTemplate(role, template)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_FEWSHOT_RENDER, async (_, name: string, input: string, vars?: Record<string, unknown>) => {
    return wrap(() => promptService.renderFewShot(name, input, vars))
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_FEWSHOT_ADD_EXAMPLE, async (_, name: string, input: string, output: string) => {
    const validation = validateInput(promptFewShotAddSchema, { name, input, output })
    if (!validation.success) return { success: false, error: validation.error }
    promptService.addFewShotExample(name, input, output)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_FEWSHOT_GET_EXAMPLES, async (_, name: string) => {
    return wrap(() => promptService.getFewShotExamples(name))
  })

  // ===== Prompt Variants 提示词变体 =====
  ipcMain.handle(IPC_CHANNELS.PROMPT_VARIANTS_LIST, async () => {
    return wrap(() => PromptBuilder.listVariants())
  })

  // ===== [升级 4] 提示词 Few-Shot 权重 =====
  ipcMain.handle(IPC_CHANNELS.PROMPT_FEWSHOT_ADD_WEIGHTED, async (_, name: string, input: string, output: string, metadata?: Record<string, unknown>) => {
    return wrap(() => {
      promptService.addWeightedFewShotExample(name, input, output, metadata)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_FEWSHOT_FEEDBACK, async (_, name: string, input: string, positive: boolean) => {
    return wrap(() => {
      if (positive) {
        promptService.recordFewShotPositiveFeedback(name, input)
      } else {
        promptService.recordFewShotNegativeFeedback(name, input)
      }
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.PROMPT_FEWSHOT_LIST_WEIGHTED, async (_, name: string) => {
    return wrap(() => promptService.getWeightedFewShotExamples(name))
  })

  // Note: setWeightConfig is an instance method of WeightedFewShotTemplate, not PromptService.
  // This handler is a placeholder for future implementation.
  ipcMain.handle(IPC_CHANNELS.PROMPT_FEWSHOT_SET_WEIGHT_CONFIG, async () => {
    return { success: false, error: 'Not yet implemented: use WeightedFewShotTemplate instance' }
  })
}
