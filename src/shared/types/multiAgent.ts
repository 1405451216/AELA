export type MultiAgentTaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed'

export interface MultiAgentTask {
  id: string
  description: string
  assignedAgent?: string
  status: MultiAgentTaskStatus
  progress: number
  result?: string
  dependencies: string[]
  createdAt: string
  updatedAt: string
}

export type MultiAgentTaskFilter = {
  agentId?: string
  status?: MultiAgentTaskStatus
}

export type AgentMessageType = 'request' | 'response' | 'notify' | 'escalate'

export interface AgentMessage {
  id: string
  from: string
  to: string
  type: AgentMessageType
  payload: unknown
  timestamp: string
}

export type WorkerRole = 'coder' | 'reviewer' | 'tester' | 'researcher'

export interface WorkerAgent {
  id: string
  name: string
  role: WorkerRole
  skills: string[]
  available: boolean
}

export type SupervisorSessionStatus = 'planning' | 'executing' | 'reviewing' | 'completed'

export interface SupervisorSession {
  id: string
  goal: string
  workers: WorkerAgent[]
  tasks: MultiAgentTask[]
  status: SupervisorSessionStatus
  budget?: {
    maxTokens: number
    usedTokens: number
    maxDurationMs: number
    startedAt: string
  }
}

export interface ConflictResolution {
  taskId: string
  strategy: 'majority' | 'supervisor_pick' | 'merge' | 'retry'
  selectedOption?: number
  reason?: string
}
