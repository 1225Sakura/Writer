/**
 * LoadingOverlayVariants - LoadingOverlay variant components
 *
 * Provides multiple loading state styles: brand animation, progress indicator, skeleton screens.
 * Spinner components are in IconSpinners.tsx.
 * Brand loading and skeleton are in BrandLoadingComponents.tsx.
 */

import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { spinners } from './IconSpinners'
import type { LoadingVariant } from './IconSpinners'

// Re-export sub-components for consumers
export { BrandLoadingScreen, SkeletonOverlay } from './BrandLoadingComponents'
export type { LoadingVariant }

interface LoadingOverlayVariantProps {
  message?: string
  progress?: number
  variant?: LoadingVariant
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

/**
 * LoadingOverlayVariant - Full loading overlay with spinner, message, and progress
 */
export function LoadingOverlayVariant({
  message = '加载中...',
  progress,
  variant = 'feather',
  size = 'md',
  color = 'var(--accent-primary)',
}: LoadingOverlayVariantProps) {
  const Spinner = spinners[variant]

  return (
    <div className="flex flex-col items-center justify-center">
      <Spinner size={size} color={color} />

      {message && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: DURATION.FAST, ease: EASE.SMOOTH }}
          className="mt-4 text-sm font-medium"
          style={{ color: 'var(--text-secondary)' }}
        >
          {message}
        </motion.p>
      )}

      {progress !== undefined && (
        <div className="w-48 mt-4">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--color-surface-overlay)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            />
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-1.5 mt-4"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

/**
 * InlineLoadingVariant - Compact inline loading indicator
 */
export function InlineLoadingVariant({
  message = '加载中...',
  variant = 'bars',
  size = 'sm',
}: {
  message?: string
  variant?: LoadingVariant
  size?: 'sm' | 'md'
}) {
  const Spinner = spinners[variant]
  const iconSize = size === 'sm' ? 'sm' : 'md'

  return (
    <div className="inline-flex items-center gap-2">
      <Spinner size={iconSize} />
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {message}
      </span>
    </div>
  )
}
