/**
 * LoadingSpinner — Multiple spinner variants with pure CSS animations
 *
 * Variants:
 *   ring   — Rotating ring (circular border animation)
 *   pulse  — Pulsing circle (scale + opacity)
 *   dots   — Three bouncing dots
 *
 * Sizes: sm (16px), md (24px), lg (32px), xl (48px)
 */

import { cn } from '@/lib/utils'

type SpinnerVariant = 'ring' | 'pulse' | 'dots'
type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

interface LoadingSpinnerProps {
  variant?: SpinnerVariant
  size?: SpinnerSize
  color?: string
  className?: string
}

const sizeMap: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
}

/** Ring spinner — rotating circular border */
function RingSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  const borderWidth = Math.max(2, size / 8)
  return (
    <div
      className={cn('animate-spin', className)}
      style={{
        width: size,
        height: size,
        border: `${borderWidth}px solid ${color}20`,
        borderTopColor: color,
        borderRadius: '50%',
      }}
    />
  )
}

/** Pulse spinner — expanding and fading circle */
function PulseSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full animate-pulse-ring"
        style={{ backgroundColor: `${color}30` }}
      />
      <div
        className="absolute inset-0 rounded-full animate-pulse-ring"
        style={{
          backgroundColor: `${color}20`,
          animationDelay: '0.5s',
        }}
      />
      <div
        className="absolute inset-0 m-auto rounded-full"
        style={{
          width: size * 0.4,
          height: size * 0.4,
          backgroundColor: color,
        }}
      />
    </div>
  )
}

/** Dots spinner — three bouncing dots */
function DotsSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  const dotSize = Math.max(4, size / 4)
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            'inline-block rounded-full',
            i === 0 && 'animate-dot-bounce',
            i === 1 && 'animate-dot-bounce-delay-1',
            i === 2 && 'animate-dot-bounce-delay-2'
          )}
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  )
}

/** Main LoadingSpinner component */
export function LoadingSpinner({
  variant = 'ring',
  size = 'md',
  color = '#5e6ad2',
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
        <span className="text-xs" style={{ color: '#8a8f98' }}>
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
