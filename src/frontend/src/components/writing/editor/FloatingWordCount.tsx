import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface FloatingWordCountProps {
  wordCount: number
  isTyping: boolean
}

export function FloatingWordCount({ wordCount, isTyping }: FloatingWordCountProps) {
  return (
    <motion.div
      className="word-count-pill word-count-pill--floating"
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
    >
      <motion.span
        className="word-count-pill__number"
        key={wordCount}
        initial={{ scale: 1.15, opacity: 0.8 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
      >
        {wordCount}
      </motion.span>
      <span className="word-count-pill__label">字</span>
      <motion.span
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        className="w-1.5 h-1.5 rounded-full"
        style={{
          background: 'var(--color-ifline)',
          boxShadow: '0 0 4px color-mix(in srgb, var(--color-ifline) 50%, transparent)',
        }}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      />
    </motion.div>
  )
}