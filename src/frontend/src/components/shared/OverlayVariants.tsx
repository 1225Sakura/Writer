/**
 * OverlayVariants - Loading overlay variant components
 *
 * Contains DefaultOverlay, MinimalOverlay, BrandedOverlay, SkeletonOverlay,
 * and ProgressBar sub-components used by LoadingOverlay.
 */

import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { LoadingSpinner } from './LoadingSpinner'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { OverlaySize } from './LoadingOverlay'

export interface MessageStyle {
  text: string
  subtext: string
  tracking: string
}

/** Typography scale for loading messages */
export const messageStyles: Record<OverlaySize, MessageStyle> = {
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

/** Default overlay -- multi-layer gradient rotating rings with enhanced glow */
export function DefaultOverlay({
  message,
  progress,
  msgStyle,
  size,
}: {
  message: string
  progress?: number
  msgStyle: MessageStyle
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
          background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 8%, transparent) 0%, transparent 70%)',
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

/** Minimal overlay -- clean spinner with subtle animation */
export function MinimalOverlay({
  message,
  size = 'lg',
  msgStyle,
}: {
  message: string
  size?: 'md' | 'lg'
  msgStyle: MessageStyle
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

/** Branded overlay -- elegant brand animation with book icon */
export function BrandedOverlay({
  message,
  progress,
  msgStyle,
}: {
  message: string
  progress?: number
  msgStyle: MessageStyle
}) {
  return (
    <>
      {/* Background glow */}
      <motion.div
        className="absolute w-48 h-48 rounded-full motion-reduce:hidden"
        style={{
          background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 10%, transparent) 0%, transparent 70%)',
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
            backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
            border: '1.5px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)',
            boxShadow: '0 0 40px color-mix(in srgb, var(--accent-primary) 20%, transparent), inset 0 0 20px color-mix(in srgb, var(--accent-primary) 5%, transparent)',
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

/** Skeleton overlay -- shows skeleton placeholder */
export function SkeletonOverlay({
  message,
  msgStyle,
}: {
  message: string
  msgStyle: MessageStyle
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
export function ProgressBar({ progress }: { progress: number }) {
  const clampedProgress = Math.max(0, Math.min(100, progress))

  return (
    <div className="w-56 mt-5">
      <div className="flex justify-between text-xs mb-2">
        <span style={{ color: 'var(--text-tertiary)' }}>进度</span>
        <span style={{ color: 'var(--accent-primary)' }}>{Math.round(clampedProgress)}%</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'color-mix(in srgb, white 6%, transparent)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 70%, transparent))',
            boxShadow: '0 0 10px color-mix(in srgb, var(--accent-primary) 40%, transparent)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        />
      </div>
    </div>
  )
}
