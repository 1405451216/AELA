// 会话 API
import { invoke, IPC_CHANNELS } from './_shared'
import type { Session, ChatMessage } from '@shared/types'

export const sessionApi = {
  list: (workspaceId?: string): Promise<Session[]> => invoke(IPC_CHANNELS.SESSION_LIST, workspaceId),
  create: (params: { title?: string; workspaceId?: string; modelConfigId?: string; systemPrompt?: string }): Promise<Session> =>
    invoke(IPC_CHANNELS.SESSION_CREATE, params),
  delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.SESSION_DELETE, id),
  getMessages: (sessionId: string): Promise<ChatMessage[]> => invoke(IPC_CHANNELS.SESSION_GET_MESSAGES, sessionId),
  update: (id: string, partial: Partial<Session>): Promise<Session | null> =>
    invoke(IPC_CHANNELS.SESSION_UPDATE, id, partial),
  setActiveSkills: (sessionId: string, skillIds: string[]): Promise<Session | null> =>
    invoke(IPC_CHANNELS.SESSION_SET_ACTIVE_SKILLS, sessionId, skillIds),
}
