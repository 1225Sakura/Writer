/**
 * SmartSkeleton — Enhanced skeleton loading component with context-adaptive shimmer
 * Based on shadcn/ui Skeleton with CSS shimmer sweep effect
 *
 * Features:
 *   - Context-adaptive shimmer gradients (warm/cool/neutral)
 *   - Rounded corners and spacing matching design system
 *   - Content-type aware variants (text, card, list, avatar-group, table, form)
 *   - Pulse fallback for reduced motion
 *   - Cross-fade transition between skeleton and content
 *
 * Variants:
 *   text         — Text lines skeleton (for paragraphs, messages)
 *   card         — Card skeleton (for entity cards, panels)
 *   avatar       — Avatar skeleton (for user/AI avatars, profile images)
 *   chart        — Chart/area skeleton (for relation graphs, stats)
 *   button       — Button skeleton
 *   image        — Image skeleton
 *   list         — List item skeletons
 *   avatar-group — Multiple avatars in a row
 *   table        — Table rows skeleton
 *   form         — Form fields skeleton
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

export type ShimmerTone = 'neutral' | 'warm' | 'cool' | 'accent'

interface SmartSkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'chart' | 'button' | 'image' | 'list' | 'avatar-group' | 'table' | 'form' | 'card-detail' | 'list-icon' | 'chart-bar' | 'chart-line'
  className?: string
  lines?: number
  width?: string | number
  height?: string | number
  tone?: ShimmerTone
}

/** Generate shimmer gradient based on tone */
function getShimmerGradient(tone: ShimmerTone): string {
  switch (tone) {
    case 'warm':
      return 'linear-gradient(90deg, transparent, rgba(232, 184, 125, 0.08), transparent)'
    case 'cool':
      return 'linear-gradient(90deg, transparent, rgba(94, 181, 166, 0.08), transparent)'
    case 'accent':
      return 'linear-gradient(90deg, transparent, rgba(94, 106, 210, 0.08), transparent)'
    case 'neutral':
    default:
      return 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent)'
  }
}

/** Base shimmer skeleton block with context-adaptive gradient */
function ShimmerBlock({
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

/** Text variant — multiple lines with staggered widths */
function TextSkeleton({ lines = 3, className, tone }: { lines?: number; className?: string; tone?: ShimmerTone }) {
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

/** Card variant — card with header and body */
function CardSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
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

/** Avatar variant — circular or rounded avatar */
function AvatarSkeleton({ size = 40, className, tone }: { size?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <ShimmerBlock
      width={size}
      height={size}
      tone={tone}
      className={cn('rounded-full', className)}
    />
  )
}

/** Chart variant — for graph/stats area loading */
function ChartSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
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
function ButtonSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
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
function ImageSkeleton({ className, aspectRatio = '16/9', tone }: { className?: string; aspectRatio?: string; tone?: ShimmerTone }) {
  return (
    <div
      className={cn('rounded-[var(--radius-lg)] overflow-hidden', className)}
      style={{ aspectRatio }}
    >
      <ShimmerBlock height="100%" width="100%" tone={tone} className="rounded-none" />
    </div>
  )
}

/** List variant — multiple list items */
function ListSkeleton({ items = 5, className, tone }: { items?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-1', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]"
          style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
        >
          <AvatarSkeleton size={32} tone={tone} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <ShimmerBlock height={14} width="40%" tone={tone} />
            <ShimmerBlock height={12} width="60%" tone={tone} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Avatar group variant — multiple avatars with overlap */
function AvatarGroupSkeleton({ count = 4, className, tone }: { count?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="relative rounded-full border-2"
            style={{ borderColor: 'var(--color-surface-raised)', zIndex: count - i }}
          >
            <AvatarSkeleton size={36} tone={tone} />
          </div>
        ))}
      </div>
      <ShimmerBlock height={14} width={60} tone={tone} className="ml-3" />
    </div>
  )
}

/** Table variant — table rows */
function TableSkeleton({ rows = 5, columns = 4, className, tone }: { rows?: number; columns?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('w-full space-y-2', className)}>
      {/* Header */}
      <div className="flex gap-3 pb-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <ShimmerBlock
            key={`h-${i}`}
            height={16}
            className={cn('flex-1', i === 0 && 'flex-[2]')}
            tone={tone}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-3 py-2">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <ShimmerBlock
              key={`${rowIdx}-${colIdx}`}
              height={14}
              className={cn('flex-1', colIdx === 0 && 'flex-[2]')}
              tone={tone}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Form variant — form fields */
function FormSkeleton({ fields = 4, className, tone }: { fields?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <ShimmerBlock height={14} width={`${25 + (i * 10) % 20}%`} tone={tone} />
          <ShimmerBlock height={40} width="100%" tone={tone} className="rounded-[var(--radius-md)]" />
        </div>
      ))}
      <ShimmerBlock height={40} width={120} tone={tone} className="rounded-[var(--radius-md)] mt-4" />
    </div>
  )
}

