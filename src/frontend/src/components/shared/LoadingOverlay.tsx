/**
 * LoadingOverlay - Full-screen or localized loading overlay with brand animation
 * Uses Framer Motion for smooth entrance/exit animations
 *
 * Sub-components are split into:
 *   - OverlayVariants.tsx — DefaultOverlay, MinimalOverlay, BrandedOverlay, SkeletonOverlay, ProgressBar
 *   - SectionLoading.tsx  — SectionLoadingOverlay, InlineSectionLoading
 */

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { DefaultOverlay, MinimalOverlay, BrandedOverlay, SkeletonOverlay, messageStyles } from './OverlayVariants'

// Re-export sub-components for backward compatibility
export { SectionLoadingOverlay, InlineSectionLoading } from './SectionLoading'
export { DefaultOverlay, MinimalOverlay, BrandedOverlay, SkeletonOverlay, ProgressBar } from './OverlayVariants'
export type { MessageStyle } from './OverlayVariants'

export type OverlayVariant = 'default' | 'minimal' | 'branded' | 'skeleton'
export type OverlaySize = 'fullscreen' | 'floating' | 'inline' | 'toolbar'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
  fullscreen?: boolean
  size?: OverlaySize
  className?: string
  variant?: OverlayVariant
  /** Progress 0-100 */
  progress?: number
  /** Whether to show cancel button */
  showCancel?: boolean
  onCancel?: () => void
}

const sizeStyles: Record<OverlaySize, { container: string; blur: string; bgOpacity: string }> = {
  fullscreen: {
    container: 'fixed inset-0 z-[100]',
    blur: 'blur(24px)',
    bgOpacity: 'rgba(10, 11, 14, 0.92)',
  },
  floating: {
    container: 'absolute inset-0 z-50 rounded-xl',
    blur: 'blur(16px)',
    bgOpacity: 'rgba(10, 11, 14, 0.80)',
  },
  inline: {
    container: 'absolute inset-0 z-40 rounded-lg',
    blur: 'blur(12px)',
    bgOpacity: 'rgba(10, 11, 14, 0.70)',
  },
  toolbar: {
    container: 'absolute inset-0 rounded-md',
    blur: 'blur(6px)',
    bgOpacity: 'rgba(10, 11, 14, 0.55)',
  },
}

export function LoadingOverlay({
  visible,
  message = '加载中...',
  fullscreen = true,
  size = 'fullscreen',
  className,
  variant = 'default',
  progress,
  showCancel,
  onCancel,
}: LoadingOverlayProps) {
  const sizeStyle = fullscreen ? sizeStyles.fullscreen : (size === 'toolbar' ? sizeStyles.toolbar : sizeStyles.floating)
  const msgStyle = fullscreen ? messageStyles.fullscreen : messageStyles[size]

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          className={cn(
            sizeStyle.container,
            'flex flex-col items-center justify-center',
            className
          )}
          style={{
            background: sizeStyle.bgOpacity,
            backdropFilter: sizeStyle.blur,
            WebkitBackdropFilter: sizeStyle.blur,
          }}
        >
          {/* Multi-layer radial gradient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                radial-gradient(circle at 30% 40%, color-mix(in srgb, var(--accent-primary) 6%, transparent) 0%, transparent 50%),
                radial-gradient(circle at 70% 60%, color-mix(in srgb, var(--vermillion-100) 4%, transparent) 0%, transparent 50%)
              `,
            }}
          />

          {variant === 'default' && <DefaultOverlay message={message} progress={progress} msgStyle={msgStyle} size={size} />}
          {variant === 'minimal' && <MinimalOverlay message={message} size={fullscreen ? 'lg' : 'md'} msgStyle={msgStyle} />}
          {variant === 'branded' && <BrandedOverlay message={message} progress={progress} msgStyle={msgStyle} />}
          {variant === 'skeleton' && <SkeletonOverlay message={message} msgStyle={msgStyle} />}

          {showCancel && onCancel && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: DURATION.FAST, ease: EASE.SMOOTH }}
              onClick={onCancel}
              className="mt-8 px-5 py-2.5 text-sm rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'color-mix(in srgb, white 3%, transparent)',
                backdropFilter: 'blur(8px)',
              }}
            >
              取消
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
