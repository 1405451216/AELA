export interface FileChangeRecord {
  id: string
  filePath: string
  absolutePath: string
  originalContent: string
  newContent: string
  changeType: 'created' | 'modified' | 'deleted'
  timestamp: string
  sessionId: string
  agentName: string
  accepted: boolean
  rejected: boolean
}

export interface FileDiffLine {
  type: 'context' | 'added' | 'removed'
  oldLineNumber: number | null
  newLineNumber: number | null
  content: string
}
