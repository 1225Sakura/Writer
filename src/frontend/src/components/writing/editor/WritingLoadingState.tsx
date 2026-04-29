import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export function WritingLoadingState() {
  return (
    <motion.div
      className="writing-loading flex items-center justify-center min-h-[300px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-10 h-10">
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              border: '1.5px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)',
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
          {/* Inner gradient orb */}
          <motion.div
            className="absolute inset-1.5 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 25%, transparent), color-mix(in srgb, var(--color-character) 18%, transparent))',
              boxShadow: '0 0 12px color-mix(in srgb, var(--accent-primary) 15%, transparent)',
            }}
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.6, 0.9, 0.6],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          {/* Center dot */}
          <motion.div
            className="absolute inset-[15px] rounded-sm"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 60%, transparent)',
            }}
            animate={{
              scale: [1, 0.8, 1],
              opacity: [0.8, 0.4, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
        <motion.span
          className="text-xs font-medium tracking-wide"
          style={{ color: 'var(--text-tertiary)' }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          正在准备创作空间...
        </motion.span>
      </div>
    </motion.div>
  )
}