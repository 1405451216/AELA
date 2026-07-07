// Repo Wiki IPC handlers
// WIKI_GENERATE, WIKI_GET, WIKI_LIST, WIKI_DELETE

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import { RepoWikiService } from '../../services/RepoWikiService'
import type { RepoWikiService as RepoWikiSvc } from '../../services/RepoWikiService'
import type { ConfigStore } from '../../services/ConfigStore'
import type { AgentService } from '../../services/AgentService'
import { wrap } from '../../utils/ipcHelpers'
import { makeLlmCall } from '../../utils/llmCall'
import { validateInput, wikiGenerateSchema } from '../schemas'

export function registerWikiHandlers(params: {
  repoWikiService: RepoWikiSvc
  configStore: ConfigStore
  agentService: AgentService
}): void {
  const { repoWikiService, configStore, agentService } = params

  ipcMain.handle(IPC_CHANNELS.WIKI_GENERATE, async (_, workspaceId: string, modelConfigId: string) => {
    const validation = validateInput(wikiGenerateSchema, { workspaceId, modelConfigId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(async () => {
      const ws = configStore.getWorkspaces().find(w => w.id === workspaceId)
      const rootDir = ws?.path || process.cwd()
      const llmCall = makeLlmCall(configStore, agentService)
      const service = new RepoWikiService(rootDir, llmCall)
      const doc = await service.generate(workspaceId, modelConfigId)
      // 存入主 service
      repoWikiService.importDoc?.(doc)
      return doc
    })
  })

  ipcMain.handle(IPC_CHANNELS.WIKI_GET, async (_, id: string) => {
    return wrap(() => repoWikiService.get(id))
  })

  ipcMain.handle(IPC_CHANNELS.WIKI_LIST, async (_, workspaceId?: string) => {
    return wrap(() => repoWikiService.list(workspaceId))
  })

  ipcMain.handle(IPC_CHANNELS.WIKI_DELETE, async (_, id: string) => {
    return wrap(() => repoWikiService.delete(id))
  })
}
