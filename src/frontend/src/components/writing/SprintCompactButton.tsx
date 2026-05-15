/**
 * SprintCompactButton - Compact floating button for WritingSprintTimer (closed state)
 */

import { motion } from 'framer-motion'
import { Timer, Coffee } from 'lucide-react'

interface SprintCompactButtonProps {
  timeRemaining: string
  isRunning: boolean
  isBreak: boolean
  sprintCount: number
  onOpen: () => void
}

export function SprintCompactButton({
  timeRemaining,
  isRunning,
  isBreak,
  sprintCount,
  onOpen,
}: SprintCompactButtonProps) {
  const timerBg = isRunning
    ? isBreak
      ? 'bg-[var(--color-ifline)]/10'
      : 'bg-[var(--accent-primary)]/10'
    : 'bg-[var(--color-surface-raised)]'
  const timerBorder = isRunning
    ? isBreak
      ? 'border-[var(--color-ifline)]/30'
      : 'border-[var(--accent-primary)]/30'
    : 'border-[var(--border-default)]'
  const timerText = isRunning
    ? isBreak
      ? 'text-[var(--color-ifline)]'
      : 'text-[var(--accent-primary)]'
    : 'text-[var(--text-secondary)]'
  const timerGlow = isRunning
    ? isBreak
      ? 'shadow-[0_0_12px_color-mix(in_srgb,var(--color-ifline)_15%,transparent)]'
      : 'shadow-[0_0_12px_color-mix(in_srgb,var(--accent-primary)_15%,transparent)]'
    : 'shadow-drawer'

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className={`fixed right-4 top-16 z-50 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                 transition-all duration-200 border ${timerBg} ${timerBorder} ${timerText} ${timerGlow}`}
      style={{ background: 'var(--color-surface-raised)' }}
      aria-label="写作冲刺计时器"
      title="写作冲刺计时器"
    >
      {isRunning ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <Timer className="w-3.5 h-3.5" />
        </motion.div>
      ) : (
        <Timer className="w-3.5 h-3.5" />
      )}
      <span className="tabular-nums font-semibold tracking-tight">{timeRemaining}</span>
      {isBreak && <Coffee className="w-3 h-3" />}
      {sprintCount > 0 && (
        <span className="text-[10px] opacity-60">({sprintCount})</span>
      )}
      {isRunning && (
        <motion.span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isBreak ? 'var(--color-ifline)' : 'var(--accent-primary)',
          }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.button>
  )
}
