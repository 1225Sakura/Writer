/**
 * StatusBadge - Unified status indicator
 *
 * Now wraps the Badge component with status-specific presets.
 * Supports: online, offline, busy, warning, error, idle
 * Features: pulse animation, dot-only mode, multiple sizes
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

// ============================================================
// TYPES
// ============================================================

export type StatusType = 'online' | 'offline' | 'busy' | 'warning' | 'error' | 'idle'

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusType
  label?: string
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  pulseRing?: boolean
  dotOnly?: boolean
  customLabel?: string
}

// ============================================================
// STATUS CONFIG
// ============================================================

const statusLabelMap: Record<StatusType, string> = {
  online: '在线',
  offline: '离线',
  busy: '忙碌',
  warning: '警告',
  error: '错误',
  idle: '空闲',
}

const statusColorMap: Record<StatusType, string> = {
  online: 'var(--color-success)',
  offline: 'var(--text-tertiary)',
  busy: 'var(--color-warning)',
  warning: 'var(--color-warning)',
  error: 'var(--color-danger)',
  idle: 'var(--color-item)',
}

const sizeMap = {
  sm: { dot: 6, ring: 10, fontSize: '11px', padding: '2px 8px', gap: '4px' },
  md: { dot: 8, ring: 14, fontSize: '12px', padding: '3px 10px', gap: '6px' },
  lg: { dot: 10, ring: 18, fontSize: '13px', padding: '4px 12px', gap: '8px' },
}

// ============================================================
// DOT-ONLY STATUS INDICATOR
// ============================================================

function StatusDot({
  status,
  size = 'md',
  pulse = true,
  pulseRing = false,
  className,
}: {
  status: StatusType
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  pulseRing?: boolean
  className?: string
}) {
  const color = statusColorMap[status]
  const sizeConfig = sizeMap[size]

  return (
    <span className={cn('relative inline-flex items-center justify-center', className)}>
      {pulse && pulseRing && (
        <span
          className="absolute rounded-full animate-ping"
          style={{
            width: sizeConfig.ring,
            height: sizeConfig.ring,
            backgroundColor: color,
            opacity: 0.25,
          }}
        />
      )}
      <span
        className={cn('relative rounded-full', pulse && status !== 'offline' && 'animate-pulse')}
        style={{
          width: sizeConfig.dot,
          height: sizeConfig.dot,
          backgroundColor: color,
        }}
      />
    </span>
  )
}

// ============================================================
// MAIN STATUS BADGE COMPONENT
// ============================================================

export const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  (
    {
      className,
      status,
      label,
      size = 'md',
      pulse = true,
      pulseRing = false,
      dotOnly = false,
      customLabel,
      ...props
    },
    ref
  ) => {
    const displayLabel = customLabel ?? label ?? statusLabelMap[status]
    const color = statusColorMap[status]
    const sizeConfig = sizeMap[size]

    if (dotOnly) {
      return (
        <div ref={ref} className={cn('inline-flex items-center', className)} {...props}>
          <StatusDot status={status} size={size} pulse={pulse} pulseRing={pulseRing} />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border transition-all duration-[var(--transition-fast)]',
          className
        )}
        style={{
          padding: sizeConfig.padding,
          gap: sizeConfig.gap,
          backgroundColor: `${color}1f`, // 12% opacity hex
          borderColor: `${color}33`, // 20% opacity hex
          fontSize: sizeConfig.fontSize,
        }}
        {...props}
      >
        <StatusDot status={status} size={size} pulse={pulse} pulseRing={pulseRing} />
        {displayLabel && (
          <span className="font-medium whitespace-nowrap" style={{ color }}>
            {displayLabel}
          </span>
        )}
      </div>
    )
  }
)

StatusBadge.displayName = 'StatusBadge'

export { StatusDot }
