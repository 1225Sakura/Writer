/**
 * LoadingOverlay — Full-screen or localized loading overlay with brand animation
 * Uses Framer Motion for smooth entrance/exit animations
 *
 * Variants:
 *   default  — Feather icon with pulse rings and glow
 *   minimal  — Simple spinner only
 *   branded  — Full brand animation with progress
 *   skeleton — Skeleton placeholder with overlay
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Feather, BookOpen } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'
import { cn } from '@/lib/utils'

export type OverlayVariant = 'default' | 'minimal' | 'branded' | 'skeleton'

export type OverlaySize = 'fullscreen' | 'floating' | 'inline' | 'toolbar'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
  fullscreen?: boolean
  size?: OverlaySize
  className?: string
  variant?: OverlayVariant
  /** 进度 0-100 */
  progress?: number
  /** 是否显示取消按钮 */
  showCancel?: boolean
  onCancel?: () => void
}

const sizeStyles: Record<OverlaySize, { container: string; blur: string; bgOpacity: string }> = {
  fullscreen: {
    container: 'fixed inset-0 z-[100]',
    blur: 'blur(20px)',
    bgOpacity: 'rgba(10, 11, 14, 0.88)',
  },
  floating: {
    container: 'absolute inset-0 z-50 rounded-xl',
    blur: 'blur(12px)',
    bgOpacity: 'rgba(10, 11, 14, 0.75)',
  },
  inline: {
    container: 'absolute inset-0 z-40 rounded-lg',
    blur: 'blur(8px)',
    bgOpacity: 'rgba(10, 11, 14, 0.65)',
  },
  toolbar: {
    container: 'absolute inset-0 rounded-md',
    blur: 'blur(4px)',
    bgOpacity: 'rgba(10, 11, 14, 0.5)',
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

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
          {/* Radial gradient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(94, 106, 210, 0.08) 0%, transparent 70%)',
            }}
          />

          {variant === 'default' && <DefaultOverlay message={message} progress={progress} />}
          {variant === 'minimal' && <MinimalOverlay message={message} size={fullscreen ? 'lg' : 'md'} />}
          {variant === 'branded' && <BrandedOverlay message={message} progress={progress} />}
          {variant === 'skeleton' && <SkeletonOverlay message={message} />}

          {showCancel && onCancel && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.2 }}
              onClick={onCancel}
              className="mt-8 px-5 py-2.5 text-sm rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
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

/** Default overlay — feather icon with enhanced glow rings */
function DefaultOverlay({
  message,
  progress,
}: {
  message: string
  progress?: number
}) {
  return (
    <>
      {/* Outer glow ring */}
      <div
        className="absolute w-24 h-24 rounded-full animate-pulse-ring motion-reduce:animate-none"
        style={{
          backgroundColor: 'rgba(94, 106, 210, 0.12)',
          boxShadow: '0 0 40px rgba(94, 106, 210, 0.15)',
        }}
      />
      {/* Middle glow ring */}
      <div
        className="absolute w-20 h-20 rounded-full animate-pulse-ring motion-reduce:animate-none"
        style={{
          backgroundColor: 'rgba(94, 106, 210, 0.18)',
          animationDelay: '0.4s',
          boxShadow: '0 0 30px rgba(94, 106, 210, 0.2)',
        }}
      />

      <div className="relative flex items-center justify-center mb-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="relative z-10"
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(94, 106, 210, 0.12)',
              border: '1.5px solid rgba(94, 106, 210, 0.35)',
              boxShadow: '0 0 20px rgba(94, 106, 210, 0.25), inset 0 0 15px rgba(94, 106, 210, 0.1)',
            }}
          >
            <Feather className="w-7 h-7" style={{ color: 'var(--accent-primary)' }} />
          </div>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="text-sm font-medium tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        {message}
      </motion.p>

      {progress !== undefined && <ProgressBar progress={progress} />}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex gap-2 mt-4"
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

/** Minimal overlay — clean spinner with subtle animation */
function MinimalOverlay({ message, size = 'lg' }: { message: string; size?: 'md' | 'lg' }) {
  const spinnerSize = size === 'lg' ? 'lg' : 'md'
  return (
    <div className="flex flex-row items-center gap-3">
      <LoadingSpinner variant="orbit" size={spinnerSize} />
      <motion.p
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.25 }}
        className="text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        {message}
      </motion.p>
    </div>
  )
}

/** Branded overlay — elegant brand animation with book icon */
function BrandedOverlay({
  message,
  progress,
}: {
  message: string
  progress?: number
}) {
  return (
    <>
      {/* Background glow */}
      <div
        className="absolute w-40 h-40 rounded-full animate-pulse-ring motion-reduce:animate-none"
        style={{
          background: 'radial-gradient(circle, rgba(94, 106, 210, 0.12) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex items-center justify-center mb-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(94, 106, 210, 0.1)',
            border: '1.5px solid rgba(94, 106, 210, 0.3)',
            boxShadow: '0 0 30px rgba(94, 106, 210, 0.2)',
          }}
        >
          <BookOpen className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="text-base font-medium tracking-wide"
        style={{ color: 'var(--text-secondary)' }}
      >
        {message}
      </motion.p>

      {progress !== undefined && <ProgressBar progress={progress} />}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-xs mt-3 tracking-widest"
        style={{ color: 'var(--text-tertiary)' }}
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

/** Progress bar with gradient fill */
function ProgressBar({ progress }: { progress: number }) {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className="w-56 mt-5">
      <div className="flex justify-between text-xs mb-2">
        <span style={{ color: 'var(--text-tertiary)' }}>进度</span>
        <span style={{ color: 'var(--accent-primary)' }}>{Math.round(clampedProgress)}%</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary), rgba(94, 106, 210, 0.7))',
            boxShadow: '0 0 10px rgba(94, 106, 210, 0.4)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  )
}

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
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-lg"
          style={{
            background: 'rgba(10, 11, 14, 0.7)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {variant === 'default' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Feather className="w-6 h-6" style={{ color: 'var(--accent-primary)' }} />
              </motion.div>
              <span className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
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

/** Inline section loading — elegant non-overlay spinner */
export function InlineSectionLoading({
  message = '加载中...',
}: {
  message?: string
}) {
  return (
    <div className="flex flex-row items-center justify-center gap-3 py-8">
      <LoadingSpinner variant="dots" size="sm" />
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {message}
      </span>
    </div>
  )
}
