// 自我反思与纠错服务
// [重构] 使用 SDK 原生 LLMReflector
// 保持 AELA 公共 API 不变，内部委托给 SDK 实现
// SDK 优势: 标准化 Reflector 接口、temperature=0 确保稳定性

import { LLMReflector, type Reflection as SDKReflection, type Critique as SDKCritique } from '@agentprimordia/sdk'
import type { Provider } from '@agentprimordia/sdk'
import type { ReflectionResult, CritiqueResult, ReflectionIssue, ReflectionCorrection, ReflectionSeverity } from '@shared/types'
import type { ProviderManager } from './ProviderManager'
import type { ConfigStore } from './ConfigStore'

export class ReflectionService {
  private providerManager: ProviderManager
  private configStore: ConfigStore

  constructor(configStore: ConfigStore, providerManager: ProviderManager) {
    this.configStore = configStore
    this.providerManager = providerManager
  }

  /**
   * 获取 Provider
   */
  private getProvider(modelConfigId?: string): Provider {
    const id = modelConfigId || this.configStore.getDefaultModelId() || ''
    if (!id) throw new Error('未配置默认模型')
    const config = this.configStore.getModel(id)
    if (!config) throw new Error(`未找到模型配置: ${id}`)
    return this.providerManager.createProvider(config)
  }

  /**
   * 对输入输出进行反思分析 — 委托给 SDK LLMReflector.reflect
   */
  async reflect(input: string, output: string, modelConfigId?: string): Promise<ReflectionResult> {
    const provider = this.getProvider(modelConfigId)
    const reflector = new LLMReflector(provider)

    const reflection: SDKReflection = await reflector.reflect(input, output)

    return {
      strengths: reflection.strengths,
      weaknesses: reflection.weaknesses,
      suggestions: reflection.suggestions,
      confidence: reflection.confidence,
    }
  }

  /**
   * 对输出进行严格批评和纠错 — 委托给 SDK LLMReflector.critique
   */
  async critique(output: string, modelConfigId?: string): Promise<CritiqueResult> {
    const provider = this.getProvider(modelConfigId)
    const reflector = new LLMReflector(provider)

    const critique: SDKCritique = await reflector.critique(output)

    return {
      issues: critique.issues.map(i => ({
        description: i.description,
        location: i.location,
        severity: i.severity as ReflectionSeverity,
      })) as ReflectionIssue[],
      severity: critique.severity as ReflectionSeverity,
      corrections: critique.corrections.map(c => ({
        original: c.original,
        corrected: c.corrected,
        reason: c.reason,
      })) as ReflectionCorrection[],
    }
  }

  /**
   * 基于批评改进输出 — 委托给 SDK LLMReflector.improve
   */
  async improve(output: string, feedback: CritiqueResult, modelConfigId?: string): Promise<string> {
    if (!feedback.corrections || feedback.corrections.length === 0) {
      return output
    }

    const provider = this.getProvider(modelConfigId)
    const reflector = new LLMReflector(provider)

    // 将 AELA CritiqueResult 转为 SDK Critique
    const sdkCritique: SDKCritique = {
      issues: feedback.issues.map(i => ({
        description: i.description,
        location: i.location,
        severity: i.severity,
      })),
      severity: feedback.severity,
      corrections: feedback.corrections.map(c => ({
        original: c.original,
        corrected: c.corrected,
        reason: c.reason,
      })),
    }

    return reflector.improve(output, sdkCritique)
  }

  /**
   * 完整的反思-改进流程：反思 → 批评 → 改进
   */
  async reflectAndImprove(input: string, output: string, modelConfigId?: string): Promise<{
    reflection: ReflectionResult
    critique: CritiqueResult
    improvedOutput: string
  }> {
    const [reflection, critique] = await Promise.all([
      this.reflect(input, output, modelConfigId),
      this.critique(output, modelConfigId),
    ])
    const improvedOutput = await this.improve(output, critique, modelConfigId)
    return { reflection, critique, improvedOutput }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