/** Card detail skeleton — card with avatar, title, description rows */
function CardDetailSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] p-4 space-y-4 border',
        className
      )}
      style={{
        backgroundColor: 'var(--color-surface-raised)',
        borderColor: 'var(--border-default)',
      }}
    >
      {/* Header with avatar + title */}
      <div className="flex items-center gap-3">
        <AvatarSkeleton size={44} tone={tone} />
        <div className="flex-1 space-y-2 min-w-0">
          <ShimmerBlock height={16} width="55%" tone={tone} />
          <ShimmerBlock height={12} width="35%" tone={tone} />
        </div>
      </div>
      {/* Divider */}
      <div className="h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />
      {/* Description rows */}
      <div className="space-y-2.5">
        <ShimmerBlock height={14} width="100%" tone={tone} />
        <ShimmerBlock height={14} width="90%" tone={tone} />
        <ShimmerBlock height={14} width="75%" tone={tone} />
      </div>
      {/* Footer action row */}
      <div className="flex items-center justify-between pt-1">
        <ShimmerBlock height={28} width={80} tone={tone} className="rounded-[var(--radius-md)]" />
        <ShimmerBlock height={28} width={60} tone={tone} className="rounded-[var(--radius-md)]" />
      </div>
    </div>
  )
}

/** List icon skeleton — multiple list items with icon placeholders */
function ListIconSkeleton({ items = 5, className, tone }: { items?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-1', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]"
          style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}
        >
          {/* Icon placeholder */}
          <ShimmerBlock
            width={32}
            height={32}
            tone={tone}
            className="rounded-lg flex-shrink-0"
          />
          <div className="flex-1 space-y-1.5 min-w-0">
            <ShimmerBlock height={14} width={`${40 + (i * 8) % 30}%`} tone={tone} />
            <ShimmerBlock height={12} width={`${60 + (i * 5) % 25}%`} tone={tone} />
          </div>
          {/* Trailing icon placeholder */}
          <ShimmerBlock
            width={20}
            height={20}
            tone={tone}
            className="rounded-md flex-shrink-0"
          />
        </div>
      ))}
    </div>
  )
}

/** Chart bar skeleton — bar chart shape with shimmer */
function ChartBarSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  const bars = [65, 40, 85, 55, 70, 45, 90, 60, 75, 50]
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
      <ShimmerBlock height={16} width="35%" tone={tone} />
      <div className="flex items-end gap-2 h-36 px-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-full relative overflow-hidden rounded-t-md"
              style={{ height: `${h}%` }}
            >
              <ShimmerBlock
                height="100%"
                width="100%"
                tone={tone}
                className="rounded-t-md"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBlock key={i} height={10} width={24} tone={tone} className="rounded-sm" />
        ))}
      </div>
    </div>
  )
}

