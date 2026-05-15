import { Icon } from '@/components/ui/Icon'
import { Wifi, WifiOff } from 'lucide-react'
import { motion } from 'framer-motion'
import type { WebSocketStatus } from '@/api/websocket'

/* ============================================================
   WEBSOCKET STATUS BADGE
   ============================================================ */

export function WebSocketStatusBadge({
  status,
  reconnectAttempt,
}: {
  status: WebSocketStatus
  reconnectAttempt: number
}) {
  if (status === 'connected') return null

  return (
    <motion.div
      className="flex items-center gap-1.5 ml-2 text-[10px] px-2.5 py-0.5 rounded-full border
                 bg-surface-base relative overflow-hidden"
      style={{
        color: status === 'reconnecting' ? 'var(--color-danger)' : 'var(--text-secondary)',
        borderColor: status === 'reconnecting' ? 'color-mix(in srgb, var(--vermillion-100) 30%, transparent)' : 'var(--border-subtle)',
        backgroundColor: status === 'reconnecting' ? 'color-mix(in srgb, var(--vermillion-100) 8%, transparent)' : 'var(--color-surface-base)',
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
    >
      {status === 'connecting' && (
        <span className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: 'color-mix(in srgb, var(--accent-100) 30%, transparent)' }} />
      )}
      {status === 'reconnecting' && (
        <span className="absolute inset-0 rounded-full animate-ping opacity-25"
          style={{ backgroundColor: 'color-mix(in srgb, var(--vermillion-100) 30%, transparent)' }} />
      )}
      {status === 'reconnecting' ? (
        <>
          <Icon icon={WifiOff} size="xs" className="relative z-10" />
          <span className="relative z-10">重连中{reconnectAttempt > 0 ? `(${reconnectAttempt})` : ''}</span>
        </>
      ) : status === 'connecting' ? (
        <>
          <Icon icon={Wifi} size="xs" className="animate-pulse relative z-10" />
          <span className="relative z-10">连接中</span>
        </>
      ) : (
        <>
          <Icon icon={WifiOff} size="xs" className="relative z-10" />
          <span className="relative z-10">已断开</span>
        </>
      )}
    </motion.div>
  )
}
