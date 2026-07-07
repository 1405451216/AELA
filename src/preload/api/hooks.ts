// Hooks 配置 API
import { invoke, IPC_CHANNELS } from './_shared'
import type { HookRule, HookEventPoint, HookExecutionResult, HookConfigSummary } from '@shared/types'

export const hookConfigApi = {
  list: (): Promise<HookRule[]> => invoke(IPC_CHANNELS.HOOK_CONFIG_LIST),
  add: (rule: Omit<HookRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<HookRule> => invoke(IPC_CHANNELS.HOOK_CONFIG_ADD, rule),
  update: (id: string, partial: Partial<HookRule>): Promise<HookRule | undefined> => invoke(IPC_CHANNELS.HOOK_CONFIG_UPDATE, id, partial),
  delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.HOOK_CONFIG_DELETE, id),
  toggle: (id: string): Promise<HookRule | undefined> => invoke(IPC_CHANNELS.HOOK_CONFIG_TOGGLE, id),
  test: (rule: HookRule, ctx: { eventPoint: HookEventPoint; agentId: string; sessionId: string; turn: number }): Promise<HookExecutionResult> => invoke(IPC_CHANNELS.HOOK_CONFIG_TEST, rule, ctx),
  summary: (): Promise<HookConfigSummary> => invoke(IPC_CHANNELS.HOOK_CONFIG_EXPORT),
}
