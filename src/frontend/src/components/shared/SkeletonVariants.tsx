/**
 * SkeletonVariants - Complex and composite skeleton variants
 *
 * Provides List, AvatarGroup, Table, Form, CardDetail, ListIcon,
 * ChartBar, ChartLine, ChatMessage, EntityList, WritingArea skeletons.
 */

import { cn } from '@/lib/utils'
import { ShimmerBlock, AvatarSkeleton, TextSkeleton, type ShimmerTone } from './SkeletonPrimitives'

/** List variant -- multiple list items */
export function ListSkeleton({ items = 5, className, tone }: { items?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-1', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]"
          style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--paper-100) 2%, transparent)' }}
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

/** Avatar group variant -- multiple avatars with overlap */
export function AvatarGroupSkeleton({ count = 4, className, tone }: { count?: number; className?: string; tone?: ShimmerTone }) {
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

/** Table variant -- table rows */
export function TableSkeleton({ rows = 5, columns = 4, className, tone }: { rows?: number; columns?: number; className?: string; tone?: ShimmerTone }) {
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

/** Form variant -- form fields */
export function FormSkeleton({ fields = 4, className, tone }: { fields?: number; className?: string; tone?: ShimmerTone }) {
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

/** Card detail skeleton -- card with avatar, title, description rows */
export function CardDetailSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
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

/** List icon skeleton -- multiple list items with icon placeholders */
export function ListIconSkeleton({ items = 5, className, tone }: { items?: number; className?: string; tone?: ShimmerTone }) {
  return (
    <div className={cn('space-y-1', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-[var(--radius-md)]"
          style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--paper-100) 2%, transparent)' }}
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

// ChartBarSkeleton, ChartLineSkeleton re-exported from SkeletonChartVariants.tsx
export { ChartBarSkeleton, ChartLineSkeleton } from './SkeletonChartVariants'

/** Chat message skeleton -- avatar + text lines */
export function ChatMessageSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
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

/** Entity list item skeleton -- avatar + title + description */
export function EntityListSkeleton({ items = 5, className, tone }: { items?: number; className?: string; tone?: ShimmerTone }) {
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

/** Writing area skeleton -- title + paragraphs */
export function WritingAreaSkeleton({ className, tone }: { className?: string; tone?: ShimmerTone }) {
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
