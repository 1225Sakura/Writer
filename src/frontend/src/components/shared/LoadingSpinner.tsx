/**
 * LoadingSpinner — Multiple spinner variants with pure CSS animations
 *
 * Variants: ring, pulse, dots, wave, orbit, typing, shimmer, book, rings
 * Sizes: xs (12px), sm (16px), md (24px), lg (32px), xl (48px), 2xl (64px), 3xl (96px)
 *
 * Variant components are in SpinnerVariants.tsx.
 */

import { cn } from '@/lib/utils'
import {
  RingSpinner,
  PulseSpinner,
  DotsSpinner,
  WaveSpinner,
  OrbitSpinner,
  TypingSpinner,
  ShimmerSpinner,
  BookSpinner,
  RingsSpinner,
} from './SpinnerVariants'

export type SpinnerVariant = 'ring' | 'pulse' | 'dots' | 'wave' | 'orbit' | 'typing' | 'shimmer' | 'book' | 'rings'
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

interface LoadingSpinnerProps {
  variant?: SpinnerVariant
  size?: SpinnerSize
  color?: string
  className?: string
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  '2xl': 64,
  '3xl': 96,
}

/** Main LoadingSpinner component */
export function LoadingSpinner({
  variant = 'ring',
  size = 'md',
  color = 'var(--accent-primary)',
  className,
}: LoadingSpinnerProps) {
  const pixelSize = sizeMap[size]

  switch (variant) {
    case 'ring':
      return <RingSpinner size={pixelSize} color={color} className={className} />
    case 'pulse':
      return <PulseSpinner size={pixelSize} color={color} className={className} />
    case 'dots':
      return <DotsSpinner size={pixelSize} color={color} className={className} />
    case 'wave':
      return <WaveSpinner size={pixelSize} color={color} className={className} />
    case 'orbit':
      return <OrbitSpinner size={pixelSize} color={color} className={className} />
    case 'typing':
      return <TypingSpinner size={pixelSize} color={color} className={className} />
    case 'shimmer':
      return <ShimmerSpinner size={pixelSize} color={color} className={className} />
    case 'book':
      return <BookSpinner size={pixelSize} color={color} className={className} />
    case 'rings':
      return <RingsSpinner size={pixelSize} color={color} className={className} />
    default:
      return <RingSpinner size={pixelSize} color={color} className={className} />
  }
}

/** Inline loading indicator with text */
export function InlineLoading({
  message,
  variant = 'dots',
  size = 'sm',
  className,
}: {
  message?: string
  variant?: SpinnerVariant
  size?: SpinnerSize
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LoadingSpinner variant={variant} size={size} />
      {message && (
        <span className="text-xs text-[var(--text-tertiary)]">
          {message}
        </span>
      )}
    </div>
  )
}

/** Button loading state — spinner inside button */
export function ButtonLoading({
  message = '处理中...',
  className,
}: {
  message?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LoadingSpinner variant="ring" size="sm" color="currentColor" />
      <span>{message}</span>
    </div>
  )
}

/** Full page loading with centered spinner and message */
export function PageLoading({
  message = '加载中...',
  variant = 'rings',
  size = 'xl',
}: {
  message?: string
  variant?: SpinnerVariant
  size?: SpinnerSize
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[200px]">
      <LoadingSpinner variant={variant} size={size} />
      {message && (
        <p className="text-sm text-[var(--text-tertiary)] tracking-wide">
          {message}
        </p>
      )}
    </div>
  )
}

/** Skeleton loading with spinner overlay */
export function SkeletonLoading({
  children,
  loading,
  variant = 'shimmer',
  size = 'lg',
}: {
  children: React.ReactNode
  loading: boolean
  variant?: SpinnerVariant
  size?: SpinnerSize
}) {
  if (!loading) return <>{children}</>

  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <LoadingSpinner variant={variant} size={size} />
      </div>
    </div>
  )
}
