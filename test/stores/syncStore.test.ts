import { describe, it, expect, beforeEach } from 'vitest'
import { useSyncStore } from '../../src/renderer/src/stores/syncStore'
import type { SyncConfig, SyncConflict } from '@shared/types/sync'

describe('syncStore', () => {
  beforeEach(() => {
    useSyncStore.getState().reset()
  })

  it('should start with disconnected status', () => {
    const state = useSyncStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.pendingChanges).toBe(0)
    expect(state.peers).toEqual([])
    expect(state.conflicts).toEqual([])
  })

  it('should set config', () => {
    const config: SyncConfig = {
      serverUrl: 'ws://localhost:1234',
      roomId: 'test-room',
      apiKey: 'test-key',
      autoSync: true,
      syncIntervalMs: 5000,
    }
    useSyncStore.getState().setConfig(config)
    expect(useSyncStore.getState().config).toEqual(config)
  })

  it('should update state partially', () => {
    useSyncStore.getState().setState({ status: 'connected', pendingChanges: 3 })
    const state = useSyncStore.getState()
    expect(state.status).toBe('connected')
    expect(state.pendingChanges).toBe(3)
  })

  it('should set peers', () => {
    const peers = [
      { id: '1', name: 'device-a', lastSeen: new Date().toISOString(), status: 'online' as const },
      { id: '2', name: 'device-b', lastSeen: new Date().toISOString(), status: 'offline' as const },
    ]
    useSyncStore.getState().setPeers(peers)
    expect(useSyncStore.getState().peers).toEqual(peers)
  })

  it('should add conflict', () => {
    const conflict: SyncConflict = {
      filePath: '/test/file.ts',
      localContent: 'local',
      remoteContent: 'remote',
      localModified: new Date().toISOString(),
      remoteModified: new Date().toISOString(),
    }
    useSyncStore.getState().addConflict(conflict)
    expect(useSyncStore.getState().conflicts).toHaveLength(1)
    expect(useSyncStore.getState().conflicts[0]).toEqual(conflict)
  })

  it('should replace existing conflict for same file path', () => {
    const c1: SyncConflict = {
      filePath: '/test/file.ts',
      localContent: 'v1',
      remoteContent: 'v2',
      localModified: new Date().toISOString(),
      remoteModified: new Date().toISOString(),
    }
    const c2: SyncConflict = {
      filePath: '/test/file.ts',
      localContent: 'v3',
      remoteContent: 'v4',
      localModified: new Date().toISOString(),
      remoteModified: new Date().toISOString(),
    }
    useSyncStore.getState().addConflict(c1)
    useSyncStore.getState().addConflict(c2)
    expect(useSyncStore.getState().conflicts).toHaveLength(1)
    expect(useSyncStore.getState().conflicts[0].localContent).toBe('v3')
  })

  it('should remove conflict', () => {
    const conflict: SyncConflict = {
      filePath: '/test/file.ts',
      localContent: 'local',
      remoteContent: 'remote',
      localModified: new Date().toISOString(),
      remoteModified: new Date().toISOString(),
    }
    useSyncStore.getState().addConflict(conflict)
    useSyncStore.getState().removeConflict('/test/file.ts')
    expect(useSyncStore.getState().conflicts).toEqual([])
  })

  it('should reset to initial state', () => {
    useSyncStore.getState().setState({ status: 'connected', pendingChanges: 5 })
    useSyncStore.getState().setConfig({
      serverUrl: 'ws://test',
      roomId: 'r',
      apiKey: 'k',
      autoSync: true,
      syncIntervalMs: 1000,
    })
    useSyncStore.getState().reset()
    const state = useSyncStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.pendingChanges).toBe(0)
    expect(state.config).toBeNull()
    expect(state.conflicts).toEqual([])
  })
})
