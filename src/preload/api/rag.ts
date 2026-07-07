// RAG 管道 API（rag, ragExt）
import { invoke, IPC_CHANNELS } from './_shared'
import type { RAGSearchResult, RAGExtendedConfig } from '@shared/types'

export const ragApi = {
  ingest: (source: string, content: string, metadata?: Record<string, string>): Promise<{ documentId: string; chunkCount: number }> =>
    invoke(IPC_CHANNELS.RAG_INGEST, source, content, metadata),
  search: (query: string, topK?: number): Promise<RAGSearchResult[]> => invoke(IPC_CHANNELS.RAG_SEARCH, query, topK),
  clear: (): Promise<boolean> => invoke(IPC_CHANNELS.RAG_CLEAR),
  stats: (): Promise<{ documents: number; chunks: number; vectorDim: number }> => invoke(IPC_CHANNELS.RAG_STATS),
}

export const ragExtApi = {
  setConfig: (config: Partial<RAGExtendedConfig>): Promise<RAGExtendedConfig> =>
    invoke(IPC_CHANNELS.RAG_SET_CONFIG_EX, config),
  getConfig: (): Promise<RAGExtendedConfig> => invoke(IPC_CHANNELS.RAG_GET_CONFIG_EX),
  storeStats: (): Promise<{ totalDocuments: number; totalChunks: number; vectorCount: number; vocabularySize: number }> =>
    invoke(IPC_CHANNELS.RAG_STORE_STATS),
  fusionConfig: (): Promise<{ fusionMode: string; ftsWeight: number; vectorWeight: number; rrfK: number; overFetchSize: number }> =>
    invoke(IPC_CHANNELS.RAG_FUSION_CONFIG),
}
