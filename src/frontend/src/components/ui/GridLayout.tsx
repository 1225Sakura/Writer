/**
 * GridLayout - Shared types, constants, and utility components for BentoGrid
 */

import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type BentoItemSize =
  | '1x1'
  | '1x2'
  | '2x1'
  | '2x2'
  | 'full'

export type BentoItemColor =
  | 'default'
  | 'accent'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'outline'
  | 'ifline'
  | 'vermillion'

export interface BentoItemProps {
  children: ReactNode
  className?: string
  size?: BentoItemSize
  color?: BentoItemColor
  rounded?: 'sm' | 'md' | 'lg' | 'xl'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  hover?: boolean
  onClick?: () => void
  background?: string
  shimmer?: boolean
}

export interface BentoGridProps {
  children: ReactNode
  className?: string
  columns?: number
  gap?: string
  maxWidth?: string
}

export const colorMap: Record<BentoItemColor, CSSProperties> = {
  default: {
    background: 'var(--elevation-2)',
    borderColor: 'var(--border-subtle)',
  },
  accent: {
    background: 'rgba(201, 169, 110, 0.08)',
    borderColor: 'rgba(201, 169, 110, 0.2)',
  },
  character: {
    background: 'rgba(232, 184, 125, 0.06)',
    borderColor: 'rgba(232, 184, 125, 0.18)',
  },
  item: {
    background: 'rgba(155, 126, 217, 0.06)',
    borderColor: 'rgba(155, 126, 217, 0.18)',
  },
  location: {
    background: 'rgba(94, 181, 166, 0.06)',
    borderColor: 'rgba(94, 181, 166, 0.18)',
  },
  faction: {
    background: 'rgba(212, 93, 93, 0.06)',
    borderColor: 'rgba(212, 93, 93, 0.18)',
  },
  outline: {
    background: 'rgba(91, 142, 232, 0.06)',
    borderColor: 'rgba(91, 142, 232, 0.18)',
  },
  ifline: {
    background: 'rgba(126, 183, 74, 0.06)',
    borderColor: 'rgba(126, 183, 74, 0.18)',
  },
  vermillion: {
    background: 'rgba(196, 92, 92, 0.06)',
    borderColor: 'rgba(196, 92, 92, 0.18)',
  },
}

export const roundedMap = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
}

export const paddingMap = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '28px',
}

/**
 * BentoSection - Bento section title
 */
export function BentoSection({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('mb-4', className)}>
      <h3
        className="text-base font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/**
 * BentoStat - Bento statistic display
 */
export function BentoStat({
  value,
  label,
  trend,
  color = 'accent',
}: {
  value: string | number
  label: string
  trend?: { value: number; positive: boolean }
  color?: BentoItemColor
}) {
  const colorHexMap: Record<string, string> = {
    accent: 'var(--accent-100)',
    character: 'var(--color-character)',
    item: 'var(--color-item)',
    location: 'var(--color-location)',
    faction: 'var(--color-faction)',
    outline: 'var(--color-outline)',
    ifline: 'var(--color-ifline)',
    vermillion: 'var(--vermillion-100)',
    default: 'var(--text-primary)',
  }

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div
          className="text-3xl font-bold tracking-tight"
          style={{ color: colorHexMap[color] ?? colorHexMap.accent }}
        >
          {value}
        </div>
        <div
          className="text-sm mt-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {label}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3">
          <span
            className="text-xs font-medium"
            style={{
              color: trend.positive ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            较上周
          </span>
        </div>
      )}
    </div>
  )
}
