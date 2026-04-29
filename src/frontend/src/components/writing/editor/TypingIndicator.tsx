import { motion } from 'framer-motion'
import { Type } from 'lucide-react'
import { usePrefersReducedMotion } from '@/hooks'

interface TypingIndicatorProps {
  isTyping: boolean
}

export function TypingIndicator({ }: TypingIndicatorProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md"
      style={{
        background: 'color-mix(in srgb, var(--color-ifline) 6%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-ifline) 12%, transparent)',
      }}
    >
      <motion.div
        animate={prefersReducedMotion ? {} : { opacity: [1, 0.3, 1] }}
        transition={prefersReducedMotion ? {} : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Type className="w-3 h-3" style={{ color: 'var(--color-ifline)' }} />
      </motion.div>
      <span className="text-[10px] font-medium" style={{ color: 'var(--color-ifline)' }}>写作中</span>
    </motion.div>
  )
}