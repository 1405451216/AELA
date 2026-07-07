// 敏感凭据加密存储（API Key 等）
//
// 使用 Electron safeStorage（OS 级密钥链）：
//   - macOS: Keychain
//   - Windows: DPAPI（用户账户绑定）
//   - Linux: libsecret（GNOME Keyring / KWallet）
//
// 失败即关闭（fail-closed）：
//   - 当 OS Keyring 不可用（safeStorage.isEncryptionAvailable() 返回 false，
//     例如 Linux 无 GUI 会话）时，encrypt() 会抛错，调用方不得将明文落到磁盘。
//   - 这是为了防止以 Base64 等价明文的形式持久化 API Key。
//   - 调用方（ConfigStore）在捕获异常后应改为仅本次会话内存持有。

import { safeStorage } from 'electron'

export interface SecretStore {
  /** 加密一个明文 token，返回可用于持久化的字符串 */
  encrypt(plaintext: string): string
  /** 解密一个由 encrypt() 产生的字符串 */
  decrypt(stored: string): string
  /** 是否使用 OS 级加密（false 表示降级到内存持有，不会落盘） */
  isSecure(): boolean
}

const ENCRYPTED_PREFIX = 'enc:v1:'
const LEGACY_FALLBACK_PREFIX = 'b64:'

/**
 * 当 OS Keyring 不可用且调用方尝试持久化明文凭据时抛出。
 * 表示「失败即关闭」：拒绝以明文（Base64 等价）写入磁盘。
 */
export class SecretStoreInsecureError extends Error {
  constructor(message = 'OS Keyring 不可用，拒绝以明文持久化敏感凭据。') {
    super(message)
    this.name = 'SecretStoreInsecureError'
  }
}

/**
 * 创建主进程 SecretStore
 * @param onInsecureFallback 当 OS Keyring 不可用时调用，用于审计/告警
 */
export function createSecretStore(onInsecureFallback?: () => void): SecretStore {
  const available = safeStorage.isEncryptionAvailable()

  if (!available) {
    // eslint-disable-next-line no-console
    console.warn(
      '[SecretStore] OS Keyring 不可用，将拒绝持久化明文 API Key（失败即关闭）。' +
        '建议用户在 macOS/Windows 上运行，或为 Linux 配置 libsecret（GNOME Keyring / KWallet）。'
    )
    onInsecureFallback?.()
  }

  return {
    encrypt(plaintext: string): string {
      if (!plaintext) return ''
      if (!available) {
        // 失败即关闭：不允许把明文以 Base64 形式落盘。
        // 调用方应改为仅在内存中持有（见 ConfigStore 的内存兜底逻辑）。
        throw new SecretStoreInsecureError()
      }
      const buf = safeStorage.encryptString(plaintext)
      return ENCRYPTED_PREFIX + buf.toString('base64')
    },
    decrypt(stored: string): string {
      if (!stored) return ''
      // 加密格式
      if (stored.startsWith(ENCRYPTED_PREFIX)) {
        if (!available) {
          // 加密数据无法在没有 Keyring 的环境解密 —— 失败即关闭
          throw new SecretStoreInsecureError('OS Keyring 不可用，无法解密已加密的凭据。')
        }
        const b64 = stored.slice(ENCRYPTED_PREFIX.length)
        return safeStorage.decryptString(Buffer.from(b64, 'base64'))
      }
      // 降级格式（旧版本写入）—— 仅读取，不再新写
      if (stored.startsWith(LEGACY_FALLBACK_PREFIX)) {
        return Buffer.from(stored.slice(LEGACY_FALLBACK_PREFIX.length), 'base64').toString('utf-8')
      }
      // 既无前缀 — 视为遗留未加密数据，原样返回（向后兼容旧数据）
      return stored
    },
    isSecure() {
      return available
    },
  }
}
