// Session IPC handlers
// SESSION_CREATE, SESSION_LIST, SESSION_GET, SESSION_UPDATE, SESSION_DELETE,
// SESSION_ADD_MESSAGE, SESSION_GET_MESSAGES, SESSION_SEARCH, SESSION_SET_ACTIVE_SKILLS,
// SESSION_EXPORT, SESSION_IMPORT, SESSION_CONTEXT

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { Session, SessionExportOptions } from '@shared/types'
import type { SessionStore } from '../../services/SessionStore'
import type { ContextWindowService } from '../../services/ContextWindowService'
import {
  validateInput,
  createSessionSchema,
  sessionDeleteSchema,
  sessionGetMessagesSchema,
  sessionSetActiveSkillsSchema,
  sessionSearchSchema,
} from '../schemas'
import { wrap } from '../../utils/ipcHelpers'

export function registerSessionHandlers(params: {
  sessionStore: SessionStore
  contextWindowService: ContextWindowService
}): void {
  const { sessionStore, contextWindowService } = params

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async (_, workspaceId?: string) => {
    return wrap(() => sessionStore.listSessions(workspaceId ?? undefined))
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (_, params: { title?: string; workspaceId?: string; modelConfigId?: string; systemPrompt?: string }) => {
    const validation = validateInput(createSessionSchema, params || {})
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => sessionStore.createSession(params))
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_, id: string) => {
    const validation = validateInput(sessionDeleteSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      sessionStore.deleteSession(id)
      return true
    })
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_GET_MESSAGES, async (_, sessionId: string) => {
    const validation = validateInput(sessionGetMessagesSchema, { sessionId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => sessionStore.getMessages(sessionId))
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_UPDATE, async (_, id: string, partial: Partial<Session>) => {
    const validation = validateInput(sessionDeleteSchema, { id })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      sessionStore.updateSession(id, partial)
      return sessionStore.getSession(id)
    })
  })

  // 设置会话激活的 skills
  ipcMain.handle(IPC_CHANNELS.SESSION_SET_ACTIVE_SKILLS, async (_, sessionId: string, skillIds: string[]) => {
    const validation = validateInput(sessionSetActiveSkillsSchema, { sessionId, skillIds })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      sessionStore.updateActiveSkillIds(sessionId, skillIds)
      return sessionStore.getSession(sessionId)
    })
  })

  // ===== [升级 7] 会话管理增强 =====
  ipcMain.handle(IPC_CHANNELS.SESSION_SEARCH, async (_, query: string, opts?: { workspaceId?: string; limit?: number }) => {
    const validation = validateInput(sessionSearchSchema, { query, opts })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => sessionStore.searchSessions(query, opts))
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_EXPORT, async (_, sessionId: string, options: SessionExportOptions) => {
    const validation = validateInput(sessionGetMessagesSchema, { sessionId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => sessionStore.exportSession(sessionId, options))
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_CONTEXT_INFO, async (_, sessionId: string) => {
    const validation = validateInput(sessionGetMessagesSchema, { sessionId })
    if (!validation.success) return { success: false, error: validation.error }
    return wrap(() => {
      const config = contextWindowService.getConfig()
      return sessionStore.getSessionContextInfo(sessionId, config)
    })
  })
}
