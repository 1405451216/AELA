// AELA — Inline Completion / LSP / Plugin IPC Handler

import { ipcMain } from 'electron'
import type { ServiceContainer } from '../../services/ServiceContainer'
import { SERVICE_TOKENS } from '../../services/ServiceContainer'
import type { InlineCompletionService } from '../../services/InlineCompletionService'
import type { LSPService } from '../../services/LSPService'
import type { PluginService } from '../../services/PluginService'
import { z } from 'zod'
import { validateInput, genericIdSchema, genericStringSchema } from '../schemas'

export function registerAdvancedHandlers(container: ServiceContainer): void {
  // ===== Inline Completion =====
  const inlineCompletion = container.get<InlineCompletionService>(SERVICE_TOKENS.INLINE_COMPLETION_SERVICE)

  const completeSchema = z.object({
    filePath: z.string(),
    language: z.string(),
    contentBefore: z.string(),
    contentAfter: z.string(),
    cursorLine: z.number(),
    cursorColumn: z.number(),
  })

  ipcMain.handle('inline-completion:complete', async (_event, raw) => {
    const req = completeSchema.parse(raw)
    return inlineCompletion?.complete(req) ?? null
  })

  ipcMain.handle('inline-completion:toggle', (_event, enabled: boolean) => {
    inlineCompletion?.setEnabled(enabled)
    return { success: true, enabled }
  })

  ipcMain.handle('inline-completion:status', () => {
    return { enabled: inlineCompletion?.isEnabled() ?? false }
  })

  ipcMain.handle('inline-completion:clear-cache', () => {
    inlineCompletion?.clearCache()
    return { success: true }
  })

  // ===== LSP / Diagnostics =====
  const lspService = container.get<LSPService>(SERVICE_TOKENS.LSP_SERVICE)

  ipcMain.handle('lsp:diagnostics', (_event, filePath: string) => {
    const v = validateInput(genericStringSchema, filePath)
    if (!v.success) return { success: false, error: v.error }
    return lspService?.getDiagnostics(filePath) ?? []
  })

  ipcMain.handle('lsp:all-diagnostics', () => {
    return Array.from(lspService?.getAllDiagnostics().entries() ?? [])
  })

  ipcMain.handle('lsp:quick-check', async (_event, rootDir: string) => {
    const v = validateInput(genericStringSchema, rootDir)
    if (!v.success) return { success: false, error: v.error }
    return lspService?.runQuickDiagnostics(rootDir) ?? []
  })

  ipcMain.handle('lsp:toggle', (_event, enabled: boolean) => {
    lspService?.setEnabled(enabled)
    return { success: true, enabled }
  })

  ipcMain.handle('lsp:status', () => {
    return { enabled: lspService?.isEnabled() ?? false }
  })

  // ===== Plugin System =====
  const pluginService = container.get<PluginService>(SERVICE_TOKENS.PLUGIN_SERVICE)

  ipcMain.handle('plugin:list', () => {
    return pluginService?.listPlugins() ?? []
  })

  ipcMain.handle('plugin:reload', async () => {
    return pluginService?.loadInstalledPlugins() ?? []
  })

  const pluginToggleSchema = z.object({ id: z.string(), enabled: z.boolean() })
  ipcMain.handle('plugin:toggle', (_event, raw) => {
    const { id, enabled } = pluginToggleSchema.parse(raw)
    return { success: pluginService?.setEnabled(id, enabled) ?? false }
  })

  const pluginConfigSchema = z.object({ id: z.string(), config: z.record(z.string(), z.unknown()) })
  ipcMain.handle('plugin:set-config', (_event, raw) => {
    const { id, config } = pluginConfigSchema.parse(raw)
    return { success: pluginService?.setConfig(id, config) ?? false }
  })

  ipcMain.handle('plugin:get-config', (_event, id: string) => {
    const v = validateInput(genericIdSchema, id)
    if (!v.success) return { success: false, error: v.error }
    return pluginService?.getConfig(id) ?? null
  })

  ipcMain.handle('plugin:stats', () => {
    return pluginService?.getStats() ?? { total: 0, enabled: 0, disabled: 0 }
  })

  // ===== Embedding Service Info =====
  const embeddingService = container.get<{ getInfo: () => unknown; clearCache: () => void }>(SERVICE_TOKENS.EMBEDDING_SERVICE)
  ipcMain.handle('embedding:info', () => {
    return embeddingService?.getInfo() ?? { provider: 'hash', model: 'none', dimensions: 128, cached: 0 }
  })
  ipcMain.handle('embedding:clear-cache', () => {
    embeddingService?.clearCache()
    return { success: true }
  })

}
