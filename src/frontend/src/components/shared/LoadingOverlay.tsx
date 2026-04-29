/**
 * LoadingOverlay — Full-screen or localized loading overlay with brand animation
 * Uses Framer Motion for smooth entrance/exit animations
 *
 * Variants:
 *   default  — Multi-layer rotating rings with gradient glow
 *   minimal  — Simple spinner only
 *   branded  — Full brand animation with progress
 *   skeleton — Skeleton placeholder with overlay
 */

import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


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

/** Typography scale for loading messages */
const messageStyles: Record<OverlaySize, { text: string; subtext: string; tracking: string }> = {
  fullscreen: {
    text: 'text-base font-medium',
    subtext: 'text-sm',
    tracking: 'tracking-wide',
  },
  floating: {
    text: 'text-sm font-medium',
    subtext: 'text-xs',
    tracking: 'tracking-wide',
  },
  inline: {
    text: 'text-sm font-medium',
    subtext: 'text-xs',
    tracking: 'tracking-normal',
  },
  toolbar: {
    text: 'text-xs font-medium',
    subtext: 'text-[10px]',
    tracking: 'tracking-normal',
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
                radial-gradient(circle at 30% 40%, rgba(94, 106, 210, 0.06) 0%, transparent 50%),
                radial-gradient(circle at 70% 60%, rgba(196, 92, 92, 0.04) 0%, transparent 50%)
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

/** Default overlay — multi-layer gradient rotating rings with enhanced glow */
function DefaultOverlay({
  message,
  progress,
  msgStyle,
  size,
}: {
  message: string
  progress?: number
  msgStyle: { text: string; subtext: string; tracking: string }
  size: OverlaySize
}) {
  const isLarge = size === 'fullscreen' || size === 'floating'

  return (
    <>
      {/* Outer glow ring */}
      <motion.div
        className="absolute rounded-full motion-reduce:hidden"
        style={{
          width: isLarge ? 160 : 100,
          height: isLarge ? 160 : 100,
          background: 'radial-gradient(circle, rgba(94, 106, 210, 0.08) 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Multi-layer rotating rings spinner */}
      <div className="relative flex items-center justify-center mb-6">
        <LoadingSpinner
          variant="rings"
          size={isLarge ? '2xl' : 'xl'}
          color="var(--accent-primary)"
        />
      </div>

      {/* Elegant loading message */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={cn(msgStyle.text, msgStyle.tracking)}
        style={{ color: 'var(--text-secondary)' }}
      >
        {message}
      </motion.p>

      {progress !== undefined && <ProgressBar progress={progress} />}

      {/* Animated dots indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
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
function MinimalOverlay({
  message,
  size = 'lg',
  msgStyle,
}: {
  message: string
  size?: 'md' | 'lg'
  msgStyle: { text: string; subtext: string; tracking: string }
}) {
  const spinnerSize = size === 'lg' ? 'lg' : 'md'
  return (
    <div className="flex flex-row items-center gap-3">
      <LoadingSpinner variant="orbit" size={spinnerSize} />
      <motion.p
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.25 }}
        className={cn(msgStyle.text, msgStyle.tracking)}
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
  msgStyle,
}: {
  message: string
  progress?: number
  msgStyle: { text: string; subtext: string; tracking: string }
}) {
  return (
    <>
      {/* Background glow */}
      <motion.div
        className="absolute w-48 h-48 rounded-full motion-reduce:hidden"
        style={{
          background: 'radial-gradient(circle, rgba(94, 106, 210, 0.1) 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex items-center justify-center mb-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            backgroundColor: 'rgba(94, 106, 210, 0.1)',
            border: '1.5px solid rgba(94, 106, 210, 0.3)',
            boxShadow: '0 0 40px rgba(94, 106, 210, 0.2), inset 0 0 20px rgba(94, 106, 210, 0.05)',
          }}
        >
          <BookOpen className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        className={cn('text-base font-medium', msgStyle.tracking)}
        style={{ color: 'var(--text-secondary)' }}
      >
        {message}
      </motion.p>

      {progress !== undefined && <ProgressBar progress={progress} />}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className={cn('mt-3 tracking-widest', msgStyle.subtext)}
        style={{ color: 'var(--text-tertiary)' }}
      >
        自动化写作软件
      </motion.p>
    </>
  )
}

/** Skeleton overlay — shows skeleton placeholder */
function SkeletonOverlay({
  message,
  msgStyle,
}: {
  message: string
  msgStyle: { text: string; subtext: string; tracking: string }
}) {
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
        className={cn(msgStyle.subtext, msgStyle.tracking)}
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
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
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
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-lg"
          style={{
            background: 'rgba(10, 11, 14, 0.75)',
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

/** Inline section loading — elegant non-overlay spinner */
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
