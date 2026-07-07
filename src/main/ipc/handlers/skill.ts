// Skill IPC handlers
// SKILL_LIST, SKILL_RELOAD, SKILL_SCAN, SKILL_GET
// SKILL_MARKET_LIST, SKILL_MARKET_INSTALL, SKILL_MARKET_UNINSTALL, SKILL_MARKET_INSTALLED

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { getSkillScanner } from '../../services/SkillScanner'
import type { SkillRegistryEntry } from '@shared/types/skill'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema } from '../schemas'
import { SkillRegistryService } from '../../services/SkillRegistryService'

export function registerSkillHandlers(params: {
  skillScanner: ReturnType<typeof getSkillScanner>
  skillRegistry: SkillRegistryService
}): void {
  const { skillScanner, skillRegistry } = params

  ipcMain.handle(IPC_CHANNELS.SKILL_LIST, async () => {
    return wrap(() => ({
      skills: skillScanner.list(),
      scanPaths: skillScanner.getScanPaths(),
      scanLog: skillScanner.getScanLog(),
      dedupConflicts: skillScanner.getDedupConflicts(),
      lastScanAt: skillScanner.getLastScanAt()
    }))
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_RELOAD, async () => {
    return wrap(async () => {
      const skills = await skillScanner.scanAll()
      return {
        skills,
        scanPaths: skillScanner.getScanPaths(),
        scanLog: skillScanner.getScanLog(),
        dedupConflicts: skillScanner.getDedupConflicts(),
        lastScanAt: skillScanner.getLastScanAt()
      }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_GET, async (_, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return wrap(() => skillScanner.get(id))
  })

  // ===== Skill 市场 =====
  ipcMain.handle(IPC_CHANNELS.SKILL_MARKET_LIST, async () => {
    return wrap(async () => {
      const [registry, installed] = await Promise.all([
        skillRegistry.fetchRegistry(),
        skillRegistry.getInstalledSkills(),
      ])
      return { registry, installed, offline: false }
    })
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_MARKET_INSTALL, async (_, entry: SkillRegistryEntry) => {
    return wrap(async () => {
      const result = await skillRegistry.installSkill(entry)
      if (!result.success) throw new Error(result.error || '安装失败')
      return result
    })
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_MARKET_UNINSTALL, async (_, skillId: string) => {
    const v = validateInput(genericIdSchema, skillId)
    if (!v.success) return { success: false, error: v.error }
    return wrap(async () => {
      const result = await skillRegistry.uninstallSkill(skillId)
      if (!result.success) throw new Error(result.error || '卸载失败')
      return result
    })
  })

  ipcMain.handle(IPC_CHANNELS.SKILL_MARKET_INSTALLED, async () => {
    return wrap(() => skillRegistry.getInstalledSkills())
  })
}
