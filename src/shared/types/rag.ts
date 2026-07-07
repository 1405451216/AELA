export type SplitterStrategy = 'character' | 'recursive' | 'line' | 'sentence' | 'markdown' | 'token' | 'code'

export interface RAGDocument {
  id: string
  source: string
  content: string
  metadata?: Record<string, string>
}

export interface RAGChunk {
  id: string
  documentId: string
  content: string
  index: number
  metadata?: Record<string, string>
}

export interface RAGSearchResult {
  chunkId: string
  documentId: string
  content: string
  score: number
  sources: string[]
  metadata?: Record<string, string>
}

export interface RAGConfig {
  splitterStrategy: SplitterStrategy
  chunkSize: number
  chunkOverlap: number
  topK: number
  enableHybrid: boolean
}

export interface RAGExtendedConfig extends RAGConfig {
  fusionMode?: 'linear' | 'rrf'
  rrfK?: number
  reranker?: 'none' | 'simple' | 'mmr'
  mmrLambda?: number
  deduplicate?: boolean
}
