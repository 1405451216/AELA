// 人机协作 (HITL) 服务
// [重构] 使用 SDK 原生 HITLManager 的 shouldInterrupt 逻辑
// 保持 AELA 公共 API 不变（UI 回调、超时机制、自动批准列表等）
// SDK 优势: 标准化 InterruptReason / InterruptRequest / InterruptResponse 接口

import type { HITLConfig, HITLInterruptPoint, HITLInterruptRequest, HITLResponse } from '@shared/types'

export class HITLService {
  private config: HITLConfig
  private pending: HITLInterruptRequest | null = null
  private responseResolver: ((response: HITLResponse) => void) | null = null
  private onInterruptCallback: ((req: HITLInterruptRequest) => void) | null = null
  private timeoutTimer: NodeJS.Timeout | null = null
  private defaultTimeoutMs: number
  /** 推送事件到渲染进程的回调（由 IPC 层注入） */
  private sendEventCallback: ((channel: string, data: any) => void) | null = null

  constructor(config?: Partial<HITLConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      interruptPoints: config?.interruptPoints ?? [
        { type: 'tool_confirm', toolName: '', message: '确认工具调用' },
      ],
      autoApproveTools: config?.autoApproveTools ?? [
        'read_file',
        'list_directory',
        'search_code',
        'get_project_structure',
        'load_csv',
        'load_json',
        'load_markdown',
        'calculator',
        'datetime',
      ],
    }
    this.defaultTimeoutMs = config?.timeoutMs ?? 300000 // 默认 5 分钟超时
  }

  /**
   * 设置中断回调（当 Agent 发起中断时调用）
   */
  onInterrupt(callback: (req: HITLInterruptRequest) => void): void {
    this.onInterruptCallback = callback
  }

  /**
   * 设置推送事件到渲染进程的回调（由 IPC 层注入 BrowserWindow.send）
   */
  setSendEventCallback(callback: (channel: string, data: any) => void): void {
    this.sendEventCallback = callback
  }

  /**
   * 判断当前操作是否需要中断
   * 使用 SDK HITLManager.shouldInterrupt 的逻辑：检查 confirmTools 列表
   * AELA 扩展：同时支持 interruptPoints 配置和 autoApproveTools 白名单
   */
  shouldInterrupt(toolName: string, reason: HITLInterruptRequest['reason']): boolean {
    if (!this.config.enabled) return false

    // 检查自动批准列表
    if (this.isAutoApproved(toolName)) return false

    // 检查中断点配置
    for (const ip of this.config.interruptPoints) {
      if (ip.type !== reason) continue
      if (!ip.toolName || ip.toolName === toolName) {
        return true
      }
    }
    return false
  }

  /**
   * 发起中断请求，阻塞等待人类响应
   */
  async requestInterrupt(req: Omit<HITLInterruptRequest, 'timestamp'>): Promise<HITLResponse> {
    const fullReq: HITLInterruptRequest = {
      ...req,
      timestamp: new Date().toISOString(),
    }

    this.pending = fullReq

    // 推送事件到渲染进程
    if (this.sendEventCallback) {
      this.sendEventCallback('hitl:pending-added', fullReq)
    }

    // 调用中断回调
    if (this.onInterruptCallback) {
      this.onInterruptCallback(fullReq)
    }

    // 清理已有的超时计时器
    this.clearTimeout()

    // 等待响应，带超时机制（SDK HITLManager 使用 Promise.race 实现超时，AELA 沿用此模式）
    return new Promise<HITLResponse>((resolve) => {
      if (this.defaultTimeoutMs > 0) {
        this.timeoutTimer = setTimeout(() => {
          if (this.responseResolver) {
            const timeoutResponse: HITLResponse = {
              requestId: fullReq.id || '',
              approved: false,
              feedback: `HITL 超时（${this.defaultTimeoutMs}ms），自动拒绝`,
              timestamp: new Date().toISOString(),
            }
            this.responseResolver(timeoutResponse)
            this.responseResolver = null
          }
          this.pending = null
          this.timeoutTimer = null
        }, this.defaultTimeoutMs)
      }

      this.responseResolver = resolve
    })
  }

  /**
   * 清理超时计时器
   */
  private clearTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
  }

  /**
   * 恢复 Agent 执行（外部调用，传入人类响应）
   */
  resume(response: HITLResponse): void {
    this.clearTimeout()
    if (this.responseResolver) {
      this.responseResolver(response)
      this.responseResolver = null
    }
    this.pending = null
  }

  /**
   * 获取当前挂起的中断请求
   */
  getPending(): HITLInterruptRequest | null {
    return this.pending
  }

  /**
   * 是否有挂起的中断
   */
  hasPending(): boolean {
    return this.pending !== null
  }

  /**
   * 添加中断点
   */
  addInterruptPoint(point: HITLInterruptPoint): void {
    this.config.interruptPoints.push(point)
  }

  /**
   * 移除中断点
   */
  removeInterruptPoint(type: HITLInterruptPoint['type'], toolName?: string): void {
    this.config.interruptPoints = this.config.interruptPoints.filter(
      ip => !(ip.type === type && (!toolName || ip.toolName === toolName))
    )
  }

  /**
   * 添加自动批准工具
   */
  addAutoApproveTool(toolName: string): void {
    if (!this.config.autoApproveTools.includes(toolName)) {
      this.config.autoApproveTools.push(toolName)
    }
  }

  /**
   * 移除自动批准工具
   */
  removeAutoApproveTool(toolName: string): void {
    this.config.autoApproveTools = this.config.autoApproveTools.filter(t => t !== toolName)
  }

  /**
   * 获取配置
   */
  getConfig(): HITLConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  setConfig(config: Partial<HITLConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 启用/禁用 HITL
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  /**
   * 检查工具是否在自动批准列表中
   */
  private isAutoApproved(toolName: string): boolean {
    return this.config.autoApproveTools.includes(toolName)
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
