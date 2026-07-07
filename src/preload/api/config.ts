// 配置、Shell、Skills、自动化 API
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  AppConfig,
  ShellConfirmRequest,
  ShellConfirmResponse,
  Skill,
  SkillScanResult,
  AutomationTask,
  AutomationRunRecord,
} from '@shared/types'

export const configApi = {
  get: (): Promise<AppConfig> => invoke(IPC_CHANNELS.CONFIG_GET),
  set: (partial: Partial<AppConfig>): Promise<AppConfig> => invoke(IPC_CHANNELS.CONFIG_SET, partial),
  isApiKeyStorageSecure: (): Promise<boolean> => invoke(IPC_CHANNELS.CONFIG_IS_API_KEY_SECURE),
}

export const shellApi = {
  confirmCommand: (request: ShellConfirmRequest): Promise<ShellConfirmResponse> =>
    invoke(IPC_CHANNELS.SHELL_CONFIRM_COMMAND, request),
}

export const skillApi = {
  list: (): Promise<SkillScanResult> => invoke(IPC_CHANNELS.SKILL_LIST),
  reload: (): Promise<SkillScanResult> => invoke(IPC_CHANNELS.SKILL_RELOAD),
  get: (id: string): Promise<Skill | undefined> => invoke(IPC_CHANNELS.SKILL_GET, id),
}

export const automationApi = {
  list: (): Promise<AutomationTask[]> => invoke(IPC_CHANNELS.AUTOMATION_LIST),
  get: (id: string): Promise<AutomationTask | undefined> => invoke(IPC_CHANNELS.AUTOMATION_GET, id),
  create: (params: { name: string; description?: string; prompt: string; trigger?: AutomationTask['trigger'] }): Promise<AutomationTask> =>
    invoke(IPC_CHANNELS.AUTOMATION_CREATE, params),
  update: (id: string, partial: Partial<AutomationTask>): Promise<AutomationTask | undefined> =>
    invoke(IPC_CHANNELS.AUTOMATION_UPDATE, id, partial),
  delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.AUTOMATION_DELETE, id),
  run: (id: string): Promise<{ success: boolean; data?: AutomationRunRecord; error?: string }> =>
    invoke(IPC_CHANNELS.AUTOMATION_RUN, id),
  runs: (id: string, limit?: number): Promise<AutomationRunRecord[]> =>
    invoke(IPC_CHANNELS.AUTOMATION_RUNS, id, limit),
  toggle: (id: string): Promise<AutomationTask | undefined> =>
    invoke(IPC_CHANNELS.AUTOMATION_TOGGLE, id),
}
