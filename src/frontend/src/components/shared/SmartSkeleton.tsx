/**
 * SmartSkeleton — Enhanced skeleton loading component with shimmer animation
 * Based on shadcn/ui Skeleton with CSS shimmer sweep effect
 *
 * Features:
 *   - Shimmer sweep animation
 *   - Content cross-fade transition
 *   - Multiple preset variants
 *   - Pulse fallback for reduced motion
 *
 * Variants:
 *   text    — Text lines skeleton (for paragraphs, messages)
 *   card    — Card skeleton (for entity cards, panels)
 *   avatar  — Avatar skeleton (for user/AI avatars, profile images)
 *   chart   — Chart/area skeleton (for relation graphs, stats)
 *   button  — Button skeleton
 *   image   — Image skeleton
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface SmartSkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'chart' | 'button' | 'image'
  className?: string
  lines?: number
  width?: string | number
  height?: string | number
}

/** Base shimmer skeleton block */
function ShimmerBlock({
  className,
  width,
  height,
  rounded = true,
}: {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
}) {
  return (
    <div
      className={cn(
        'animate-shimmer motion-reduce:animate-none',
        rounded && 'rounded-[var(--radius-md)]',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  )
}

/** Text variant — multiple lines with staggered widths */
function TextSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <ShimmerBlock
          key={i}
          height={16}
          className={cn(
            i === lines - 1 ? 'w-3/4' : 'w-full',
            'rounded-[var(--radius-md)]'
          )}
        />
      ))}
    </div>
  )
}

/** Card variant — card with header and body */
function CardSkeleton({ className }: { className?: string }) {
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
      <ShimmerBlock height={20} width="60%" />
      <TextSkeleton lines={3} />
    </div>
  )
}

/** Avatar variant — circular or rounded avatar */
function AvatarSkeleton({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <ShimmerBlock
      width={size}
      height={size}
      className={cn('rounded-full', className)}
    />
  )
}

/** Chart variant — for graph/stats area loading */
function ChartSkeleton({ className }: { className?: string }) {
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
      <ShimmerBlock height={16} width="40%" />
      <div className="flex items-end gap-2 h-32">
        {Array.from({ length: 8 }).map((_, i) => (
          <ShimmerBlock
            key={i}
            className="flex-1 rounded-t-md"
            height={`${30 + ((i * 7) % 60)}%`}
          />
        ))}
      </div>
    </div>
  )
}

/** Button variant */
function ButtonSkeleton({ className }: { className?: string }) {
  return (
    <ShimmerBlock
      height={36}
      width={100}
      className={cn('rounded-[var(--radius-md)]', className)}
    />
  )
}

/** Image variant */
function ImageSkeleton({ className, aspectRatio = '16/9' }: { className?: string; aspectRatio?: string }) {
  return (
    <div
      className={cn('rounded-[var(--radius-lg)] overflow-hidden', className)}
      style={{ aspectRatio }}
    >
      <ShimmerBlock height="100%" width="100%" className="rounded-none" />
    </div>
  )
}

/** Chat message skeleton — avatar + text lines */
function ChatMessageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 p-4', className)}>
      <AvatarSkeleton size={36} />
      <div className="flex-1 space-y-2 min-w-0">
        <ShimmerBlock height={14} width="30%" />
        <TextSkeleton lines={2} />
      </div>
    </div>
  )
}

/** Entity list item skeleton — avatar + title + description */
function EntityListSkeleton({ items = 5, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3"
        >
          <AvatarSkeleton size={32} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <ShimmerBlock height={14} width="40%" />
            <ShimmerBlock height={12} width="60%" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Writing area skeleton — title + paragraphs */
function WritingAreaSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6 p-8', className)}>
      <ShimmerBlock height={32} width="60%" className="rounded-[var(--radius-lg)]" />
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />
      <div className="space-y-4">
        <TextSkeleton lines={4} />
        <TextSkeleton lines={3} />
        <TextSkeleton lines={5} />
      </div>
    </div>
  )
}

