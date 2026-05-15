/**
 * SmartSkeleton -- Enhanced skeleton loading component with context-adaptive shimmer
 *
 * Thin wrapper that composes SkeletonPrimitives and SkeletonVariants.
 * Sub-modules:
 * - SkeletonPrimitives: ShimmerBlock, Text, Card, Avatar, Chart, Button, Image skeletons
 * - SkeletonVariants: List, AvatarGroup, Table, Form, CardDetail, ListIcon,
 *   ChartBar, ChartLine, ChatMessage, EntityList, WritingArea skeletons
 */

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

// Re-export primitives
export { type ShimmerTone, getShimmerGradient, ShimmerBlock, TextSkeleton, CardSkeleton, AvatarSkeleton, ChartSkeleton, ButtonSkeleton, ImageSkeleton } from './SkeletonPrimitives'

// Re-export variants
export { ListSkeleton, AvatarGroupSkeleton, TableSkeleton, FormSkeleton, CardDetailSkeleton, ListIconSkeleton, ChartBarSkeleton, ChartLineSkeleton, ChatMessageSkeleton, EntityListSkeleton, WritingAreaSkeleton } from './SkeletonVariants'

import { ShimmerBlock, TextSkeleton, CardSkeleton, AvatarSkeleton, ChartSkeleton, ButtonSkeleton, ImageSkeleton, type ShimmerTone } from './SkeletonPrimitives'
import { ListSkeleton, AvatarGroupSkeleton, TableSkeleton, FormSkeleton, CardDetailSkeleton, ListIconSkeleton, ChartBarSkeleton, ChartLineSkeleton, ChatMessageSkeleton, EntityListSkeleton, WritingAreaSkeleton } from './SkeletonVariants'

interface SmartSkeletonProps {
  variant?: 'text' | 'card' | 'avatar' | 'chart' | 'button' | 'image' | 'list' | 'avatar-group' | 'table' | 'form' | 'card-detail' | 'list-icon' | 'chart-bar' | 'chart-line'
  className?: string
  lines?: number
  width?: string | number
  height?: string | number
  tone?: ShimmerTone
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
        <div key={i}>
          <ShimmerBlock height={120} width="100%" tone={tone} className="rounded-[var(--radius-lg)]" />
        </div>
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
  transitionDuration?: number
  minDuration?: number
  tone?: ShimmerTone
}

/**
 * SkeletonTransition -- Cross-fade transition between skeleton and content
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
      const timer = setTimeout(() => {
        setShowSkeleton(false)
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

/** Content fade-in wrapper */
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
