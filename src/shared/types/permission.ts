export type PermissionLevel = 'ask' | 'auto_edit' | 'plan' | 'skip'

export interface PermissionOption {
  level: PermissionLevel
  label: string
  description: string
  icon: string
}

export const PERMISSION_OPTIONS: PermissionOption[] = [
  { level: 'ask', label: '询问权限', description: 'CLI请求时确认文件编辑和高风险命令', icon: '🔐' },
  { level: 'auto_edit', label: '自动接受编辑', description: 'AELA无需询问即可写入磁盘', icon: '✅' },
  { level: 'plan', label: '计划模式', description: '仅架构和推理，不操作文件', icon: '📋' },
  { level: 'skip', label: '跳过权限', description: '对 Shell和文件系统的完整工具访问', icon: '⚡' },
]
