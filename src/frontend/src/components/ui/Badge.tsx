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
  default: 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/30 hover:border-[var(--accent-primary)]/50 hover:shadow-[0_2px_8px_var(--accent-primary)/20]',
  primary: 'bg-[var(--color-world)]/20 text-[var(--color-world)] border border-[var(--color-world)]/30 hover:bg-[var(--color-world)]/30 hover:border-[var(--color-world)]/50 hover:shadow-[0_2px_8px_var(--color-world)/20]',
  secondary: 'bg-[var(--color-surface-overlay)]/80 text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--color-surface-hover)] hover:border-[var(--border-strong)]',
  outline: 'bg-transparent border border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:bg-[var(--color-surface-hover)]/50',
  ghost: 'bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)]/30',
  // Entity type colors matching project ontology
  character: 'bg-[var(--color-character)]/15 text-[var(--color-character)] border border-[var(--color-character)]/30 hover:bg-[var(--color-character)]/25 hover:border-[var(--color-character)]/50 hover:shadow-[0_2px_8px_var(--color-character)/15]',
  item: 'bg-[var(--color-item)]/15 text-[var(--color-item)] border border-[var(--color-item)]/30 hover:bg-[var(--color-item)]/25 hover:border-[var(--color-item)]/50 hover:shadow-[0_2px_8px_var(--color-item)/15]',
  location: 'bg-[var(--color-location)]/15 text-[var(--color-location)] border border-[var(--color-location)]/30 hover:bg-[var(--color-location)]/25 hover:border-[var(--color-location)]/50 hover:shadow-[0_2px_8px_var(--color-location)/15]',
  faction: 'bg-[var(--color-faction)]/15 text-[var(--color-faction)] border border-[var(--color-faction)]/30 hover:bg-[var(--color-faction)]/25 hover:border-[var(--color-faction)]/50 hover:shadow-[0_2px_8px_var(--color-faction)/15]',
  outlineEntity: 'bg-[var(--color-outline)]/15 text-[var(--color-outline)] border border-[var(--color-outline)]/30 hover:bg-[var(--color-outline)]/25 hover:border-[var(--color-outline)]/50 hover:shadow-[0_2px_8px_var(--color-outline)/15]',
  ifline: 'bg-[var(--color-ifline)]/15 text-[var(--color-ifline)] border border-[var(--color-ifline)]/30 hover:bg-[var(--color-ifline)]/25 hover:border-[var(--color-ifline)]/50 hover:shadow-[0_2px_8px_var(--color-ifline)/15]',
  // Status colors
  success: 'bg-[var(--color-ifline)]/15 text-[var(--color-ifline)] border border-[var(--color-ifline)]/30 hover:bg-[var(--color-ifline)]/25 hover:border-[var(--color-ifline)]/50 hover:shadow-[0_2px_8px_var(--color-ifline)/15]',
  warning: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/30 hover:bg-[var(--color-warning)]/25 hover:border-[var(--color-warning)]/50 hover:shadow-[0_2px_8px_var(--color-warning)/15]',
  error: 'bg-[var(--color-vermillion)]/15 text-[var(--color-vermillion)] border border-[var(--color-vermillion)]/30 hover:bg-[var(--color-vermillion)]/25 hover:border-[var(--color-vermillion)]/50 hover:shadow-[0_2px_8px_var(--color-vermillion)/15]',
}

const dotColors: Record<string, string> = {
  default: 'bg-[var(--accent-primary)]',
  primary: 'bg-[var(--color-world)]',
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
  warning: 'bg-[var(--color-warning)]',
  error: 'bg-[var(--color-vermillion)]',
}

const sizeStyles = {
  sm: 'px-1.5 py-0 text-[10px] rounded-sm',
  md: 'px-2 py-0.5 text-xs rounded-md',
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, pulse = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-1 rounded-md font-medium transition-all duration-200 ease-out',
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
