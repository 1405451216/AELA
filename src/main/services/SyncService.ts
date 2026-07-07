import { randomUUID } from 'node:crypto'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BrowserWindow } from 'electron'
import type {
  SyncConfig,
  SyncState,
  SyncPeer,
  SyncStatus,
  FileSyncEntry,
  SyncConflict,
  ConflictResolution,
  FileUpdatePayload,
  AwarenessPayload,
  SyncFileMessage,
} from '@shared/types/sync'
import { WebSocket } from 'ws'

const SYNCABLE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html',
  '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp',
  '.yml', '.yaml', '.toml', '.xml', '.txt', '.sh', '.bat',
])

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'release', '.next',
  '.vite', '.cache', 'coverage', '__pycache__', '.turbo',
])

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

function shouldSyncFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  if (!SYNCABLE_EXTS.has(ext)) return false
  const parts = filePath.split(/[/\\]/)
  for (const part of parts) {
    if (IGNORED_DIRS.has(part)) return false
  }
  return true
}

export class SyncService extends EventEmitter {
  private status: SyncStatus = 'disconnected'
  private config: SyncConfig | null = null
  private peers: Map<string, SyncPeer> = new Map()
  private fileIndex: Map<string, FileSyncEntry> = new Map()
  private pendingChanges: Set<string> = new Set()
  private conflicts: Map<string, SyncConflict> = new Map()
  private lastSyncAt: string | null = null
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private getMainWindow: () => BrowserWindow | null
  private clientId: string = randomUUID()
  private clientName: string = ''
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 10
  private readonly reconnectBaseDelay = 1000

  constructor(getMainWindow: () => BrowserWindow | null) {
    super()
    this.getMainWindow = getMainWindow
  }

  async connect(config: SyncConfig): Promise<void> {
    if (this.status === 'connected' || this.status === 'connecting') return

    this.config = config
    this.setStatus('connecting')
    this.clientName = `device-${this.clientId.slice(0, 8)}`

    try {
      await this.openWebSocket(config)
      this.reconnectAttempts = 0
      this.setStatus('connected')
      this.startAwareness()
      if (config.autoSync) {
        this.startAutoSync(config.syncIntervalMs)
      }
      this.pushStateToRenderer()
    } catch (err) {
      this.setStatus('error')
      this.scheduleReconnect()
      throw err
    }
  }

  async disconnect(): Promise<void> {
    this.clearTimers()
    if (this.ws) {
      this.sendAwareness('offline')
      this.ws.close()
      this.ws = null
    }
    this.setStatus('disconnected')
    this.peers.clear()
    this.pushStateToRenderer()
  }

