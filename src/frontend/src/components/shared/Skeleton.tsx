/**
 * Skeleton loading components for improved perceived performance
 */

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
}

export function Skeleton({ className = '', width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-[rgba(255,255,255,0.04)] via-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.04)] bg-[length:200%_100%] ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          className={`${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[var(--color-bg-surface)] rounded-lg p-4 space-y-3 ${className}`}>
      <Skeleton height={20} width="60%" />
      <SkeletonText lines={3} />
    </div>
  )
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <Skeleton
      width={size}
      height={size}
      className="rounded-full"
    />
  )
}

export function SkeletonChat() {
  return (
    <div className="flex items-start gap-3 p-4">
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <Skeleton height={16} width="30%" />
        <SkeletonText lines={2} />
      </div>
    </div>
  )
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <SkeletonAvatar size={32} />
          <div className="flex-1 space-y-1">
            <Skeleton height={14} width="40%" />
            <Skeleton height={12} width="60%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonGraph() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-2">
        <Skeleton width={120} height={120} className="rounded-full mx-auto" />
        <Skeleton height={14} width={80} className="mx-auto" />
      </div>
    </div>
  )
}