/** Main SmartSkeleton component */
export function SmartSkeleton({
  variant = 'text',
  className,
  lines = 3,
  width,
}: SmartSkeletonProps) {
  switch (variant) {
    case 'text':
      return <TextSkeleton lines={lines} className={className} />
    case 'card':
      return <CardSkeleton className={className} />
    case 'avatar':
      return <AvatarSkeleton size={typeof width === 'number' ? width : 40} className={className} />
    case 'chart':
      return <ChartSkeleton className={className} />
    case 'button':
      return <ButtonSkeleton className={className} />
    case 'image':
      return <ImageSkeleton className={className} />
    default:
      return <TextSkeleton lines={lines} className={className} />
  }
}

/** Preset skeleton layouts for common use cases */
export function ChatSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-1', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} />
      ))}
    </div>
  )
}

export function EntityListSkeletonPreset({ items = 5, className }: { items?: number; className?: string }) {
  return <EntityListSkeleton items={items} className={className} />
}

export function WritingSkeleton({ className }: { className?: string }) {
  return <WritingAreaSkeleton className={className} />
}

export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Skeleton with content cross-fade transition */
interface SkeletonTransitionProps {
  loading: boolean
  children: React.ReactNode
  variant?: SmartSkeletonProps['variant']
  className?: string
  skeletonClassName?: string
  /** Transition duration (ms) */
  transitionDuration?: number
  /** Minimum skeleton display time (ms), prevents flickering */
  minDuration?: number
}

/**
 * SkeletonTransition — Cross-fade transition between skeleton and content
 *
 * Features:
 * - Smooth skeleton fade-out + content fade-in transition
 * - Minimum display time to prevent flickering on fast loads
 * - Supports all SmartSkeleton variants
 */
export function SkeletonTransition({
  loading,
  children,
  variant = 'text',
  className,
  skeletonClassName,
  transitionDuration = 300,
  minDuration = 400,
}: SkeletonTransitionProps) {
  const [showSkeleton, setShowSkeleton] = useState(loading)
  const [showContent, setShowContent] = useState(!loading)
  const [minTimeElapsed, setMinTimeElapsed] = useState(!loading)

  useEffect(() => {
    if (loading) {
      setShowSkeleton(true)
      setShowContent(false)
      setMinTimeElapsed(false)

      const timer = setTimeout(() => {
        setMinTimeElapsed(true)
      }, minDuration)

      return () => clearTimeout(timer)
    } else {
      // Wait for minimum time before switching
      const timer = setTimeout(() => {
        setShowSkeleton(false)
        // Delay content display slightly to let skeleton start fading out
        setTimeout(() => {
          setShowContent(true)
        }, transitionDuration / 3)
      }, minTimeElapsed ? 0 : minDuration)

      return () => clearTimeout(timer)
    }
  }, [loading, minDuration, minTimeElapsed, transitionDuration])

  return (
    <div className={cn('relative', className)}>
      {/* Skeleton layer */}
      <div
        className={cn(
          'transition-opacity',
          skeletonClassName
        )}
        style={{
          opacity: showSkeleton ? 1 : 0,
          transitionDuration: `${transitionDuration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: showSkeleton ? 'auto' : 'none',
          position: showContent ? 'absolute' : 'relative',
          inset: 0,
        }}
        aria-hidden={!showSkeleton}
      >
        <SmartSkeleton variant={variant} className="w-full h-full" />
      </div>

      {/* Content layer */}
      <div
        className="transition-all"
        style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? 'translateY(0)' : 'translateY(4px)',
          transitionDuration: `${transitionDuration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: showContent ? 'auto' : 'none',
          position: showSkeleton ? 'absolute' : 'relative',
          inset: 0,
        }}
        aria-hidden={!showContent}
      >
        {children}
      </div>
    </div>
  )
}

/** Content fade-in wrapper — Fade-in effect after content loads */
export function ContentFadeIn({
  children,
  className,
  delay = 0,
  duration = 400,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}
