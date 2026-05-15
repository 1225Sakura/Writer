/**
 * BrandLoadingComponents - BrandLoadingScreen and SkeletonOverlay components
 *
 * Used by LoadingOverlayVariants for full-screen brand loading and skeleton screens.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Feather } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/**
 * BrandLoadingScreen - Full-screen branded loading splash
 */
export function BrandLoadingScreen({
  visible,
  message = '正在启动...',
  progress,
}: {
  visible: boolean
  message?: string
  progress?: number
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--elevation-1) 0%, var(--elevation-2) 100%)',
          }}
        >
          {/* Background glow */}
          <motion.div
            className="absolute w-96 h-96 rounded-full"
            style={{
              background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 15%, transparent) 0%, transparent 70%)',
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* Logo animation */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            className="relative mb-8"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'var(--accent-muted)',
                border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                boxShadow: '0 0 40px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              >
                <Feather style={{ width: 40, height: 40, color: 'var(--accent-primary)' }} />
              </motion.div>
            </div>
          </motion.div>

          {/* Brand name */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            className="text-xl font-semibold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            自动化写作软件
          </motion.h1>

          {/* Loading message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm mb-6"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {message}
          </motion.p>

          {/* Progress bar */}
          {progress !== undefined && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 240 }}
              transition={{ delay: 0.4 }}
              className="w-60"
            >
              <div
                className="h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-surface-overlay)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
                />
              </div>
              <div className="flex justify-end mt-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </motion.div>
          )}

          {/* Loading dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex gap-1.5 mt-6"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--accent-primary)' }}
                animate={{
                  opacity: [0.2, 1, 0.2],
                  scale: [0.8, 1.3, 0.8],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * SkeletonOverlay - Skeleton loading placeholder
 */
export function SkeletonOverlay({
  message = '加载中...',
  variant = 'text',
}: {
  message?: string
  variant?: 'text' | 'card' | 'detail'
}) {
  const shimmerStyle = {
    background: 'linear-gradient(90deg, var(--color-surface-overlay) 25%, var(--color-surface-hover) 50%, var(--color-surface-overlay) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer-skeleton 1.5s ease-in-out infinite',
  }

  const content = {
    text: (
      <div className="w-full space-y-3 max-w-xs">
        <div className="h-4 rounded-md w-3/4" style={shimmerStyle} />
        <div className="h-3 rounded-md w-full" style={shimmerStyle} />
        <div className="h-3 rounded-md w-5/6" style={shimmerStyle} />
        <div className="h-3 rounded-md w-4/5" style={shimmerStyle} />
      </div>
    ),
    card: (
      <div className="grid gap-4 w-full max-w-sm">
        <div className="h-32 rounded-xl" style={shimmerStyle} />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-lg" style={shimmerStyle} />
          <div className="h-20 rounded-lg" style={shimmerStyle} />
          <div className="h-20 rounded-lg" style={shimmerStyle} />
        </div>
      </div>
    ),
    detail: (
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full" style={shimmerStyle} />
          <div className="flex-1 space-y-2">
            <div className="h-4 rounded-md w-1/3" style={shimmerStyle} />
            <div className="h-3 rounded-md w-1/2" style={shimmerStyle} />
          </div>
        </div>
        <div className="h-40 rounded-lg" style={shimmerStyle} />
        <div className="space-y-2">
          <div className="h-3 rounded-md w-full" style={shimmerStyle} />
          <div className="h-3 rounded-md w-5/6" style={shimmerStyle} />
          <div className="h-3 rounded-md w-4/5" style={shimmerStyle} />
        </div>
      </div>
    ),
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {content[variant]}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xs"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {message}
      </motion.p>
    </div>
  )
}
