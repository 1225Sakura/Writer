import { getOnlineStatus, setupOnlineDetection } from './request'

// ============================================
// Types
// ============================================

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting'

export interface WSMessage {
  type: 'message' | 'ping' | 'pong' | 'error' | 'queued_message' | 'typing' | 'entity_extracted'
  content?: string
  role?: 'user' | 'assistant'
  timestamp?: number
  data?: unknown
  code?: string
  retry_after?: number
}

export interface WSCallbacks {
  onMessage?: (msg: WSMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Error) => void
  onReconnect?: (attempt: number) => void
  onStatusChange?: (status: WebSocketStatus) => void
}

interface QueuedMessage {
  data: WSMessage
  timestamp: number
  retryCount: number
}

// ============================================
// Configuration
// ============================================

const WS_CONFIG = {
  heartbeatInterval: 25000,
  heartbeatTimeout: 35000,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  reconnectMaxAttempts: 10,
  reconnectJitter: 0.3,
  messageQueueMaxSize: 100,
}

// ============================================
// WebSocket Client with Reconnection
// ============================================

export class ChatWebSocketClient {
  private ws: WebSocket | null = null
  private sessionId: number | null = null
  private apiKey: string | null = null
  private baseUrl: string = ''

  private status: WebSocketStatus = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null
  private pongReceived = true

  private messageQueue: QueuedMessage[] = []
  private callbacks: WSCallbacks = {}

  private onlineCleanup: (() => void) | null = null
  private _intentionalClose = false

  // Getters
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get currentStatus(): WebSocketStatus {
    return this.status
  }

  get queueSize(): number {
    return this.messageQueue.length
  }

  // ============================================
  // Lifecycle
  // ============================================

  connect(sessionId: number, options: { baseUrl?: string; apiKey?: string } = {}): void {
    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    this.sessionId = sessionId
    this.apiKey = options.apiKey || null
    this.baseUrl = options.baseUrl || this.resolveWSUrl()
    this._intentionalClose = false

    this.setStatus('connecting')
    this.tryConnect()

    // Watch online/offline
    if (!this.onlineCleanup) {
      this.onlineCleanup = setupOnlineDetection(
        () => {
          if (this.status === 'disconnected' && !this._intentionalClose) {
            this.reconnectAttempts = 0
            this.tryConnect()
          }
        },
        () => {
          this.disconnect()
        }
      )
    }
  }

  disconnect(): void {
    this._intentionalClose = true
    this.clearTimers()

    if (this.ws) {
      // Remove listeners before close to prevent reconnection
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.onopen = null
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect')
      }
      this.ws = null
    }

