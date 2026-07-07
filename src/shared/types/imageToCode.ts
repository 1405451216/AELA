export type CodeFramework = 'react' | 'vue' | 'html' | 'tailwind' | 'svelte' | 'angular'

export interface ImageAnalysis {
  description: string
  layout: string
  components: Array<{
    type: string
    description: string
    position: string
    props?: Record<string, string>
  }>
  colors: string[]
  typography: string[]
  responsive: boolean
  frameworkHint: string
}

export interface GeneratedCodeFile {
  fileName: string
  language: string
  content: string
  description: string
}

export interface ImageToCodeResult {
  id: string
  analysis: ImageAnalysis
  files: GeneratedCodeFile[]
  framework: CodeFramework
  generatedAt: string
  modelConfigId: string
  refinementHistory: Array<{
    iteration: number
    feedback: string
    changes: string
  }>
}

export interface ImageToCodeRequest {
  imagePath: string
  framework: CodeFramework
  modelConfigId: string
  customPrompt?: string
  responsive?: boolean
  componentName?: string
}

export type ErrorCategory =
  | 'runtime'
  | 'compile'
  | 'network'
  | 'ui_render'
  | 'permission'
  | 'timeout'
  | 'memory'
  | 'unknown'

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface ScreenshotAnalysis {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  errorTitle: string
  errorText: string
  source: 'browser_console' | 'terminal' | 'ide' | 'mobile' | 'unknown'
  diagnosis: string
  possibleCauses: string[]
  fixSuggestions: Array<{
    title: string
    description: string
    codeSnippet?: string
    confidence: number
  }>
  keywords: string[]
  analyzedAt: string
  modelConfigId: string
}

export interface ScreenshotAnalysisRequest {
  imagePath: string
  modelConfigId: string
  context?: string
}
