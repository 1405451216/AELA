import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

const mockMainWindow = {
  isDestroyed: vi.fn(() => false),
  webContents: { send: vi.fn() },
}

const mockGetMainWindow = vi.fn(() => mockMainWindow)

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
}))

import { SyncService } from '../../src/main/services/SyncService'

describe('SyncService', () => {
  let service: SyncService

  beforeEach(() => {
    service = new SyncService(mockGetMainWindow as unknown as () => any)
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.stop()
  })

  it('should start in disconnected state', () => {
    const state = service.getState()
    expect(state.status).toBe('disconnected')
    expect(state.pendingChanges).toBe(0)
    expect(state.peers).toEqual([])
    expect(state.lastSyncAt).toBeNull()
  })

  it('should report correct state after construction', () => {
    const state = service.getState()
    expect(state).toHaveProperty('status')
    expect(state).toHaveProperty('lastSyncAt')
    expect(state).toHaveProperty('pendingChanges')
    expect(state).toHaveProperty('peers')
  })

  it('should return empty conflicts when none exist', () => {
    expect(service.getConflicts()).toEqual([])
  })

  it('should have stop method that sets status to disconnected', () => {
    service.stop()
    expect(service.getState().status).toBe('disconnected')
  })

  it('should scan workspace for syncable files', () => {
    const os = require('node:os')
    const fs = require('node:fs')
    const path = require('node:path')

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'))
    fs.writeFileSync(path.join(tmpDir, 'test.ts'), 'export const x = 1')
    fs.writeFileSync(path.join(tmpDir, 'readme.md'), '# Test')
    fs.writeFileSync(path.join(tmpDir, 'image.png'), 'fake')
    fs.mkdirSync(path.join(tmpDir, 'node_modules'))
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'dep.js'), 'module.exports = {}')

    const entries = service.scanWorkspace(tmpDir)

    expect(entries.length).toBe(2)
    const paths = entries.map(e => e.path)
    expect(paths.some(p => p.endsWith('test.ts'))).toBe(true)
    expect(paths.some(p => p.endsWith('readme.md'))).toBe(true)
    expect(paths.some(p => p.endsWith('image.png'))).toBe(false)
    expect(paths.some(p => p.includes('node_modules'))).toBe(false)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should reject invalid config gracefully', async () => {
    const invalidWsUrl = 'not-a-valid-server'
    await expect(service.connect({
      serverUrl: invalidWsUrl,
      roomId: 'test',
      apiKey: 'key',
      autoSync: false,
      syncIntervalMs: 5000,
    })).rejects.toThrow()

    expect(service.getState().status).toBe('error')
  })
})
