// AELA Preload API — Checkpoint / Inline Completion / LSP / Plugin

import { invoke } from './_shared'

// ===== Checkpoint =====
export const checkpointApi = {
  create: (sessionId: string, filePaths: string[], description?: string) =>
    invoke('checkpoint:create', { sessionId, filePaths, description }),
  restore: (checkpointId: string) =>
    invoke('checkpoint:restore', { checkpointId }),
  list: (sessionId: string) =>
    invoke('checkpoint:list', { sessionId }),
  get: (checkpointId: string) =>
    invoke('checkpoint:get', { checkpointId }),
  delete: (checkpointId: string) =>
    invoke('checkpoint:delete', { checkpointId }),
  clear: (sessionId: string) =>
    invoke('checkpoint:clear', { sessionId }),
  stats: () =>
    invoke('checkpoint:stats'),
}

// ===== Inline Completion =====
export const inlineCompletionApi = {
  complete: (req: { filePath: string; language: string; contentBefore: string; contentAfter: string; cursorLine: number; cursorColumn: number }) =>
    invoke('inline-completion:complete', req),
  toggle: (enabled: boolean) =>
    invoke('inline-completion:toggle', enabled),
  status: () =>
    invoke('inline-completion:status'),
  clearCache: () =>
    invoke('inline-completion:clear-cache'),
}

// ===== LSP / Diagnostics =====
export const lspApi = {
  diagnostics: (filePath: string) =>
    invoke('lsp:diagnostics', filePath),
  allDiagnostics: () =>
    invoke('lsp:all-diagnostics'),
  quickCheck: (rootDir: string) =>
    invoke('lsp:quick-check', rootDir),
  toggle: (enabled: boolean) =>
    invoke('lsp:toggle', enabled),
  status: () =>
    invoke('lsp:status'),
}

// ===== Plugin =====
export const pluginApi = {
  list: () =>
    invoke('plugin:list'),
  reload: () =>
    invoke('plugin:reload'),
  toggle: (id: string, enabled: boolean) =>
    invoke('plugin:toggle', { id, enabled }),
  setConfig: (id: string, config: Record<string, unknown>) =>
    invoke('plugin:set-config', { id, config }),
  getConfig: (id: string) =>
    invoke('plugin:get-config', id),
  stats: () =>
    invoke('plugin:stats'),
}

// ===== Embedding =====
export const embeddingApi = {
  info: () =>
    invoke('embedding:info'),
  clearCache: () =>
    invoke('embedding:clear-cache'),
}
