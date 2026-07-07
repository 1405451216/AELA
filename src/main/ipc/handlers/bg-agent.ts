import { ipcMain } from 'electron'
import type { ServiceContainer } from '../../services/ServiceContainer'
import { SERVICE_TOKENS } from '../../services/ServiceContainer'
import type { BackgroundAgentService } from '../../services/BackgroundAgentService'
import { z } from 'zod'

export function registerBgAgentHandlers(container: ServiceContainer): void {
  const getService = (): BackgroundAgentService => {
    return container.get<BackgroundAgentService>(SERVICE_TOKENS.BG_AGENT_SERVICE)
  }

  const acceptSchema = z.object({
    diffId: z.string().min(1),
  })

  ipcMain.handle('bg-agent:accept', async (_event, raw) => {
    const { diffId } = acceptSchema.parse(raw)
    const service = getService()
    const result = await service.acceptDiff(diffId)
    return { success: result }
  })

  const rejectSchema = z.object({
    diffId: z.string().min(1),
  })

  ipcMain.handle('bg-agent:reject', async (_event, raw) => {
    const { diffId } = rejectSchema.parse(raw)
    const service = getService()
    const result = await service.rejectDiff(diffId)
    return { success: result }
  })

  ipcMain.handle('bg-agent:status', () => {
    const service = getService()
    return service.getStatus()
  })

  ipcMain.handle('bg-agent:get-pending', () => {
    const service = getService()
    return service.getPendingDiff()
  })

  ipcMain.handle('bg-agent:trigger-terminal', async (_event, raw) => {
    const schema = z.object({
      terminalId: z.string().min(1),
      output: z.string(),
    })
    const { terminalId, output } = schema.parse(raw)
    const service = getService()
    await service.triggerFromTerminal(terminalId, output)
    return { success: true }
  })
}
