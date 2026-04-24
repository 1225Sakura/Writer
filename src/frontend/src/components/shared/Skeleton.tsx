/**
 * Skeleton loading components with optimized shimmer animation
 * Uses GPU-accelerated transforms for better performance
 */

import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  /** Shimmer animation speed: 'fast' | 'normal' | 'slow' */
  speed?: 'fast' | 'normal' | 'slow'
  /** Enable shimmer effect, disable for subtle static placeholder */
  shimmer?: boolean
}

const shimmerDurations = {
  fast: '1.2s',
  normal: '1.8s',
  slow: '2.4s',
}

export function Skeleton({
  className = '',
  width,
  height,
  speed = 'normal',
  shimmer = true,
}: SkeletonProps) {
  const duration = shimmerDurations[speed]

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)]',
        shimmer && 'animate-shimmer-skeleton',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        animationDuration: duration,
      }}
    />
  )
}

export function SkeletonText({
  lines = 3,
  className = '',
  lastLineWidth = '3/4',
}: {
  lines?: number
  className?: string
  lastLineWidth?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          className={cn(i === lines - 1 && `w-[${lastLineWidth}]`)}
          shimmer
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] p-4 space-y-3 border border-[var(--color-border-subtle)]',
        className
      )}
    >
      <Skeleton height={18} width="55%" shimmer />
      <SkeletonText lines={3} />
    </div>
  )
}

export function SkeletonAvatar({
  size = 40,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      className={cn('rounded-full', className)}
      shimmer={false}
    />
  )
}

export function SkeletonChat({ className = '' }: { className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 p-4', className)}>
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <Skeleton height={14} width="28%" shimmer />
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

export function SkeletonList({
  items = 5,
  className = '',
}: {
  items?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-raised)]"
        >
          <SkeletonAvatar size={36} />
          <div className="flex-1 space-y-1.5">
            <Skeleton height={13} width="35%" shimmer />
            <Skeleton height={11} width="55%" shimmer speed="fast" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonGraph({ className = '' }: { className?: string }) {
  return (
    <div className={cn('h-full flex items-center justify-center', className)}>
      <div className="text-center space-y-3">
        <Skeleton
          width={100}
          height={100}
          className="rounded-full mx-auto"
          shimmer={false}
        />
        <Skeleton height={12} width={70} className="mx-auto" shimmer speed="fast" />
      </div>
    </div>
  )
}
