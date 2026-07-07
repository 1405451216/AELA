export interface Skill {
  id: string
  name: string
  description: string
  content: string
  path: string
  source: 'user' | 'workspace' | 'builtin' | 'thirdparty'
  tags: string[]
  trigger?: string
  asTool?: boolean
  toolName?: string
  toolDescription?: string
  toolParameters?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SkillFrontmatter {
  name?: string
  description?: string
  tags?: string[]
  trigger?: string
  as_tool?: boolean
  tool_name?: string
  tool_description?: string
  tool_parameters?: Record<string, unknown>
}

export interface SkillScanPath {
  path: string
  source: Skill['source']
}

export interface SkillScanLogEntry {
  dir: string
  source: string
  exists: boolean
  isDirectory: boolean
  entryCount: number
  skillsFound: number
  loadErrors: string[]
  error?: string
}

export interface SkillDedupConflict {
  name: string
  keptSource: string
  keptPath: string
  skippedSource: string
  skippedPath: string
  reason: string
}

export interface SkillScanResult {
  skills: Skill[]
  scanPaths: SkillScanPath[]
  scanLog: SkillScanLogEntry[]
  dedupConflicts: SkillDedupConflict[]
  lastScanAt: string
}

/** Skill 市场注册表项 */
export interface SkillRegistryEntry {
  id: string
  name: string
  description: string
  author: string
  version: string
  tarballUrl: string
  permissions: {
    files?: 'read' | 'write' | 'none'
    terminal?: 'exec' | 'none'
    network?: string
  }
  downloads?: number
  rating?: number
}

/** 已安装 skill 的市场信息 */
export interface InstalledSkillInfo {
  id: string
  name: string
  version: string
  path: string
  permissions: SkillRegistryEntry['permissions']
}
