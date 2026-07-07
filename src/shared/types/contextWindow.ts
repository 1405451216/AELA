export interface ContextWindowConfig {
  strategy: 'default' | 'compress'
  maxMessages: number
  keepLast: number
  compress?: ContextCompressConfig
}

export interface ContextCompressConfig {
  maxTokens: number
  keepSystemMessages: boolean
  keepRecentN: number
  compressRatio: number
}
