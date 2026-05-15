/**
 * SkeletonPrimitives - Base shimmer utilities and simple skeleton variants
 *
 * Provides ShimmerTone type, getShimmerGradient, ShimmerBlock base component,
 * and basic skeleton variants: Text, Card, Avatar, Chart, Button, Image.
 */

import { cn } from '@/lib/utils'

export type ShimmerTone = 'neutral' | 'warm' | 'cool' | 'accent'

/** Generate shimmer gradient based on tone (uses design tokens) */
export function getShimmerGradient(tone: ShimmerTone): string {
  switch (tone) {
    case 'warm':
      return `linear-gradient(90deg, transparent, var(--shimmer-warm), transparent)`
    case 'cool':
      return `linear-gradient(90deg, transparent, var(--shimmer-cool), transparent)`
    case 'accent':
      return `linear-gradient(90deg, transparent, var(--shimmer-accent), transparent)`
    case 'neutral':
    default:
      return `linear-gradient(90deg, transparent, var(--shimmer-neutral), transparent)`
  }
}

/** Base shimmer skeleton block with context-adaptive gradient */
export function ShimmerBlock({
  className,
  width,
  height,
  rounded = true,
  tone = 'neutral',
}: {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
  tone?: ShimmerTone
}) {
  return (
    <div
      className={cn(
        'animate-shimmer-skeleton',
        rounded && 'rounded-[var(--radius-md)]',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        backgroundImage: getShimmerGradient(tone),
      }}
    />
  )
}

/** Text variant -- multiple lines with staggered widths */
export function TextSkeleton({ lines = 3, className, tone }: { lines?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock
          key={i}
          height={16}
          tone={tone}
          className={cn(
            i === lines - 1 ? 'w-3/4' : 'w-full',
            'rounded-[var(--radius-md)]'
          )}
        />
      ))}
    </div>
  )
}

/** Card variant -- card with header and body */
export function CardSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] p-4 space-y-3 border',
        className
      )}
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        borderColor: 'var(--border-default)',
      }}
    >
      <ShimmerBlock height={20} width="60%" tone={tone} />
      <TextSkeleton lines={3} tone={tone} />
    </div>
  )
}

/** Avatar variant -- circular or rounded avatar */
export function AvatarSkeleton({ size = 40, className, tone }: { size?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <ShimmerBlock
      width={size}
      height={size}
      tone={tone}
      className={cn('rounded-full', className)}
    />
  )
}

/** Chart variant -- for graph/stats area loading */
export function ChartSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] p-4 border space-y-4',
        className
      )}
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        borderColor: 'var(--border-default)',
      }}
    >
      <ShimmerBlock height={16} width="40%" tone={tone} />
      <div className="flex items-end gap-2 h-32">
        {Array.from({ length: 8 }).map((_, i) => (
          <ShimmerBlock
            key={i}
            className="flex-1 rounded-t-md"
            height={`${30 + ((i * 7) % 60)}%`}
            tone={tone}
          />
        ))}
      </div>
    </div>
  )
}

/** Button variant */
export function ButtonSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return (
    <ShimmerBlock
      height={36}
      width={100}
      tone={tone}
      className={cn('rounded-[var(--radius-md)]', className)}
    />
  )
}

/** Image variant */
export function ImageSkeleton({ className, aspectRatio = '16/9', tone }: { className?: string; aspectRatio?: string; tone?: ShimmerTone }) {
  return (
    <div
      className={cn('rounded-[var(--radius-lg)] overflow-hidden', className)}
      style={{ aspectRatio }}
    >
      <ShimmerBlock height="100%" width="100%" tone={tone} className="rounded-none" />
    </div>
  )
}
