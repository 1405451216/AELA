// ===== 错误处理工具函数 =====

/**
 * 安全地从未知类型的错误中提取错误消息。
 *
 * 使用方式:
 *   catch (err: unknown) {
 *     const msg = toErrorMessage(err)
 *   }
 */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}
