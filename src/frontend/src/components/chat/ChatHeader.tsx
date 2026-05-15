import { useEffect, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import { motion } from 'framer-motion'
import { getWebSocketClient, type WebSocketStatus } from '@/api/websocket'
import { ChatTitle } from './ChatTitle'
import { ChatActions } from './ChatActions'

/* ============================================================
   CHAT HEADER
   ============================================================ */

export function ChatHeader({ onMobileMenuClick }: { onMobileMenuClick?: () => void }) {
  const { messages, sessionId } = useChatStore()
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0)

  // WebSocket connection management
  useEffect(() => {
    if (!sessionId) return

    const ws = getWebSocketClient()
    ws.on({
      onStatusChange: (status) => setWsStatus(status),
      onReconnect: (attempt) => setWsReconnectAttempt(attempt),
      onConnect: () => setWsReconnectAttempt(0),
      onMessage: (msg) => {
        if (msg.type === 'message' && msg.content && msg.role) {
          // Messages are handled by chatStore via HTTP API; WebSocket is for sync only
        }
      },
    })

    ws.connect(sessionId)

    return () => {
      ws.disconnect()
    }
  }, [sessionId])

  return (
    <motion.header
      className="h-[var(--layout-topbar-height)] flex items-center justify-between px-4 z-20 relative shrink-0
                 bg-surface-base border-b border-transparent"
      style={{
        borderImage: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 20%, transparent) 30%, color-mix(in srgb, var(--accent-100) 30%, transparent) 50%, color-mix(in srgb, var(--accent-100) 20%, transparent) 70%, transparent 100%) 1',
        borderImageSlice: '0 0 1 0',
        boxShadow: `
          0 4px 30px color-mix(in srgb, var(--ink-100) 10%, transparent),
          0 1px 0 color-mix(in srgb, var(--accent-100) 8%, transparent) inset
        `,
      }}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Left: Logo + Project Name + Status */}
      <ChatTitle messageCount={messages.length} />

      {/* Right: Actions */}
      <ChatActions
        wsStatus={wsStatus}
        wsReconnectAttempt={wsReconnectAttempt}
        onMobileMenuClick={onMobileMenuClick}
      />
    </motion.header>
  )
}
