/**
 * 渲染进程统一错误日志
 *
 * 用于替代 fire-and-forget IPC 调用中的 `.catch(() => {})` 静默吞错，
 * 使异常在 DevTools console 可见，避免线上静默失败、难以排障。
 *
 * 设计说明:
 * - console.error 在 .eslintrc.cjs 的 renderer 覆盖下被允许（no-console allow: ['warn','error']），
 *   不会触发 pre-commit 的 `eslint --max-warnings=0` 失败。
 * - 若未来引入 electron-log 主进程日志通道，只需在此处改为转发到 window.aela.log，
 *   所有调用点无需改动。
 */

export function logError(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.stack || err.message : String(err)
  console.error(`[AELA][${context}]`, msg)
}
