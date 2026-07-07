// 会话扩展 API（sessionExt）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  SessionSearchResult,
  SessionExportOptions,
  SessionExportResult,
  SessionContextInfo,
} from '@shared/types'

export const sessionExtApi = {
  search: (query: string, opts?: { workspaceId?: string; limit?: number }): Promise<SessionSearchResult[]> =>
    invoke(IPC_CHANNELS.SESSION_SEARCH, query, opts),
  export: (sessionId: string, options: SessionExportOptions): Promise<SessionExportResult> =>
    invoke(IPC_CHANNELS.SESSION_EXPORT, sessionId, options),
  contextInfo: (sessionId: string): Promise<SessionContextInfo> =>
    invoke(IPC_CHANNELS.SESSION_CONTEXT_INFO, sessionId),
}
