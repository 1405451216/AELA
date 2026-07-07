// AELA — Agent 会话管理器
// 管理活跃 Agent 实例的生命周期：注册、注销、停止、暂停、恢复、状态查询
//
// 从 AgentService 提取，集中管理 activeAgents Map 的所有操作

import type { ReActAgent, Lifecycle } from '@agentprimordia/sdk'

interface ActiveAgentEntry {
  agent: ReActAgent | null
  lifecycle: Lifecycle | null
}

export class AgentSessionManager {
  private activeAgents = new Map<string, ActiveAgentEntry>()

  /**
   * 注册一个活跃 Agent
   */
  register(sessionId: string, agent: ReActAgent | null = null, lifecycle: Lifecycle | null = null): void {
    this.activeAgents.set(sessionId, { agent, lifecycle })
  }

  /**
   * 注销一个活跃 Agent
   */
  unregister(sessionId: string): void {
    this.activeAgents.delete(sessionId)
  }

  /**
   * 获取指定会话的活跃 Agent 条目
   */
  get(sessionId: string): ActiveAgentEntry | null {
    return this.activeAgents.get(sessionId) || null
  }

  /**
   * 检查指定会话是否有活跃 Agent
   */
  has(sessionId: string): boolean {
    return this.activeAgents.has(sessionId)
  }

  /**
   * 停止指定会话的 Agent
   */
  stop(sessionId: string): boolean {
    const entry = this.activeAgents.get(sessionId)
    if (entry?.lifecycle) {
      entry.lifecycle.stop()
      return true
    }
    return false
  }

  /**
   * 暂停指定会话的 Agent
   */
  pause(sessionId: string): boolean {
    const entry = this.activeAgents.get(sessionId)
    if (entry?.lifecycle) {
      entry.lifecycle.pause()
      return true
    }
    return false
  }

  /**
   * 恢复指定会话的 Agent
   */
  resume(sessionId: string): boolean {
    const entry = this.activeAgents.get(sessionId)
    if (entry?.lifecycle) {
      entry.lifecycle.resume()
      return true
    }
    return false
  }

  /**
   * 获取指定会话的 Agent 运行状态
   */
  getStatus(sessionId: string): string {
    const entry = this.activeAgents.get(sessionId)
    if (entry?.lifecycle) {
      return entry.lifecycle.status
    }
    return 'idle'
  }

  /**
   * 停止所有活跃 Agent
   */
  stopAll(): void {
    for (const [sessionId] of this.activeAgents) {
      this.stop(sessionId)
    }
  }

  /**
   * 获取活跃会话数量
   */
  getActiveCount(): number {
    return this.activeAgents.size
  }

  /**
   * 获取所有活跃会话 ID
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.activeAgents.keys())
  }

  /**
   * 清理所有会话（不停止，仅清空映射）
   */
  clear(): void {
    this.activeAgents.clear()
  }
}
