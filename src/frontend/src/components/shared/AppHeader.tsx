import { useState, useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { Icon } from '@/components/ui/Icon'
import { Save, History } from 'lucide-react'
import { motion } from 'framer-motion'
import { getWebSocketClient, type WebSocketStatus } from '@/api/websocket'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { BreathingLogo } from './HeaderLogo'
import { NavTabs } from './HeaderNav'
import { ThemeSelector, WebSocketStatusBadge, IconButton } from './HeaderActions'

/* ============================================================
   APP HEADER - Shared across all pages
   ============================================================ */

export function AppHeader() {
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>('disconnected')
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0)
  const sessionId = useChatStore((s) => s.sessionId)

  // WebSocket connection management
  useEffect(() => {
    if (!sessionId) return

    const ws = getWebSocketClient()
    ws.on({
      onStatusChange: (status) => setWsStatus(status),
      onReconnect: (attempt) => setWsReconnectAttempt(attempt),
      onConnect: () => setWsReconnectAttempt(0),
      onMessage: () => {},
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
      {/* Left: Logo + Project Name */}
      <div className="flex items-center gap-3">
        <BreathingLogo />
        <motion.h1
          className="font-semibold text-sm text-primary tracking-wide"
          style={{ letterSpacing: '0.08em' }}
          initial={{ x: -8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          自动化写作软件
        </motion.h1>
      </div>

      {/* Center: Navigation Tabs */}
      <NavTabs />

      {/* Right: Actions */}
      <motion.div
        className="flex items-center gap-1 sm:gap-2"
        initial={{ x: 8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        <WebSocketStatusBadge status={wsStatus} reconnectAttempt={wsReconnectAttempt} />
        <IconButton
          icon={<Icon icon={Save} size="sm" />}
          title="保存会话"
        />
        <IconButton
          icon={<Icon icon={History} size="sm" />}
          title="历史记录"
        />
        <ThemeSelector />
      </motion.div>
    </motion.header>
  )
}

// Re-export sub-components for consumers
export { BreathingLogo } from './HeaderLogo'
export { NavTabs } from './HeaderNav'
export { ThemeSelector, WebSocketStatusBadge, IconButton } from './HeaderActions'
