// HITL 人机协作 IPC handlers
// HITL_GET_CONFIG, HITL_SET_CONFIG, HITL_GET_PENDING, HITL_RESUME,
// HITL_ADD_INTERRUPT_POINT, HITL_REMOVE_INTERRUPT_POINT,
// HITL_ADD_AUTO_APPROVE, HITL_REMOVE_AUTO_APPROVE

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { HITLConfig, HITLResponse, HITLInterruptPoint } from '@shared/types'
import type { HITLService } from '../../services/HITLService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, hitlRespondSchema } from '../schemas'

export function registerHitlHandlers(params: {
  hitlService: HITLService
  getMainWindow: () => any
}): void {
  const { hitlService, getMainWindow } = params

  // 注入事件推送回调：当 HITL 中断发生时主动推送到渲染进程
  hitlService.setSendEventCallback((channel, data) => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  })

  ipcMain.handle(IPC_CHANNELS.HITL_GET_CONFIG, async () => {
    return wrap(() => hitlService.getConfig())
  })

  ipcMain.handle(IPC_CHANNELS.HITL_SET_CONFIG, async (_, config: Partial<HITLConfig>) => {
    hitlService.setConfig(config)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.HITL_GET_PENDING, async () => {
    return wrap(() => hitlService.getPending())
  })

  ipcMain.handle(IPC_CHANNELS.HITL_RESUME, async (_, response: HITLResponse) => {
    const validation = validateInput(hitlRespondSchema, response)
    if (!validation.success) return { success: false, error: validation.error }
    hitlService.resume(response)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.HITL_ADD_INTERRUPT_POINT, async (_, point: HITLInterruptPoint) => {
    hitlService.addInterruptPoint(point)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.HITL_REMOVE_INTERRUPT_POINT, async (_, type: HITLInterruptPoint['type'], toolName?: string) => {
    hitlService.removeInterruptPoint(type, toolName)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.HITL_ADD_AUTO_APPROVE, async (_, toolName: string) => {
    hitlService.addAutoApproveTool(toolName)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.HITL_REMOVE_AUTO_APPROVE, async (_, toolName: string) => {
    hitlService.removeAutoApproveTool(toolName)
    return { success: true }
  })
}
