export type AutomationTrigger =
  | { type: 'manual' }
  | { type: 'schedule'; cron: string }
  | { type: 'event'; event: string }

export type AutomationStatus = 'idle' | 'running' | 'success' | 'failed' | 'paused'

export interface AutomationTask {
  id: string
  name: string
  description: string
  prompt: string
  trigger: AutomationTrigger
  status: AutomationStatus
  lastRunAt: string | null
  lastRunDuration: number | null
  lastError: string | null
  runCount: number
  createdAt: string
  updatedAt: string
}

export interface AutomationRunRecord {
  id: string
  taskId: string
  startedAt: string
  finishedAt: string
  duration: number
  success: boolean
  output: string
  error?: string
}
