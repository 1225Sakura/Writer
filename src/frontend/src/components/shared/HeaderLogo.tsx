import { motion } from 'framer-motion'
import { PenTool } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/* ============================================================
   BREATHING LOGO
   ============================================================ */

export function BreathingLogo() {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      className="w-9 h-9 rounded-xl flex items-center justify-center relative"
      style={{
        background: 'linear-gradient(135deg, var(--accent-primary) 0%, color-mix(in srgb, var(--accent-primary) 60%, var(--accent-80)) 100%)',
        boxShadow: `
          0 0 16px color-mix(in srgb, var(--accent-100) 25%, transparent),
          0 4px 12px color-mix(in srgb, var(--accent-100) 15%, transparent),
          inset 0 1px 1px color-mix(in srgb, white 20%, transparent)
        `,
      }}
      initial={{ scale: 0.8, opacity: 0, rotate: -10 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ delay: 0.1, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{
        scale: 1.06,
        boxShadow: `
          0 0 24px color-mix(in srgb, var(--accent-100) 40%, transparent),
          0 6px 16px color-mix(in srgb, var(--accent-100) 20%, transparent)
        `,
      }}
      whileTap={{ scale: 0.92 }}
    >
      <Icon icon={PenTool} size="sm" className="text-white drop-shadow-lg" />
      {!prefersReducedMotion && (
        <motion.span
          className="absolute inset-[-3px] rounded-xl border-2 border-transparent"
          style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-90)) border-box',
            WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            opacity: 0.3,
          }}
          animate={{
            opacity: [0.15, 0.35, 0.15],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  )
}
