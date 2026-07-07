export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SubTask {
  id: string
  description: string
  dependsOn: string[]
  status: TaskStatus
  result: string
}

export interface Plan {
  goal: string
  subtasks: SubTask[]
  createdAt: string
}

export type ReflectionSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ReflectionResult {
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  confidence: number
}

export interface ReflectionIssue {
  description: string
  location?: string
  severity: ReflectionSeverity
}

export interface ReflectionCorrection {
  original: string
  corrected: string
  reason: string
}

export interface CritiqueResult {
  issues: ReflectionIssue[]
  severity: ReflectionSeverity
  corrections: ReflectionCorrection[]
}