    this.setStatus('disconnected')
    this.reconnectAttempts = 0
  }

  dispose(): void {
    this.disconnect()
    if (this.onlineCleanup) {
      this.onlineCleanup()
      this.onlineCleanup = null
    }
    this.callbacks = {}
  }

  // ============================================
  // Callback Registration
  // ============================================

  on(callbacks: WSCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks }
  }

  off(): void {
    this.callbacks = {}
  }

  // ============================================
  // Messaging
  // ============================================

  send(message: WSMessage): boolean {
    if (this.isConnected && this.ws) {
      try {
        this.ws.send(JSON.stringify(message))
        return true
      } catch (e) {
        this.queueMessage(message)
        return false
      }
    }

    // Offline - queue for later
    this.queueMessage(message)
    return false
  }

  sendText(content: string, role: 'user' | 'assistant' = 'user'): boolean {
    return this.send({ type: 'message', content, role, timestamp: Date.now() })
  }

  /** Flush queued messages when connection is restored */
  flushQueue(): void {
    if (!this.isConnected || this.messageQueue.length === 0) return

    const toSend = [...this.messageQueue]
    this.messageQueue = []

    for (const item of toSend) {
      try {
        this.ws?.send(JSON.stringify(item.data))
      } catch {
        // Re-queue if send fails
        this.queueMessage(item.data)
      }
    }
  }

  // ============================================
  // Private
  // ============================================

  private resolveWSUrl(): string {
    // Derive WS URL from current API base
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000'
    const wsProtocol = apiBase.startsWith('https') ? 'wss' : 'ws'
    const host = apiBase.replace(/^https?:\/\//, '').replace(/\/api\/v1$/, '')
    return `${wsProtocol}://${host}`
  }

  private tryConnect(): void {
    if (!this.sessionId) return
    if (!getOnlineStatus()) {
      this.setStatus('disconnected')
      return
    }

    const url = new URL(`${this.baseUrl}/ws/chat/${this.sessionId}`)
    if (this.apiKey) {
      url.searchParams.set('api_key', this.apiKey)
    }

    try {
      this.ws = new WebSocket(url.toString())
      this.bindEvents()
    } catch (e) {
      this.scheduleReconnect()
    }
  }

  private bindEvents(): void {
    if (!this.ws) return

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.setStatus('connected')
      this.startHeartbeat()
      this.callbacks.onConnect?.()
      this.flushQueue()
    }

    this.ws.onmessage = (event) => {
      // Handle text "pong" from server ping
      if (event.data === 'pong') {
        this.pongReceived = true
        return
      }

      try {
        const msg = JSON.parse(event.data) as WSMessage

        // Respond to server ping
        if (msg.type === 'ping') {
          this.ws?.send('pong')
          return
        }

        this.callbacks.onMessage?.(msg)
      } catch {
        // Non-JSON message - ignore
      }
    }

    this.ws.onclose = (event) => {
      this.clearTimers()
      this.setStatus('disconnected')
      this.callbacks.onDisconnect?.()

      // Reconnect unless intentional close
      if (!this._intentionalClose && event.code !== 1000) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // Let onclose handle reconnection
      this.callbacks.onError?.(new Error('WebSocket connection error'))
    }
  }

  private scheduleReconnect(): void {
    if (this._intentionalClose) return
    if (this.reconnectAttempts >= WS_CONFIG.reconnectMaxAttempts) {
      this.setStatus('disconnected')
      this.callbacks.onError?.(
        new Error(`WebSocket重连失败，已达到最大尝试次数 (${WS_CONFIG.reconnectMaxAttempts})`)
      )
      return
    }

    this.reconnectAttempts++
    this.setStatus('reconnecting')
    this.callbacks.onReconnect?.(this.reconnectAttempts)

    // Exponential backoff with jitter
    const delay = Math.min(
      WS_CONFIG.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1),
      WS_CONFIG.reconnectMaxDelay
    )
    const jitter = delay * WS_CONFIG.reconnectJitter * (Math.random() * 2 - 1)
    const finalDelay = Math.max(WS_CONFIG.reconnectBaseDelay, delay + jitter)

    this.reconnectTimer = setTimeout(() => {
      this.tryConnect()
    }, finalDelay)
  }

  private startHeartbeat(): void {
    this.pongReceived = true

    this.heartbeatTimer = setInterval(() => {
      if (!this.pongReceived) {
        // Missed pong - connection is stale
        this.ws?.close(1001, 'Heartbeat timeout')
        return
      }

      this.pongReceived = false
      try {
        this.ws?.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
      } catch {
        this.ws?.close(1001, 'Heartbeat send failed')
      }

      // Timeout if no pong received
      this.heartbeatTimeoutTimer = setTimeout(() => {
        if (!this.pongReceived) {
          this.ws?.close(1001, 'Heartbeat timeout')
        }
      }, WS_CONFIG.heartbeatTimeout)
    }, WS_CONFIG.heartbeatInterval)
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer)
      this.heartbeatTimeoutTimer = null
    }
  }

  private queueMessage(message: WSMessage): void {
    if (this.messageQueue.length >= WS_CONFIG.messageQueueMaxSize) {
      this.messageQueue.shift() // Remove oldest
    }
    this.messageQueue.push({
      data: message,
      timestamp: Date.now(),
      retryCount: 0,
    })
  }

  private setStatus(status: WebSocketStatus): void {
    if (this.status !== status) {
      this.status = status
      this.callbacks.onStatusChange?.(status)
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let wsClient: ChatWebSocketClient | null = null

export const getWebSocketClient = (): ChatWebSocketClient => {
  if (!wsClient) {
    wsClient = new ChatWebSocketClient()
  }
  return wsClient
}

export const resetWebSocketClient = (): void => {
  if (wsClient) {
    wsClient.dispose()
    wsClient = null
  }
}

// Re-export types
export type { QueuedMessage }
