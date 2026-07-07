// 安全相关 API（security, guardrail, securityPreset）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  SandboxConfig,
  AccessLevel,
  GuardrailReport,
  GuardrailRuleConfig,
  GuardrailCheckPoint,
  SecurityPreset,
  SecurityPresetLevel,
} from '@shared/types'

export const securityApi = {
  getConfig: (): Promise<SandboxConfig> => invoke(IPC_CHANNELS.SECURITY_GET_CONFIG),
  setConfig: (config: SandboxConfig): Promise<boolean> => invoke(IPC_CHANNELS.SECURITY_SET_CONFIG, config),
  checkAccess: (agentId: string, resource: string, level: AccessLevel): Promise<{ allowed: boolean; error?: string }> =>
    invoke(IPC_CHANNELS.SECURITY_CHECK_ACCESS, agentId, resource, level),
}

export const guardrailApi = {
  check: (input: string, point: GuardrailCheckPoint): Promise<GuardrailReport> =>
    invoke(IPC_CHANNELS.GUARDRAIL_CHECK, input, point),
  getRules: (): Promise<GuardrailRuleConfig[]> => invoke(IPC_CHANNELS.GUARDRAIL_GET_RULES),
  setRules: (rules: GuardrailRuleConfig[]): Promise<boolean> => invoke(IPC_CHANNELS.GUARDRAIL_SET_RULES, rules),
}

export const securityPresetApi = {
  list: (): Promise<SecurityPreset[]> => invoke(IPC_CHANNELS.SECURITY_PRESETS_LIST),
  apply: (level: SecurityPresetLevel): Promise<SecurityPreset> => invoke(IPC_CHANNELS.SECURITY_PRESET_APPLY, level),
}