  getState(): SyncState {
    return {
      status: this.status,
      lastSyncAt: this.lastSyncAt,
      pendingChanges: this.pendingChanges.size,
      peers: Array.from(this.peers.values()),
    }
  }

  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values())
  }

  async syncFile(filePath: string): Promise<void> {
    if (!this.isConnected()) return

    const resolvedPath = path.resolve(filePath)
    if (!fs.existsSync(resolvedPath)) return
    if (!shouldSyncFile(resolvedPath)) return

    const content = fs.readFileSync(resolvedPath, 'utf-8')
    const hash = hashContent(content)
    const stat = fs.statSync(resolvedPath)
    const lastModified = stat.mtime.toISOString()

    const existing = this.fileIndex.get(resolvedPath)
    if (existing && existing.hash === hash) return

    const entry: FileSyncEntry = {
      path: resolvedPath,
      hash,
      lastModified,
      syncedAt: null,
    }
    this.fileIndex.set(resolvedPath, entry)

    const payload: FileUpdatePayload = {
      filePath: resolvedPath,
      content,
      hash,
      lastModified,
    }

    this.sendMessage({
      type: 'file_update',
      roomId: this.config!.roomId,
      payload,
      timestamp: new Date().toISOString(),
      senderId: this.clientId,
    })

    entry.syncedAt = new Date().toISOString()
    this.pendingChanges.delete(resolvedPath)
    this.lastSyncAt = new Date().toISOString()
    this.pushStateToRenderer()
  }

  async resolveConflict(filePath: string, resolution: ConflictResolution): Promise<void> {
    const conflict = this.conflicts.get(filePath)
    if (!conflict) return

    let resolvedContent: string
    switch (resolution) {
      case 'local':
        resolvedContent = conflict.localContent
        break
      case 'remote':
        resolvedContent = conflict.remoteContent
        break
      case 'merge':
        resolvedContent = this.mergeContents(conflict.localContent, conflict.remoteContent, filePath)
        break
    }

    fs.writeFileSync(filePath, resolvedContent, 'utf-8')
    this.conflicts.delete(filePath)

    const hash = hashContent(resolvedContent)
    const stat = fs.statSync(filePath)
    this.fileIndex.set(filePath, {
      path: filePath,
      hash,
      lastModified: stat.mtime.toISOString(),
      syncedAt: new Date().toISOString(),
    })

    if (this.isConnected()) {
      const payload: FileUpdatePayload = {
        filePath,
        content: resolvedContent,
        hash,
        lastModified: stat.mtime.toISOString(),
      }
      this.sendMessage({
        type: 'file_update',
        roomId: this.config!.roomId,
        payload,
        timestamp: new Date().toISOString(),
        senderId: this.clientId,
      })
    }

    this.pushStateToRenderer()
    this.emit('conflictResolved', filePath)
  }

  scanWorkspace(workspacePath: string): FileSyncEntry[] {
    const entries: FileSyncEntry[] = []
    this.scanDir(workspacePath, entries)
    return entries
  }

  stop(): void {
    this.clearTimers()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setStatus('disconnected')
  }

  private isConnected(): boolean {
    return this.status === 'connected' && this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  private setStatus(status: SyncStatus): void {
    this.status = status
    this.emit('statusChange', status)
  }

  private async openWebSocket(config: SyncConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      // apiKey 通过 X-Api-Key 请求头传递，避免出现在 URL（易被代理/日志记录）
      const url = `${config.serverUrl}/ws?roomId=${encodeURIComponent(config.roomId)}`
      const ws = new WebSocket(url, {
        headers: { 'X-Api-Key': config.apiKey },
      })
      this.ws = ws

      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket connection timeout'))
      }, 15000)

      ws.onopen = () => {
        clearTimeout(timeout)
        resolve()
      }

      ws.onerror = (_event) => {
        clearTimeout(timeout)
        reject(new Error(`WebSocket error: ${_event.message || 'connection failed'}`))
      }

      ws.onclose = (_event) => {
        this.ws = null
        if (this.status === 'connected') {
          this.setStatus('disconnected')
          this.scheduleReconnect()
          this.pushStateToRenderer()
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString()) as SyncFileMessage
          this.handleMessage(message)
        } catch {
          // ignore malformed messages
        }
      }
    })
  }

  private handleMessage(message: SyncFileMessage): void {
    if (message.senderId === this.clientId) return

    switch (message.type) {
      case 'file_update':
        this.handleFileUpdate(message.payload as FileUpdatePayload, message.senderId)
        break
      case 'awareness':
        this.handleAwareness(message.payload as AwarenessPayload)
        break
      case 'file_request':
        this.handleFileRequest(message.payload as { filePath: string; senderId: string })
        break
    }
  }

  private handleFileUpdate(payload: FileUpdatePayload, _senderId: string): void {
    const { filePath, content, hash, lastModified } = payload
    if (!fs.existsSync(filePath)) {
      const existing = this.fileIndex.get(filePath)
      if (!existing) return
    }

    let localContent = ''
    if (fs.existsSync(filePath)) {
      localContent = fs.readFileSync(filePath, 'utf-8')
    }

    const localHash = localContent ? hashContent(localContent) : ''

    if (localHash === hash) return

    if (localContent && localHash !== hash) {
      const remoteTime = new Date(lastModified).getTime()
      const localTime = fs.existsSync(filePath)
        ? fs.statSync(filePath).mtime.getTime()
        : 0

      if (localTime > remoteTime && this.pendingChanges.has(filePath)) {
        const conflict: SyncConflict = {
          filePath,
          localContent,
          remoteContent: content,
          localModified: new Date(localTime).toISOString(),
          remoteModified: lastModified,
        }
        this.conflicts.set(filePath, conflict)
        this.notifyRenderer('sync:conflict', conflict)
        this.emit('conflict', conflict)
        return
      }
    }

    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')

    this.fileIndex.set(filePath, {
      path: filePath,
      hash,
      lastModified,
      syncedAt: new Date().toISOString(),
    })

    this.lastSyncAt = new Date().toISOString()
    this.notifyRenderer('sync:file:change', { filePath, hash })
    this.pushStateToRenderer()
  }

  private handleAwareness(payload: AwarenessPayload): void {
    if (payload.peerId === this.clientId) return
    this.peers.set(payload.peerId, {
      id: payload.peerId,
      name: payload.peerName,
      lastSeen: payload.lastSeen,
      status: payload.status,
    })
    this.pushStateToRenderer()
  }

  private handleFileRequest(payload: { filePath: string; senderId: string }): void {
    const { filePath } = payload
    if (!fs.existsSync(filePath)) return
    const content = fs.readFileSync(filePath, 'utf-8')
    const hash = hashContent(content)
    const stat = fs.statSync(filePath)

    const response: FileUpdatePayload = {
      filePath,
      content,
      hash,
      lastModified: stat.mtime.toISOString(),
    }

    this.sendMessage({
      type: 'file_response',
      roomId: this.config!.roomId,
      payload: response,
      timestamp: new Date().toISOString(),
      senderId: this.clientId,
    })
  }

  private sendMessage(message: SyncFileMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private startAwareness(): void {
    this.sendAwareness('online')
    setInterval(() => {
      if (this.isConnected()) {
        this.sendAwareness('online')
      }
    }, 10000)
  }

  private sendAwareness(status: 'online' | 'offline'): void {
    const payload: AwarenessPayload = {
      peerId: this.clientId,
      peerName: this.clientName,
      status,
      lastSeen: new Date().toISOString(),
    }
    this.sendMessage({
      type: 'awareness',
      roomId: this.config!.roomId,
      payload,
      timestamp: new Date().toISOString(),
      senderId: this.clientId,
    })
  }

  private startAutoSync(intervalMs: number): void {
    if (this.syncInterval) clearInterval(this.syncInterval)
    this.syncInterval = setInterval(() => {
      if (this.isConnected() && this.pendingChanges.size > 0) {
        this.setStatus('syncing')
        for (const filePath of this.pendingChanges) {
          this.syncFile(filePath)
        }
        this.setStatus('connected')
      }
    }, intervalMs)
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('error')
      return
    }

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)

    const delay = this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    this.reconnectTimer = setTimeout(async () => {
      if (this.config && this.status !== 'connected') {
        try {
          await this.connect(this.config)
        } catch {
          this.scheduleReconnect()
        }
      }
    }, delay)
  }

  private clearTimers(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private scanDir(dirPath: string, entries: FileSyncEntry[]): void {
    let items: fs.Dirent[]
    try {
      items = fs.readdirSync(dirPath, { withFileTypes: true })
    } catch {
      return
    }

    for (const item of items) {
      const fullPath = path.join(dirPath, item.name)
      if (item.isDirectory()) {
        if (!IGNORED_DIRS.has(item.name)) {
          this.scanDir(fullPath, entries)
        }
      } else if (item.isFile() && shouldSyncFile(fullPath)) {
        try {
          const stat = fs.statSync(fullPath)
          const content = fs.readFileSync(fullPath, 'utf-8')
          entries.push({
            path: fullPath,
            hash: hashContent(content),
            lastModified: stat.mtime.toISOString(),
            syncedAt: null,
          })
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  private mergeContents(local: string, remote: string, _filePath: string): string {
    if (local === remote) return local
    return `<<<<<<< LOCAL\n${local}\n=======\n${remote}\n>>>>>>> REMOTE\n`
  }

  private notifyRenderer(channel: string, data: unknown): void {
    const win = this.getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }

  private pushStateToRenderer(): void {
    this.notifyRenderer('sync:status', this.getState())
  }
}
