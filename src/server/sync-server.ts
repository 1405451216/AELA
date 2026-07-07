import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'

interface RoomPeer {
  id: string
  ws: WebSocket
  roomId: string
  apiKey: string
  name: string
  lastSeen: string
}

interface SyncMessage {
  type: string
  roomId: string
  payload: unknown
  timestamp: string
  senderId: string
}

const PORT = parseInt(process.env.SYNC_PORT || '1234', 10)
const PERSISTENCE_DIR = process.env.SYNC_PERSIST_DIR || path.join(process.cwd(), '.sync-data')

const rooms = new Map<string, Set<RoomPeer>>()
const peers = new Map<WebSocket, RoomPeer>()

// ===== 基础速率限制（内存令牌桶 / 滑动窗口） =====
// 消息令牌桶：同一 apiKey 每 10 秒最多 200 条消息
const MSG_RATE_MAX = 200
const MSG_RATE_WINDOW_MS = 10_000
const msgRateBuckets = new Map<string, { tokens: number; lastRefill: number }>()

function messageRateAllow(apiKey: string): boolean {
  const now = Date.now()
  const bucket = msgRateBuckets.get(apiKey) ?? { tokens: MSG_RATE_MAX, lastRefill: now }
  const elapsed = now - bucket.lastRefill
  if (elapsed >= MSG_RATE_WINDOW_MS) {
    bucket.tokens = MSG_RATE_MAX
    bucket.lastRefill = now
  } else {
    bucket.tokens = Math.min(
      MSG_RATE_MAX,
      bucket.tokens + (elapsed / MSG_RATE_WINDOW_MS) * MSG_RATE_MAX,
    )
  }
  if (bucket.tokens < 1) {
    bucket.lastRefill = now
    msgRateBuckets.set(apiKey, bucket)
    return false
  }
  bucket.tokens -= 1
  msgRateBuckets.set(apiKey, bucket)
  return true
}

// 连接滑动窗口：同一 apiKey 每分钟最多 30 次新建连接
const CONN_RATE_MAX = 30
const CONN_RATE_WINDOW_MS = 60_000
const connRateCounts = new Map<string, { count: number; windowStart: number }>()

function connectionRateAllow(apiKey: string): boolean {
  const now = Date.now()
  const rec = connRateCounts.get(apiKey) ?? { count: 0, windowStart: now }
  if (now - rec.windowStart >= CONN_RATE_WINDOW_MS) {
    rec.count = 0
    rec.windowStart = now
  }
  if (rec.count >= CONN_RATE_MAX) {
    connRateCounts.set(apiKey, rec)
    return false
  }
  rec.count += 1
  connRateCounts.set(apiKey, rec)
  return true
}

function persistRoomState(roomId: string): void {
  const roomPeers = rooms.get(roomId)
  if (!roomPeers) return

  const state = {
    roomId,
    peers: Array.from(roomPeers).map(p => ({
      id: p.id,
      name: p.name,
      lastSeen: p.lastSeen,
    })),
    persistedAt: new Date().toISOString(),
  }

  const persistFile = path.join(PERSISTENCE_DIR, `${roomId}.json`)
  fs.mkdirSync(PERSISTENCE_DIR, { recursive: true })
  fs.writeFileSync(persistFile, JSON.stringify(state, null, 2), 'utf-8')
}

function broadcastToRoom(sender: RoomPeer, message: SyncMessage): void {
  const roomPeers = rooms.get(sender.roomId)
  if (!roomPeers) return

  const data = JSON.stringify(message)
  for (const peer of roomPeers) {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(data)
    }
  }
}

function removePeer(ws: WebSocket): void {
  const peer = peers.get(ws)
  if (!peer) return

  const roomPeers = rooms.get(peer.roomId)
  if (roomPeers) {
    roomPeers.delete(peer)
    if (roomPeers.size === 0) {
      rooms.delete(peer.roomId)
    } else {
      persistRoomState(peer.roomId)
    }
  }
  peers.delete(ws)
  msgRateBuckets.delete(peer.apiKey)
}

function addPeer(ws: WebSocket, roomId: string, apiKey: string): RoomPeer {
  const peer: RoomPeer = {
    id: randomUUID(),
    ws,
    roomId,
    apiKey,
    name: `device-${randomUUID().slice(0, 8)}`,
    lastSeen: new Date().toISOString(),
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set())
  }
  rooms.get(roomId)!.add(peer)
  peers.set(ws, peer)

  return peer
}

const httpServer = createServer((_req, res) => {
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      rooms: rooms.size,
      peers: peers.size,
      uptime: process.uptime(),
    }))
    return
  }

  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`)
  const roomId = url.searchParams.get('roomId')
  // apiKey 优先从请求头 X-Api-Key 读取，兼容 Sec-WebSocket-Protocol 子协议 auth.<apiKey>
  const headerApiKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined
  const subProtocol = req.headers['sec-websocket-protocol']
  let subApiKey: string | undefined
  if (typeof subProtocol === 'string') {
    const hit = subProtocol.split(',').map((s) => s.trim()).find((p) => p.startsWith('auth.'))
    if (hit) subApiKey = hit.slice('auth.'.length)
  } else if (Array.isArray(subProtocol)) {
    const hit = subProtocol.find((p) => p.startsWith('auth.'))
    if (hit) subApiKey = hit.slice('auth.'.length)
  }
  const apiKey = headerApiKey || subApiKey

  if (!roomId || !apiKey) {
    ws.close(4001, 'Missing roomId or apiKey')
    return
  }

  // 基础连接速率限制，防止连接洪水
  if (!connectionRateAllow(apiKey)) {
    ws.close(4029, 'Too many connections, slow down')
    return
  }

  const peer = addPeer(ws, roomId, apiKey)

  ws.send(JSON.stringify({
    type: 'welcome',
    payload: { peerId: peer.id, peerName: peer.name },
    timestamp: new Date().toISOString(),
    senderId: 'server',
  }))

  ws.on('message', (raw) => {
    try {
      // 基础消息速率限制（令牌桶），防止滥用
      if (!messageRateAllow(apiKey)) {
        ws.close(4029, 'Rate limit exceeded')
        return
      }
      const message = JSON.parse(raw.toString()) as SyncMessage
      message.senderId = peer.id
      peer.lastSeen = new Date().toISOString()
      broadcastToRoom(peer, message)
    } catch {
      // ignore malformed messages
    }
  })

  ws.on('close', () => {
    removePeer(ws)
  })

  ws.on('error', () => {
    // connection error, will be followed by close
    removePeer(ws)
  })
})

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[SyncServer] Listening on port ${PORT}`)
  // eslint-disable-next-line no-console
  console.log(`[SyncServer] Persistence dir: ${PERSISTENCE_DIR}`)
})

process.on('SIGINT', () => {
  for (const [, peer] of peers) {
    peer.ws.close(1001, 'Server shutting down')
  }
  httpServer.close(() => process.exit(0))
})
