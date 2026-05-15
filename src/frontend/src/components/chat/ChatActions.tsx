import { useUIStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ArrowRight, Settings, Save, History, Menu } from 'lucide-react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { ThemeSelector, IconButton } from '@/components/shared/HeaderActions'
import type { WebSocketStatus } from '@/api/websocket'
import { WebSocketStatusBadge } from './ChatStatus'

/* ============================================================
   CHAT ACTIONS - Right side of chat header
   ============================================================ */

export function ChatActions({
  wsStatus,
  wsReconnectAttempt,
  onMobileMenuClick,
}: {
  wsStatus: WebSocketStatus
  wsReconnectAttempt: number
  onMobileMenuClick?: () => void
}) {
  const { setCurrentInterface } = useUIStore()

  return (
    <motion.div
      className="flex items-center gap-1 sm:gap-2"
      initial={{ x: 8, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      {/* Status badge */}
      <WebSocketStatusBadge status={wsStatus} reconnectAttempt={wsReconnectAttempt} />

      {/* Mobile: Show collected info button */}
      {onMobileMenuClick && (
        <motion.button
          onClick={onMobileMenuClick}
          className="md:hidden mobile-menu-btn mr-1 p-2 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="查看已收集信息"
        >
          <Icon icon={Menu} size="sm" />
        </motion.button>
      )}
      <IconButton
        icon={<Icon icon={Save} size="sm" />}
        title="保存会话"
      />
      <IconButton
        icon={<Icon icon={History} size="sm" />}
        title="历史记录"
      />
      <ThemeSelector />
      <Button
        onClick={() => setCurrentInterface('settings')}
        variant="primary"
        size="sm"
        className="touch-target-min"
      >
        <Icon icon={Settings} size="sm" />
        <span className="hidden sm:inline">进入设定</span>
        <Icon icon={ArrowRight} size="xs" />
      </Button>
    </motion.div>
  )
}
