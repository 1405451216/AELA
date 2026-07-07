// Skill 市场 API
import { invoke, IPC_CHANNELS } from './_shared'
import type { SkillRegistryEntry, InstalledSkillInfo } from '@shared/types/skill'

export const skillMarketApi = {
  list: (): Promise<{ registry: SkillRegistryEntry[]; installed: InstalledSkillInfo[]; offline: boolean }> =>
    invoke(IPC_CHANNELS.SKILL_MARKET_LIST),
  install: (entry: SkillRegistryEntry): Promise<{ success: boolean; skillId: string }> =>
    invoke(IPC_CHANNELS.SKILL_MARKET_INSTALL, entry),
  uninstall: (skillId: string): Promise<{ success: boolean; skillId: string }> =>
    invoke(IPC_CHANNELS.SKILL_MARKET_UNINSTALL, skillId),
  installed: (): Promise<InstalledSkillInfo[]> =>
    invoke(IPC_CHANNELS.SKILL_MARKET_INSTALLED),
}
