/**
 * LoadingOverlay — Full-screen or localized loading overlay with brand animation
 * Uses Framer Motion for smooth entrance/exit animations
 *
 * Variants:
 *   default  — Feather icon with pulse rings
 *   minimal  — Simple spinner only
 *   branded  — Full brand animation with progress
 *   skeleton — Skeleton placeholder with overlay
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Feather, BookOpen } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'
import { cn } from '@/lib/utils'

export type OverlayVariant = 'default' | 'minimal' | 'branded' | 'skeleton'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
  fullscreen?: boolean
  className?: string
  variant?: OverlayVariant
  /** 进度 0-100 */
  progress?: number
  /** 是否显示取消按钮 */
  showCancel?: boolean
  onCancel?: () => void
}

export function LoadingOverlay({
  visible,
  message = '加载中...',
  fullscreen = true,
  className,
  variant = 'default',
  progress,
  showCancel,
  onCancel,
}: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            fullscreen
              ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center'
              : 'absolute inset-0 z-50 flex flex-col items-center justify-center rounded-lg',
            className
          )}
          style={{
            backgroundColor: fullscreen
              ? 'rgba(8, 9, 10, 0.85)'
              : 'rgba(8, 9, 10, 0.7)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        >
          {variant === 'default' && <DefaultOverlay message={message} progress={progress} />}
          {variant === 'minimal' && <MinimalOverlay message={message} />}
          {variant === 'branded' && <BrandedOverlay message={message} progress={progress} />}
          {variant === 'skeleton' && <SkeletonOverlay message={message} />}

          {showCancel && onCancel && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              onClick={onCancel}
              className="mt-6 px-4 py-2 text-xs rounded-md border transition-colors hover:bg-white/5"
              style={{
                color: 'var(--text-tertiary)',
                borderColor: 'var(--border-default)',
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

/** Default overlay — feather icon with pulse rings */
function DefaultOverlay({
  message,
  progress,
}: {
  message: string
  progress?: number
}) {
  return (
    <>
      <div className="relative flex items-center justify-center mb-6">
        <div
          className="absolute w-16 h-16 rounded-full animate-pulse-ring motion-reduce:animate-none"
          style={{ backgroundColor: 'rgba(94, 106, 210, 0.2)' }}
        />
        <div
          className="absolute w-16 h-16 rounded-full animate-pulse-ring motion-reduce:animate-none"
          style={{
            backgroundColor: 'rgba(94, 106, 210, 0.15)',
            animationDelay: '0.5s',
          }}
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="relative z-10"
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(94, 106, 210, 0.15)',
              border: '1px solid rgba(94, 106, 210, 0.3)',
            }}
          >
            <Feather className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
          </div>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.2 }}
        className="text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {message}
      </motion.p>

      {progress !== undefined && <ProgressBar progress={progress} />}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-1.5 mt-3"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--accent-primary)' }}
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
    </>
  )
}

/** Minimal overlay — simple spinner only */
function MinimalOverlay({ message }: { message: string }) {
  return (
    <div className="flex flex-row items-center gap-3">
      <LoadingSpinner variant="ring" size="lg" />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-xs"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {message}
      </motion.p>
    </div>
  )
}

/** Branded overlay — simplified brand animation with book icon */
function BrandedOverlay({
  message,
  progress,
}: {
  message: string
  progress?: number
}) {
  return (
    <>
      <div className="relative flex items-center justify-center mb-8">
        {/* Single rotating ring with icon */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="relative z-10 w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--accent-muted)',
            border: '1px solid var(--accent-primary)',
          }}
        >
          <BookOpen className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-base font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {message}
      </motion.p>

      {progress !== undefined && <ProgressBar progress={progress} />}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-xs mt-2"
        style={{ color: 'var(--text-disabled)' }}
      >
        自动化写作软件
      </motion.p>
    </>
  )
}

/** Skeleton overlay — shows skeleton placeholder */
function SkeletonOverlay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xs">
      <div className="w-full space-y-3">
        <div className="h-4 rounded-md animate-shimmer motion-reduce:animate-none w-3/4 mx-auto" />
        <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-full" />
        <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-5/6" />
        <div className="h-3 rounded-md animate-shimmer motion-reduce:animate-none w-4/5" />
      </div>
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

/** Progress bar component */
function ProgressBar({ progress }: { progress: number }) {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className="w-48 mt-4">
      <div className="flex justify-between text-xs mb-1.5">
        <span style={{ color: 'var(--text-tertiary)' }}>进度</span>
        <span style={{ color: 'var(--text-secondary)' }}>{Math.round(clampedProgress)}%</span>
      </div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: 'var(--accent-primary)' }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

/** Simplified inline loading overlay for section-level loading */
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
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-lg"
          style={{
            backgroundColor: 'rgba(8, 9, 10, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {variant === 'default' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Feather className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              </motion.div>
              <span className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                {message}
              </span>
            </>
          ) : (
            <LoadingSpinner variant="ring" size="md" />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Inline section loading — non-overlay, inline spinner */
export function InlineSectionLoading({
  message = '加载中...',
}: {
  message?: string
}) {
  return (
    <div className="flex flex-row items-center justify-center gap-2 py-8">
      <LoadingSpinner variant="dots" size="sm" />
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {message}
      </span>
    </div>
  )
}
