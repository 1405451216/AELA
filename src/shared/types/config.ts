export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  size?: number
  extension?: string
}

export interface SlashCommand {
  command: string
  description: string
  prompt: string
}

export interface AppConfig {
  theme: 'dark' | 'light'
  language: 'zh' | 'en'
  defaultModelId: string | null
  defaultSystemPrompt: string
  maxTurns: number
  maxMessages: number
  fontSize: number
  sendOnEnter: boolean
  globalMemory: string
  customRules: string
  includeAgentsMd: boolean
  includeClaudeMd: boolean
  promptVariant: string
  slashCommands: SlashCommand[]
}

export interface PromptVariantInfo {
  name: string
  description: string
}

export interface ShellConfirmRequest {
  command: string
  workingDir: string
  risk: 'safe' | 'moderate' | 'dangerous'
  riskReasons: string[]
}

export interface ShellConfirmResponse {
  approved: boolean
  rememberChoice?: 'allow_once' | 'allow_session' | 'deny'
}
