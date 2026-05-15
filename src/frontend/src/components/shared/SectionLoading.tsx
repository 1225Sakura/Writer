/**
 * SectionLoading - Section-level loading components
 *
 * Contains SectionLoadingOverlay (overlay-based) and
 * InlineSectionLoading (non-overlay spinner) for loading
 * within specific UI sections.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { LoadingSpinner } from './LoadingSpinner'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/** Enhanced inline loading overlay for section-level loading */
export function SectionLoadingOverlay({
  visible,
  message = '加载中...',
  variant = 'minimal',
}: {
  visible: boolean
  message?: string
  variant?: 'minimal' | 'default'
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-lg"
          style={{
            background: 'var(--color-overlay)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {variant === 'default' ? (
            <>
              <LoadingSpinner variant="rings" size="lg" />
              <span className="text-sm mt-3 tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                {message}
              </span>
            </>
          ) : (
            <>
              <LoadingSpinner variant="orbit" size="md" />
              <span className="text-sm mt-2" style={{ color: 'var(--text-tertiary)' }}>
                {message}
              </span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Inline section loading -- elegant non-overlay spinner */
export function InlineSectionLoading({
  message = '加载中...',
}: {
  message?: string
}) {
  return (
    <div className="flex flex-row items-center justify-center gap-3 py-8">
      <LoadingSpinner variant="dots" size="sm" />
      <span className="text-sm tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
        {message}
      </span>
    </div>
  )
}
