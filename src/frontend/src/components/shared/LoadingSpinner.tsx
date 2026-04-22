/**
 * LoadingSpinner — Multiple spinner variants with pure CSS animations
 *
 * Variants:
 *   ring      — Rotating ring (circular border animation)
 *   pulse     — Pulsing circle (scale + opacity)
 *   dots      — Three bouncing dots
 *   wave      — Wave bars animation
 *   orbit     — Orbiting dots
 *   typing    — Typing indicator dots
 *   shimmer   — Shimmer sweep effect
 *   book      — Book page flip (writing themed)
 *
 * Sizes: xs (12px), sm (16px), md (24px), lg (32px), xl (48px), 2xl (64px)
 */

import { cn } from '@/lib/utils'

export type SpinnerVariant = 'ring' | 'pulse' | 'dots' | 'wave' | 'orbit' | 'typing' | 'shimmer' | 'book'
export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

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

/** Wave spinner — vertical bars with wave animation */
function WaveSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  const barWidth = Math.max(3, size / 8)
  const barHeight = size
  return (
    <div className={cn('flex items-center gap-[3px]', className)} style={{ height: size }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="inline-block rounded-full"
          style={{
            width: barWidth,
            height: barHeight * 0.6,
            backgroundColor: color,
            animation: `wave-bar 1.2s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

/** Orbit spinner — dots orbiting a center point */
function OrbitSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  const dotSize = Math.max(3, size / 10)
  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            animation: `orbit-spin ${1.5 + i * 0.2}s linear infinite`,
            animationDelay: `${i * 0.3}s`,
          }}
        >
          <span
            className="absolute rounded-full"
            style={{
              width: dotSize,
              height: dotSize,
              backgroundColor: color,
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              opacity: 1 - i * 0.2,
            }}
          />
        </div>
      ))}
    </div>
  )
}

/** Typing spinner — chat-style typing indicator */
function TypingSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  const dotSize = Math.max(3, size / 5)
  return (
    <div className={cn('flex items-center gap-[3px]', className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block rounded-full animate-typing-dot-bounce"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}

/** Shimmer spinner — sweeping light effect */
function ShimmerSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: `${color}15`,
          border: `2px solid ${color}30`,
        }}
      />
      <div
        className="absolute inset-0 rounded-full animate-shimmer"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}40, transparent)`,
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  )
}

/** Book spinner — writing-themed page flip */
function BookSpinner({
  size,
  color,
  className,
}: {
  size: number
  color: string
  className?: string
}) {
  const pageWidth = size * 0.35
  const pageHeight = size * 0.8
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      {/* Book spine */}
      <div
        className="absolute rounded-full"
        style={{
          width: 2,
          height: pageHeight,
          backgroundColor: `${color}60`,
        }}
      />
      {/* Left page */}
      <div
        className="absolute"
        style={{
          width: pageWidth,
          height: pageHeight,
          right: '50%',
          backgroundColor: `${color}10`,
          border: `1px solid ${color}30`,
          borderRight: 'none',
          borderRadius: '2px 0 0 2px',
          animation: 'book-page-left 1.5s ease-in-out infinite',
        }}
      />
      {/* Right page */}
      <div
        className="absolute"
        style={{
          width: pageWidth,
          height: pageHeight,
          left: '50%',
          backgroundColor: `${color}10`,
          border: `1px solid ${color}30`,
          borderLeft: 'none',
          borderRadius: '0 2px 2px 0',
          animation: 'book-page-right 1.5s ease-in-out infinite',
        }}
      />
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

/** Full page loading with centered spinner and message */
export function PageLoading({
  message = '加载中...',
  variant = 'ring',
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
        <p className="text-sm" style={{ color: '#8a8f98' }}>
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
