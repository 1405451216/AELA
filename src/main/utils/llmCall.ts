// LLM 回调工厂
// 多个 IPC 处理器（TestGen / Wiki / CodeReview）需要根据 modelConfigId 动态构造
// 一个 LLM 调用的 closure。这个工厂统一封装模式，避免三处重复。
// [SDK 集成] 使用 SDK toOpenAIMessages 进行消息格式标准化

import type { ConfigStore } from '../services/ConfigStore'
import type { AgentService } from '../services/AgentService'
import type { Message } from '@agentprimordia/sdk'
import { toOpenAIMessages } from '@agentprimordia/sdk'

/**
 * 构造一个 LLM 调用 closure
 * @param configStore 用于根据 modelConfigId 查找 ModelConfig
 * @param agentService 用于获取 ProviderManager 并创建 Provider
 */
export function makeLlmCall(
  configStore: ConfigStore,
  agentService: AgentService
): (prompt: string, modelConfigId: string) => Promise<string> {
  return async (prompt: string, modelConfigId: string): Promise<string> => {
    const modelConfig = configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`Model not found: ${modelConfigId}`)
    }
    const provider = agentService.getProviderManager().createProvider(modelConfig)
    const userMsg: Message = { role: 'user', content: prompt }
    const resp = await provider.complete({ messages: [userMsg] })
    return resp.content
  }
}

/**
 * 构造一个支持多消息对话的 LLM 调用 closure
 * [SDK 集成] 使用 SDK toOpenAIMessages 进行消息格式标准化
 * 支持 system/user/assistant/tool 多角色消息 + 多模态内容
 * @param configStore 用于根据 modelConfigId 查找 ModelConfig
 * @param agentService 用于获取 ProviderManager 并创建 Provider
 */
export function makeLlmCallWithMessages(
  configStore: ConfigStore,
  agentService: AgentService,
): (messages: Message[], modelConfigId: string) => Promise<string> {
  return async (messages: Message[], modelConfigId: string): Promise<string> => {
    const modelConfig = configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`Model not found: ${modelConfigId}`)
    }
    const provider = agentService.getProviderManager().createProvider(modelConfig)
    // 使用 SDK toOpenAIMessages 标准化消息格式
    const _openaiMessages = toOpenAIMessages(messages)
    const resp = await provider.complete({ messages })
    return resp.content
  }
}

/**
 * 构造一个支持流式输出的 LLM 调用 closure
 * [SDK 集成] 使用 SDK extractTextContent 提取纯文本内容
 * @param configStore 用于根据 modelConfigId 查找 ModelConfig
 * @param agentService 用于获取 ProviderManager 并创建 Provider
 */
export function makeLlmCallStream(
  configStore: ConfigStore,
  agentService: AgentService,
): (prompt: string, modelConfigId: string, onToken: (token: string) => void) => Promise<string> {
  return async (prompt: string, modelConfigId: string, onToken: (token: string) => void): Promise<string> => {
    const modelConfig = configStore.getModel(modelConfigId)
    if (!modelConfig) {
      throw new Error(`Model not found: ${modelConfigId}`)
    }
    const provider = agentService.getProviderManager().createProvider(modelConfig)
    const userMsg: Message = { role: 'user', content: prompt }

    let fullContent = ''
    if (provider.stream) {
      for await (const chunk of provider.stream({ messages: [userMsg] })) {
        if (chunk.content) {
          fullContent += chunk.content
          onToken(chunk.content)
        }
        if (chunk.done) break
      }
    } else {
      const resp = await provider.complete({ messages: [userMsg] })
      fullContent = resp.content
      onToken(fullContent)
    }

    return fullContent
  }
}