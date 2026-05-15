import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface InputActionsProps {
  error: string | null
}

export function InputActions({ error }: InputActionsProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          className="text-sm px-3 py-2 rounded-lg flex items-center gap-2
                     text-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] border border-[color-mix(in_srgb,var(--color-danger)_15%,transparent)]"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.97 }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            animate={prefersReducedMotion ? {} : { scale: [1, 1.3, 1] }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, repeat: Infinity }}
            style={{ backgroundColor: 'var(--color-danger)' }}
          />
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
