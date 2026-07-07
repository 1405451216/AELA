// Shell 命令确认弹窗共享逻辑
// 被 IPC handler 和 AgentService 的 ShellConfirmCallback 复用

import type { BrowserWindow } from 'electron';
import { dialog } from 'electron'
import type { ShellConfirmRequest, ShellConfirmResponse } from '@shared/types'

/**
 * 弹出 Shell 命令确认对话框
 * 根据风险等级显示不同的提示，返回用户的选择
 */
export async function showShellConfirmDialog(
  request: ShellConfirmRequest,
  parentWindow: BrowserWindow | null
): Promise<ShellConfirmResponse> {
  const riskLabels: Record<string, string> = {
    safe: '安全',
    moderate: '需注意',
    dangerous: '危险'
  }
  const riskIcons: Record<string, string> = {
    safe: '✅',
    moderate: '⚠️',
    dangerous: '🔴'
  }

  const detailLines = [
    `命令: ${request.command}`,
    `工作目录: ${request.workingDir}`,
    `风险等级: ${riskIcons[request.risk]} ${riskLabels[request.risk]}`,
    '',
    '风险说明:'
  ]
  for (const reason of request.riskReasons) {
    detailLines.push(`  • ${reason}`)
  }

  if (!parentWindow) {
    return { approved: false }
  }

  const result = await dialog.showMessageBox(parentWindow, {
    type: request.risk === 'dangerous' ? 'warning' : 'question',
    title: '确认执行命令',
    message: `是否允许 AI 执行以下${riskLabels[request.risk]}命令？`,
    detail: detailLines.join('\n'),
    buttons: ['拒绝', '允许本次', '本次会话中允许同类命令'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })

  if (result.response === 0) {
    return { approved: false }
  } else if (result.response === 2) {
    return { approved: true, rememberChoice: 'allow_session' }
  }
  return { approved: true, rememberChoice: 'allow_once' }
}
