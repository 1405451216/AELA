// Skill IPC handlers
// SKILL_LIST, SKILL_RELOAD, SKILL_SCAN, SKILL_GET

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { getSkillScanner } from '../../services/SkillScanner'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, genericIdSchema } from '../schemas'

export function registerSkillHandlers(params: {
  skillScanner: ReturnType<typeof getSkillScanner>
}): void {
  const { skillScanner } = params

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
}
