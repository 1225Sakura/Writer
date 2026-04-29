import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { ChevronDown, Loader2 } from 'lucide-react'

interface SectionProps {
  title: string
  icon?: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function Section({ title, icon, isExpanded, onToggle, children }: SectionProps) {
  return (
    <motion.div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
      }}
      whileHover={{ borderColor: 'var(--border-strong)' }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    >
      <motion.button
        onClick={onToggle}
        className="w-full px-3.5 py-3 flex items-center gap-2.5 transition-colors hover:bg-[var(--hover-bg)]"
        whileTap={{ scale: 0.98 }}
      >
        <motion.span
          className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
          style={{ background: 'var(--accent-muted)', color: 'var(--accent-primary)' }}
          whileHover={{ scale: 1.1 }}
        >
          {icon}
        </motion.span>
        <span className="flex-1 text-left text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 24 }}
        >
          <ChevronDown
            className="w-4 h-4 flex-shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
          />
        </motion.div>
      </motion.button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className="overflow-hidden"
          >
            <div
              className="px-3.5 pb-3.5 pt-1"
              style={{
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--color-surface-raised)',
              }}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface AIOperationButtonProps {
  operation: {
    key: string
    label: string
    shortcut: string
    icon: React.ReactNode
    activeIcon: React.ReactNode
    description: string
    color: string
  }
  isLoading: boolean
  isDisabled: boolean
  progress?: number
  onClick: () => void
}

export function AIOperationButton({
  operation,
  isLoading,
  isDisabled,
  progress,
  onClick,
}: AIOperationButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      variants={{
        hidden: { opacity: 0, y: 8, scale: 0.96 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 28 } }
      }}
      whileHover={isDisabled ? {} : { y: -2 }}
      whileTap={{ scale: isDisabled ? 1 : 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 overflow-hidden touch-target-button
        ${isLoading
          ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5'
          : 'border-[var(--border-default)] bg-[var(--color-surface-base)] hover:border-[var(--border-strong)]'
        }
        ${isDisabled && !isLoading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-muted)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon */}
      <span
        className={`flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 transition-all duration-200 ${
          isLoading ? 'scale-75 opacity-0' : ''
        }`}
        style={{
          background: isLoading
            ? 'transparent'
            : `color-mix(in srgb, ${operation.color} 12%, transparent)`,
          color: isLoading ? 'var(--accent-primary)' : operation.color,
        }}
      >
        {isLoading ? operation.activeIcon : operation.icon}
      </span>

      {/* Label */}
      <span
        className={`text-sm font-semibold transition-opacity duration-200 ${isLoading ? 'opacity-0' : ''}`}
        style={{ color: 'var(--text-primary)' }}
      >
        {operation.label}
      </span>

      {/* Description */}
      <span
        className={`text-[10px] leading-tight text-center transition-opacity duration-200 ${isLoading ? 'opacity-0' : ''}`}
        style={{ color: 'var(--text-tertiary)' }}
      >
        {operation.description}
      </span>

      {/* KBD shortcut */}
      <kbd
        className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-all duration-200 ${isLoading ? 'opacity-0' : ''}`}
        style={{
          background: 'var(--color-surface-input)',
          border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)',
        }}
      >
        {operation.shortcut}
      </kbd>

      {/* Mini progress bar when loading */}
      {isLoading && progress !== undefined && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
          <motion.div
            className="h-full"
            style={{ background: operation.color }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          />
        </div>
      )}
    </motion.button>
  )
}