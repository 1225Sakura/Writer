import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'character'
    | 'item'
    | 'location'
    | 'faction'
    | 'outlineEntity'
    | 'ifline'
    | 'success'
    | 'warning'
    | 'error'
  size?: 'sm' | 'md'
  dot?: boolean
  pulse?: boolean
}

const variantStyles: Record<string, string> = {
  default: 'bg-[var(--accent-primary)]/90 text-white',
  primary: 'bg-[var(--color-world)] text-white',
  secondary: 'bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)]',
  outline: 'bg-transparent border border-[rgba(255,255,255,0.15)] text-[var(--text-secondary)]',
  ghost: 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
  // Entity type colors matching project ontology
  character: 'bg-[var(--color-character)]/20 text-[var(--color-character)] border border-[var(--color-character)]/30',
  item: 'bg-[var(--color-item)]/20 text-[var(--color-item)] border border-[var(--color-item)]/30',
  location: 'bg-[var(--color-location)]/20 text-[var(--color-location)] border border-[var(--color-location)]/30',
  faction: 'bg-[var(--color-faction)]/20 text-[var(--color-faction)] border border-[var(--color-faction)]/30',
  outlineEntity: 'bg-[var(--color-outline)]/20 text-[var(--color-outline)] border border-[var(--color-outline)]/30',
  ifline: 'bg-[var(--color-ifline)]/20 text-[var(--color-ifline)] border border-[var(--color-ifline)]/30',
  // Status colors
  success: 'bg-[var(--color-ifline)]/20 text-[var(--color-ifline)] border border-[var(--color-ifline)]/30',
  warning: 'bg-[var(--color-character)]/20 text-[var(--color-character)] border border-[var(--color-character)]/30',
  error: 'bg-[var(--vermillion)]/20 text-[var(--vermillion)] border border-[var(--vermillion)]/30',
}

const dotColors: Record<string, string> = {
  default: 'bg-white',
  primary: 'bg-white',
  secondary: 'bg-[var(--text-secondary)]',
  outline: 'bg-[var(--text-secondary)]',
  ghost: 'bg-[var(--text-tertiary)]',
  character: 'bg-[var(--color-character)]',
  item: 'bg-[var(--color-item)]',
  location: 'bg-[var(--color-location)]',
  faction: 'bg-[var(--color-faction)]',
  outlineEntity: 'bg-[var(--color-outline)]',
  ifline: 'bg-[var(--color-ifline)]',
  success: 'bg-[var(--color-ifline)]',
  warning: 'bg-[var(--color-character)]',
  error: 'bg-[var(--vermillion)]',
}

const sizeStyles = {
  sm: 'px-1.5 py-0 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, pulse = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-1 rounded-md font-medium transition-all duration-150',
            variantStyles[variant],
            sizeStyles[size]
          ),
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              dotColors[variant],
              pulse && 'animate-pulse motion-reduce:animate-none'
            )}
          />
        )}
        {children}
      </span>
    )
  }
)
Badge.displayName = 'Badge'