/** Chart line skeleton — line chart shape with shimmer */
function ChartLineSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
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
      <div className="relative h-36 px-2">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px w-full" style={{ backgroundColor: 'var(--border-subtle)', opacity: 0.3 }} />
          ))}
        </div>
        {/* Line path placeholder */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`lineGrad-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,100 Q50,60 100,80 T200,40 T300,70 T400,30 T500,60 T600,20 T700,50 T800,35 T900,45 T1000,25"
            fill={`url(#lineGrad-${tone})`}
            stroke="var(--accent-primary)"
            strokeWidth="2"
            strokeOpacity="0.2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Data point placeholders */}
        <div className="absolute inset-0 flex items-end justify-between px-1">
          {[80, 45, 65, 30, 55, 20, 50, 35, 60, 25].map((h, i) => (
            <div key={i} className="flex flex-col items-center" style={{ height: `${h}%` }}>
              <ShimmerBlock width={8} height={8} tone={tone} className="rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between px-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBlock key={i} height={10} width={28} tone={tone} className="rounded-sm" />
        ))}
      </div>
    </div>
  )
}

/** Chat message skeleton — avatar + text lines */
function ChatMessageSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('flex items-start gap-3 p-4', className)}>
      <AvatarSkeleton size={36} tone={tone} />
      <div className="flex-1 space-y-2 min-w-0">
        <ShimmerBlock height={14} width="30%" tone={tone} />
        <TextSkeleton lines={2} tone={tone} />
      </div>
    </div>
  )
}

/** Entity list item skeleton — avatar + title + description */
function EntityListSkeleton({ items = 5, className, tone }: { items?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3"
        >
          <AvatarSkeleton size={32} tone={tone} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <ShimmerBlock height={14} width="40%" tone={tone} />
            <ShimmerBlock height={12} width="60%" tone={tone} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Writing area skeleton — title + paragraphs */
function WritingAreaSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-6 p-8', className)}>
      <ShimmerBlock height={32} width="60%" tone={tone} className="rounded-[var(--radius-lg)]" />
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-default)] to-transparent" />
      <div className="space-y-4">
        <TextSkeleton lines={4} tone={tone} />
        <TextSkeleton lines={3} tone={tone} />
        <TextSkeleton lines={5} tone={tone} />
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
  tone = 'neutral',
}: SmartSkeletonProps) {
  switch (variant) {
    case 'text':
      return <TextSkeleton lines={lines} className={className} tone={tone} />
    case 'card':
      return <CardSkeleton className={className} tone={tone} />
    case 'avatar':
      return <AvatarSkeleton size={typeof width === 'number' ? width : 40} className={className} tone={tone} />
    case 'chart':
      return <ChartSkeleton className={className} tone={tone} />
    case 'button':
      return <ButtonSkeleton className={className} tone={tone} />
    case 'image':
      return <ImageSkeleton className={className} tone={tone} />
    case 'list':
      return <ListSkeleton items={typeof width === 'number' ? width : 5} className={className} tone={tone} />
    case 'avatar-group':
      return <AvatarGroupSkeleton count={typeof width === 'number' ? width : 4} className={className} tone={tone} />
    case 'table':
      return <TableSkeleton rows={lines} columns={typeof width === 'number' ? width : 4} className={className} tone={tone} />
    case 'form':
      return <FormSkeleton fields={typeof width === 'number' ? width : 4} className={className} tone={tone} />
    case 'card-detail':
      return <CardDetailSkeleton className={className} tone={tone} />
    case 'list-icon':
      return <ListIconSkeleton items={typeof width === 'number' ? width : 5} className={className} tone={tone} />
    case 'chart-bar':
      return <ChartBarSkeleton className={className} tone={tone} />
    case 'chart-line':
      return <ChartLineSkeleton className={className} tone={tone} />
    default:
      return <TextSkeleton lines={lines} className={className} tone={tone} />
  }
}

/** Preset skeleton layouts for common use cases */
export function ChatSkeleton({ count = 3, className, tone }: { count?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-1', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} tone={tone} />
      ))}
    </div>
  )
}

export function EntityListSkeletonPreset({ items = 5, className, tone }: { items?: number; className?: string; tone?: ShimmerTone }) {
  return <EntityListSkeleton items={items} className={className} tone={tone} />
}

export function WritingSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
  return <WritingAreaSkeleton className={className} tone={tone} />
}

export function CardGridSkeleton({ count = 6, className, tone }: { count?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} tone={tone} />
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
  tone?: ShimmerTone
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
  tone = 'neutral',
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
        <SmartSkeleton variant={variant} className="w-full h-full" tone={tone} />
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
