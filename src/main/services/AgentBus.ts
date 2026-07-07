import type { AgentMessage, AgentMessageType, WorkerRole } from '@shared/types'
import { randomUUID } from 'crypto'

export class AgentBus {
  private messageQueues: Map<string, AgentMessage[]> = new Map()
  private agents: Set<string> = new Set()
  private agentRoles: Map<string, WorkerRole> = new Map()
  private listeners: Map<string, ((message: AgentMessage) => void)[]> = new Map()
  private messageHistory: AgentMessage[] = []
  private maxHistorySize = 1000

  registerAgent(agentId: string, role?: WorkerRole): void {
    this.agents.add(agentId)
    if (role) {
      this.agentRoles.set(agentId, role)
    }
    if (!this.messageQueues.has(agentId)) {
      this.messageQueues.set(agentId, [])
    }
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId)
    this.agentRoles.delete(agentId)
    this.messageQueues.delete(agentId)
    this.listeners.delete(agentId)
  }

  getRegisteredAgents(): string[] {
    return Array.from(this.agents)
  }

  getAgentsByRole(role: WorkerRole): string[] {
    const result: string[] = []
    for (const [agentId, agentRole] of this.agentRoles) {
      if (agentRole === role) {
        result.push(agentId)
      }
    }
    return result
  }

  sendMessage(from: string, to: string, payload: unknown, type: AgentMessageType = 'request'): AgentMessage {
    if (!this.agents.has(from)) {
      throw new Error(`发送方 Agent 未注册: ${from}`)
    }
    if (!this.agents.has(to)) {
      throw new Error(`接收方 Agent 未注册: ${to}`)
    }

    const message: AgentMessage = {
      id: randomUUID(),
      from,
      to,
      type,
      payload,
      timestamp: new Date().toISOString(),
    }

    this.enqueueMessage(to, message)
    this.addToHistory(message)
    this.notifyListeners(to, message)

    return { ...message }
  }

  broadcast(from: string, payload: unknown, role?: WorkerRole, type: AgentMessageType = 'notify'): AgentMessage[] {
    if (!this.agents.has(from)) {
      throw new Error(`发送方 Agent 未注册: ${from}`)
    }

    const targets = role
      ? this.getAgentsByRole(role).filter(id => id !== from)
      : Array.from(this.agents).filter(id => id !== from)

    if (targets.length === 0) {
      return []
    }

    const sentMessages: AgentMessage[] = []
    const messageId = randomUUID()
    const timestamp = new Date().toISOString()

    for (const targetId of targets) {
      const message: AgentMessage = {
        id: `${messageId}-${targetId}`,
        from,
        to: targetId,
        type,
        payload,
        timestamp,
      }

      this.enqueueMessage(targetId, message)
      this.addToHistory(message)
      this.notifyListeners(targetId, message)
      sentMessages.push({ ...message })
    }

    return sentMessages
  }

  getMessages(agentId: string): AgentMessage[] {
    const queue = this.messageQueues.get(agentId)
    return queue ? queue.map(m => ({ ...m })) : []
  }

  receiveMessage(agentId: string): AgentMessage | null {
    const queue = this.messageQueues.get(agentId)
    if (!queue || queue.length === 0) return null

    const message = queue.shift()!
    return { ...message }
  }

  peekMessages(agentId: string, count = 10): AgentMessage[] {
    const queue = this.messageQueues.get(agentId)
    if (!queue) return []
    return queue.slice(0, count).map(m => ({ ...m }))
  }

  getPendingCount(agentId: string): number {
    const queue = this.messageQueues.get(agentId)
    return queue ? queue.length : 0
  }

  getAllPendingCounts(): Record<string, number> {
    const result: Record<string, number> = {}
    for (const [agentId, queue] of this.messageQueues) {
      result[agentId] = queue.length
    }
    return result
  }

  onMessage(agentId: string, callback: (message: AgentMessage) => void): () => void {
    if (!this.listeners.has(agentId)) {
      this.listeners.set(agentId, [])
    }
    this.listeners.get(agentId)!.push(callback)

    return () => {
      const cbs = this.listeners.get(agentId)
      if (cbs) {
        const idx = cbs.indexOf(callback)
        if (idx !== -1) cbs.splice(idx, 1)
      }
    }
  }

  getMessageHistory(filter?: { from?: string; to?: string; type?: AgentMessageType }): AgentMessage[] {
    let result = [...this.messageHistory]

    if (filter?.from) {
      result = result.filter(m => m.from === filter.from)
    }
    if (filter?.to) {
      result = result.filter(m => m.to === filter.to)
    }
    if (filter?.type) {
      result = result.filter(m => m.type === filter.type)
    }

    return result
  }

  clearAgentMessages(agentId: string): number {
    const queue = this.messageQueues.get(agentId)
    if (!queue) return 0
    const count = queue.length
    queue.length = 0
    return count
  }

  clearAll(): void {
    for (const [agentId] of this.messageQueues) {
      this.messageQueues.set(agentId, [])
    }
  }

  clearHistory(): void {
    this.messageHistory.length = 0
  }

  stop(): void {
    this.messageQueues.clear()
    this.agents.clear()
    this.agentRoles.clear()
    this.listeners.clear()
    this.messageHistory.length = 0
  }

  private enqueueMessage(agentId: string, message: AgentMessage): void {
    if (!this.messageQueues.has(agentId)) {
      this.messageQueues.set(agentId, [])
    }
    this.messageQueues.get(agentId)!.push(message)
  }

  private addToHistory(message: AgentMessage): void {
    this.messageHistory.push(message)
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize)
    }
  }

  private notifyListeners(agentId: string, message: AgentMessage): void {
    const cbs = this.listeners.get(agentId)
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(message)
        } catch {
        }
      }
    }
  }
}
