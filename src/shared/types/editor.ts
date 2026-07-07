export interface BuiltinToolInfo {
  name: string
  description: string
  category: 'filesystem' | 'shell' | 'web' | 'data' | 'utility' | 'agent'
  enabled: boolean
}

export interface MultiFileEdit {
  filePath: string
  content: string
  label?: string
}

export interface MultiFileEditResult {
  filePath: string
  success: boolean
  error?: string
  bytesWritten: number
}

export interface TestGenAnalysis {
  filePath: string
  language: string
  functions: Array<{ name: string; params: string; returnType: string; lineStart: number; lineEnd: number }>
  classes: Array<{ name: string; methods: string[]; lineStart: number; lineEnd: number }>
  imports: string[]
  frameworkSuggestion: string
}

export interface TestGenResult {
  testFilePath: string
  testContent: string
  framework: string
  coverageTargets: string[]
  analysis: TestGenAnalysis
}

export interface WikiSection {
  title: string
  content: string
  order: number
}

export interface WikiDocument {
  id: string
  workspaceId: string
  title: string
  sections: WikiSection[]
  generatedAt: string
  fileCount: number
  languageStats: Record<string, number>
  markdown: string
}
