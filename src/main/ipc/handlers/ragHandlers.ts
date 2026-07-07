// RAG 管道 IPC handlers
// RAG_INGEST, RAG_SEARCH, RAG_CLEAR, RAG_STATS

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { RAGService } from '../../services/RAGService'
import { wrap } from '../../utils/ipcHelpers'
import { validateInput, ragIngestSchema } from '../schemas'

export function registerRagHandlers(params: {
  ragService: RAGService
}): void {
  const { ragService } = params

  // ===== RAG 管道 =====
  ipcMain.handle(IPC_CHANNELS.RAG_INGEST, async (_, source: string, content: string, metadata?: Record<string, string>) => {
    const validation = validateInput(ragIngestSchema, { source, content, metadata })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => ragService.ingestText(source, content, metadata))
  })

  ipcMain.handle(IPC_CHANNELS.RAG_SEARCH, async (_, query: string, topK?: number) => {
    return wrap(() => ragService.search(query, topK))
  })

  ipcMain.handle(IPC_CHANNELS.RAG_CLEAR, async () => {
    ragService.clear()
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.RAG_STATS, async () => {
    return wrap(() => ragService.stats())
  })
}
