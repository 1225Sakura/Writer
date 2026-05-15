import { motion } from 'framer-motion'
import { BreathingLogo } from '@/components/shared/HeaderLogo'

/* ============================================================
   CHAT TITLE - Logo + project name + message count
   ============================================================ */

export function ChatTitle({ messageCount }: { messageCount: number }) {
  return (
    <div className="flex items-center gap-3">
      <BreathingLogo />
      <motion.h1
        className="font-semibold text-sm text-primary tracking-wide relative"
        style={{ letterSpacing: '0.08em' }}
        initial={{ x: -8, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="relative">自动化写作软件</span>
      </motion.h1>
      {messageCount > 0 && (
        <motion.span
          className="text-xs ml-2 px-2 py-0.5 rounded-full border border-subtle
                     text-secondary bg-surface-base"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.25 }}
        >
          {messageCount} 条消息
        </motion.span>
      )}
    </div>
  )
}
