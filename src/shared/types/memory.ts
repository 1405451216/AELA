export interface MemoryEpisode {
  id: string
  sessionId: string
  role: string
  content: string
  summary?: string
  topics?: string
  importance?: number
  metadata?: Record<string, string>
  createdAt: string
}

export interface MemoryStats {
  totalEpisodes: number
  totalSessions: number
  oldestEpisode?: string
  newestEpisode?: string
  avgEpisodesPerSession: number
}

export interface MemoryCompressConfig {
  windowSize: number
  minEpisodes: number
  ttlHours: number
}

export interface MemoryCompressResult {
  compressed: number
  summary: string
  tags: string[]
}

export interface MemoryFTSResult {
  id: string
  score: number
  matchedTokens: string[]
  episode: MemoryEpisode
}

export interface MemoryFTSStats {
  totalDocuments: number
  totalTokens: number
  uniqueTokens: number
  avgDocumentLength: number
  indexSizeKB: number
}
