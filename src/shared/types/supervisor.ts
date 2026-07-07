import type { OrchestrationMode } from './orchestration'
import type { OrchestrationStepResult } from './orchestration'

export type AssignmentStrategy = 'round_robin' | 'load_balanced' | 'skill_based'

export interface SupervisorWorker {
  id: string
  name: string
  skills: string[]
  maxConcurrency: number
  activeTasks: number
  totalCompleted: number
  totalFailed: number
  available: boolean
}

export interface SupervisorTask {
  id: string
  name: string
  type: string
  payload: Record<string, unknown>
  requiredSkills?: string[]
  priority: number
  timeout?: number
}

export interface SupervisorTaskResult {
  workerId: string
  taskId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  output?: Record<string, unknown>
  error?: string
  duration: number
}

export interface SupervisorStats {
  totalWorkers: number
  availableWorkers: number
  activeTasks: number
  totalCompleted: number
  totalFailed: number
  queueLength: number
}

export interface DynamicDAGNode {
  id: string
  name: string
  handlerType: 'agent' | 'transform' | 'condition'
  config: Record<string, unknown>
}

export interface DynamicDAGEdge {
  from: string
  to: string
}

export interface DynamicDAGConditionalEdge {
  from: string
  routing: Record<string, string>
}

export interface DynamicDAGConfig {
  id: string
  name: string
  nodes: DynamicDAGNode[]
  edges: DynamicDAGEdge[]
  conditionalEdges?: DynamicDAGConditionalEdge[]
  input: string
}

// re-export for backward compatibility
export type { OrchestrationMode, OrchestrationStepResult }
