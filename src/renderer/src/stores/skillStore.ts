// Skills 状态切片
import { create } from 'zustand'
import type { Skill, SkillScanPath, SkillScanLogEntry, SkillDedupConflict } from '@shared/types'

interface SkillState {
  skills: Skill[]
  scanPaths: SkillScanPath[]
  scanLog: SkillScanLogEntry[]
  dedupConflicts: SkillDedupConflict[]

  /**
   * 一次性更新 skills 状态。
   * 优先使用对象参数，避免之前 4 位置参数 + as any 的坏签名。
   */
  setSkills: (data: {
    skills: Skill[]
    scanPaths: SkillScanPath[]
    scanLog?: SkillScanLogEntry[]
    dedupConflicts?: SkillDedupConflict[]
  }) => void
}

export const useSkillStore = create<SkillState>((set) => ({
  skills: [],
  scanPaths: [],
  scanLog: [],
  dedupConflicts: [],

  setSkills: ({ skills, scanPaths, scanLog = [], dedupConflicts = [] }) =>
    set({ skills, scanPaths, scanLog, dedupConflicts }),
}))