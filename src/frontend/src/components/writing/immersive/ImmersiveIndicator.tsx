import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useImmersiveModeContext } from './ImmersiveModeContext'

const IMMERSIVE_SPRING = { type: 'spring' as const, stiffness: 220, damping: 28 }

export function ImmersiveIndicator() {
  const { immersiveMode, chromeVisible, prefersReducedMotion } = useImmersiveModeContext()

  return (
    <AnimatePresence>
      {immersiveMode && chromeVisible && (
        <motion.div
          key="immersive-indicator"
          initial={{ opacity: 0, y: -12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.92 }}
          transition={{ ...IMMERSIVE_SPRING, delay: 0.15 }}
          className="fixed top-5 left-5 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full immersive-indicator"
          style={{
            background: 'color-mix(in srgb, var(--ink-90) 40%, transparent)',
            backdropFilter: 'blur(20px) saturate(1.1)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
            border: '1px solid color-mix(in srgb, var(--paper-100) 8%, transparent)',
            boxShadow: `
              0 4px 24px color-mix(in srgb, var(--ink-100) 12%, transparent),
              inset 0 1px 0 color-mix(in srgb, var(--paper-100) 6%, transparent)
            `,
          }}
        >
          <motion.div
            animate={prefersReducedMotion ? {} : { rotate: 360 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 16, repeat: Infinity, ease: 'linear' }}
            className="flex items-center justify-center"
          >
            <Sparkles className="w-3 h-3" style={{ color: 'color-mix(in srgb, var(--color-character) 55%, transparent)' }} />
          </motion.div>
          <span className="text-[10px] font-medium tracking-[0.12em] uppercase" style={{ color: 'color-mix(in srgb, var(--paper-100) 55%, transparent)' }}>沉浸模式</span>
          <motion.div
            className="w-1 h-1 rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--color-character) 50%, transparent)',
              boxShadow: '0 0 8px color-mix(in srgb, var(--color-character) 30%, transparent)',
            }}
            animate={prefersReducedMotion ? {} : {
              opacity: [0.4, 1, 0.4],
              scale: [0.9, 1.1, 0.9],
            }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
