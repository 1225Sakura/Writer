/**
 * MicroInteractionsControls - Interactive control components
 *
 * Provides IconButton, Toggle, HoverCard, PulseIndicator,
 * ShimmerButton, MagneticEffect, CountUpNumber, ShakeFeedback.
 */

import * as React from 'react'
import { motion, type HTMLMotionProps, AnimatePresence } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { easeOutSmooth } from './MicroInteractionsVariants'

// ==================== Icon Button ====================

interface IconButtonProps extends HTMLMotionProps<'button'> {
  icon: ReactNode
  label?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'subtle' | 'accent'
  isActive?: boolean
}

/**
 * IconButton - Icon button with hover and tap feedback
 */
export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  isActive = false,
  className,
  ...props
}: IconButtonProps) {
  const sizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
  }

  const variantStyles: Record<string, CSSProperties> = {
    ghost: {
      background: 'transparent',
      border: '1px solid transparent',
      color: 'var(--text-secondary)',
    },
    subtle: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid var(--border-default)',
      color: 'var(--text-primary)',
    },
    accent: {
      background: 'var(--accent-primary)',
      border: '1px solid transparent',
      color: 'var(--paper-100)',
    },
  }

  const activeStyle: CSSProperties = isActive
    ? {
        background: 'var(--accent-muted)',
        borderColor: 'var(--accent-primary)',
        color: 'var(--accent-primary)',
      }
    : {}

  return (
    <motion.button
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium',
        sizeMap[size],
        className
      )}
      style={{
        ...variantStyles[variant],
        ...activeStyle,
      }}
      whileHover={{ opacity: 0.85 }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
      aria-label={label}
      {...props}
    >
      {icon}
    </motion.button>
  )
}

// ==================== Toggle Switch ====================

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

/**
 * Toggle - Switch toggle
 */
export function Toggle({
  checked,
  onChange,
  size = 'md',
  disabled = false,
  className,
}: ToggleProps) {
  const sizeMap = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3' },
    md: { track: 'w-11 h-6', thumb: 'w-5 h-5' },
  }

  const { track, thumb } = sizeMap[size]

  return (
    <motion.button
      className={cn(
        'relative inline-flex items-center rounded-full cursor-pointer transition-colors',
        track,
        checked ? 'bg-accent-primary' : 'bg-elevation-4',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={{
        backgroundColor: checked ? 'var(--accent-primary)' : 'var(--elevation-4)',
      }}
      onClick={() => !disabled && onChange(!checked)}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
    >
      <motion.div
        className={cn('absolute bg-white rounded-full shadow-sm', thumb)}
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
    </motion.button>
  )
}

// ==================== HoverCard ====================

interface HoverCardProps {
  children: ReactNode
  content?: ReactNode
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

/**
 * HoverCard - Hover-revealed card
 */
export function HoverCard({
  children,
  content,
  className,
  side = 'top',
  align = 'center',
}: HoverCardProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatePresence>
        {isHovered && content && (
          <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.12, ease: easeOutSmooth }}
            className={cn(
              'absolute z-50 p-3 rounded-lg border shadow-lg',
              'bg-elevation-3 border-border-default',
              side === 'top' && 'bottom-full mb-2',
              side === 'bottom' && 'top-full mt-2',
              side === 'left' && 'right-full mr-2',
              side === 'right' && 'left-full ml-2',
              align === 'start' && (side === 'top' || side === 'bottom') && 'left-0',
              align === 'end' && (side === 'top' || side === 'bottom') && 'right-0',
              className
            )}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ==================== PulseIndicator ====================

interface PulseIndicatorProps {
  status?: 'online' | 'offline' | 'busy' | 'away'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * PulseIndicator - Status indicator dot
 */
export function PulseIndicator({
  status = 'online',
  size = 'md',
  className,
}: PulseIndicatorProps) {
  const statusColors = {
    online: 'var(--color-success)',
    offline: 'var(--text-tertiary)',
    busy: 'var(--color-danger)',
    away: 'var(--color-warning)',
  }

  const sizeMap = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  return (
    <span
      className={cn('relative inline-flex rounded-full', sizeMap[size], className)}
      style={{ backgroundColor: statusColors[status] }}
    />
  )
}

// ShimmerButton, MagneticEffect, CountUpNumber, ShakeFeedback
// are re-exported from MicroInteractionsEffects.tsx via MicroInteractions.tsx
