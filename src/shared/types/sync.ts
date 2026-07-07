export type SyncStatus = 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'error'

export interface SyncConfig {
  serverUrl: string
  roomId: string
  apiKey: string
  autoSync: boolean
  syncIntervalMs: number
}

export interface SyncState {
  status: SyncStatus
  lastSyncAt: string | null
  pendingChanges: number
  peers: SyncPeer[]
}

export interface SyncPeer {
  id: string
  name: string
  lastSeen: string
  status: 'online' | 'offline'
}

export interface FileSyncEntry {
  path: string
  hash: string
  lastModified: string
  syncedAt: string | null
}

export interface SyncConflict {
  filePath: string
  localContent: string
  remoteContent: string
  localModified: string
  remoteModified: string
}

export type ConflictResolution = 'local' | 'remote' | 'merge'

export interface SyncFileMessage {
  type: 'file_update' | 'file_request' | 'file_response' | 'awareness' | 'sync_state'
  roomId: string
  payload: unknown
  timestamp: string
  senderId: string
}

export interface FileUpdatePayload {
  filePath: string
  content: string
  hash: string
  lastModified: string
}

export interface AwarenessPayload {
  peerId: string
  peerName: string
  status: 'online' | 'offline'
  lastSeen: string
}
