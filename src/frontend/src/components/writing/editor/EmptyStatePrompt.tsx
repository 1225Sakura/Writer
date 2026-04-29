import { motion } from 'framer-motion'
import { Feather, Keyboard } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface EmptyStatePromptProps {
  onStart?: () => void
}

export function EmptyStatePrompt({ onStart }: EmptyStatePromptProps) {
  return (
    <motion.div
      className="writing-empty-state"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      <motion.div
        className="writing-empty-state__icon"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        <Feather className="w-5 h-5" />
      </motion.div>
      <motion.h3
        className="writing-empty-state__title"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        开始你的创作
      </motion.h3>
      <motion.p
        className="writing-empty-state__hint"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        点击此处开始写作，或使用快捷键 Ctrl+Shift+W 续写
      </motion.p>
      <motion.button
        className="mt-5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200"
        style={{
          background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
          color: 'var(--accent-primary)',
        }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        whileHover={{
          scale: 1.03,
          background: 'color-mix(in srgb, var(--accent-primary) 18%, transparent)',
        }}
        whileTap={{ scale: 0.98 }}
        onClick={onStart}
      >
        开始写作
      </motion.button>
      <motion.div
        className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg"
        style={{
          background: 'color-mix(in srgb, var(--color-surface-raised) 60%, transparent)',
          border: '1px solid var(--border-subtle)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <Keyboard className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          Ctrl+Shift+O 优化 / E 扩写 / S 缩写 / R 改写 / W 续写 / P 润色
        </span>
      </motion.div>
    </motion.div>
  )
}