import { useUIStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Settings, PenTool } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/* ============================================================
   TOP GRADIENT DIVIDER
   ============================================================ */

function TopGradientDivider() {
  return (
    <div className="absolute top-0 left-0 right-0 h-px pointer-events-none z-10">
      <div
        className="h-full w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 30%, transparent) 15%, color-mix(in srgb, var(--accent-100) 50%, transparent) 50%, color-mix(in srgb, var(--accent-100) 30%, transparent) 85%, transparent 100%)',
        }}
      />
      {/* Subtle glow below the line */}
      <div
        className="absolute top-0 left-0 right-0 h-4"
        style={{
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent-100) 8%, transparent) 0%, transparent 100%)',
        }}
      />
    </div>
  )
}

/* ============================================================
   CHAT FOOTER
   ============================================================ */

export function ChatFooter() {
  const { setCurrentInterface } = useUIStore()
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.footer
      className="h-[var(--layout-topbar-height)] flex items-center justify-between px-2 sm:px-4 shrink-0 relative z-20
                 bg-[var(--color-surface-raised)]"
      style={{
        boxShadow: `
          0 -6px 30px color-mix(in srgb, var(--ink-100) 12%, transparent),
          0 -1px 0 color-mix(in srgb, var(--accent-100) 15%, transparent) inset
        `,
      }}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Top gradient divider decoration */}
      <TopGradientDivider />
      {/* Left: AI status indicator */}
      <div className="flex items-center gap-3">
        <motion.div
          className="flex items-center gap-1.5 text-xs text-secondary hidden sm:inline"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        >
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]"
            animate={prefersReducedMotion ? {} : { opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span>AI 正在引导你完善故事设定</span>
        </motion.div>
      </div>

      {/* Right: Action buttons */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Settings button */}
        <motion.div
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
        >
          <Button
            onClick={() => setCurrentInterface('settings')}
            variant="secondary"
            size="sm"
            className="touch-target-min"
          >
            <Icon icon={Settings} size="sm" />
            <span className="hidden sm:inline">设定编辑</span>
          </Button>
        </motion.div>

        {/* Primary action - Start Writing */}
        <motion.div
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="relative"
        >
          {/* Pulsing ambient glow ring */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-[-6px] rounded-xl pointer-events-none"
              style={{
                background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-100) 30%, transparent) 0%, transparent 70%)',
                filter: 'blur(6px)',
              }}
              animate={{
                opacity: [0.1, 0.25, 0.1],
                scale: [1, 1.06, 1],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <Button
            onClick={() => setCurrentInterface('writing')}
            variant="glow"
            size="sm"
            className="touch-target-min relative z-10"
            glowColor="var(--accent-primary)"
            style={{
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-90) 50%, var(--accent-primary) 100%)',
              backgroundSize: '200% 200%',
              boxShadow: '0 0 16px color-mix(in srgb, var(--accent-100) 30%, transparent), 0 4px 12px color-mix(in srgb, var(--accent-100) 15%, transparent)',
            }}
          >
            <Icon icon={PenTool} size="sm" />
            <span className="hidden sm:inline">开始写作</span>
            <Icon icon={ArrowRight} size="xs" />
          </Button>
        </motion.div>
      </div>
    </motion.footer>
  )
}
