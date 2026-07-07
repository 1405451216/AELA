// T3 单元测试：SecretStore 失败即关闭（fail-closed）行为
// 验证在 OS Keyring 不可用（safeStorage.isEncryptionAvailable() === false）时，
// encrypt() 拒绝以明文（Base64 等价）落盘，并抛 SecretStoreInsecureError。

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 使用 vi.hoisted 让 vi.mock 工厂闭包中引用的 mock 对象在提升后仍可用
const { mockSafeStorage } = vi.hoisted(() => ({
  mockSafeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}))

// 在导入 secretStore 之前 mock electron 的 safeStorage
vi.mock('electron', () => ({
  safeStorage: mockSafeStorage,
}))

import { createSecretStore, SecretStoreInsecureError } from '@main/secretStore'

describe('SecretStore（T3 失败即关闭）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 mock：OS Keyring 可用 + 简单的可逆「加密」
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(true)
    mockSafeStorage.encryptString.mockImplementation((s: string) => Buffer.from('ENC:' + s, 'utf-8'))
    mockSafeStorage.decryptString.mockImplementation((b: Buffer) => b.toString('utf-8').slice('ENC:'.length))
  })

  it('OS Keyring 可用时：encrypt 产出加密前缀串，decrypt 可还原', () => {
    const store = createSecretStore()
    expect(store.isSecure()).toBe(true)

    const enc = store.encrypt('sk-123456')
    expect(enc.startsWith('enc:v1:')).toBe(true)
    // 失败即关闭的对照：可用时也不应以明文落盘
    expect(enc).not.toContain('sk-123456')

    expect(store.decrypt(enc)).toBe('sk-123456')
  })

  it('OS Keyring 可用时：空串 encrypt/decrypt 直接返回空', () => {
    const store = createSecretStore()
    expect(store.encrypt('')).toBe('')
    expect(store.decrypt('')).toBe('')
  })

  it('OS Keyring 不可用时：encrypt 抛 SecretStoreInsecureError（拒绝明文落盘）', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)

    const store = createSecretStore()
    expect(store.isSecure()).toBe(false)

    // 失败即关闭：不允许把明文以 Base64 形式落盘
    expect(() => store.encrypt('sk-123456')).toThrow(SecretStoreInsecureError)
  })

  it('OS Keyring 不可用时：解密已加密数据也抛 SecretStoreInsecureError', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
    const store = createSecretStore()
    expect(() => store.decrypt('enc:v1:c2VjcmV0')).toThrow(SecretStoreInsecureError)
  })

  it('OS Keyring 不可用时：仍兼容读取遗留 b64:/无前缀数据（向后兼容）', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
    const store = createSecretStore()

    const legacy = 'b64:' + Buffer.from('legacy-plain', 'utf-8').toString('base64')
    expect(store.decrypt(legacy)).toBe('legacy-plain')

    expect(store.decrypt('plain-legacy')).toBe('plain-legacy')
  })

  it('OS Keyring 不可用时：onInsecureFallback 回调被调用（用于告警/审计）', () => {
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false)
    const cb = vi.fn()
    createSecretStore(cb)
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('SecretStoreInsecureError 携带可识别的 name 且为 Error 实例', () => {
    const err = new SecretStoreInsecureError()
    expect(err.name).toBe('SecretStoreInsecureError')
    expect(err).toBeInstanceOf(Error)
  })
})
