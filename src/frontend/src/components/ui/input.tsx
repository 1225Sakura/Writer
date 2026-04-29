import * as React from 'react'
import { cn } from '@/lib/utils'

// ============================================================
// INPUT COMPONENT
// Unified focus states, consistent design tokens
// ============================================================

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Error state - adds red border and subtle background tint */
  error?: boolean
  /** Success state - adds green border */
  success?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Base layout
          'flex h-10 w-full rounded-lg border bg-[var(--color-surface-base)] px-3 py-2 text-sm',
          'ring-offset-[var(--color-surface-base)] placeholder:text-[var(--text-tertiary)]',
          // Focus states
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'focus-visible:ring-[var(--accent-primary)] focus-visible:border-[var(--accent-primary)]',
          'focus-visible:shadow-[0_0_0_3px_rgba(94,181,166,0.15)]',
          // Hover states
          'hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]',
          // Disabled states
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Transition
          'transition-all duration-[var(--transition-fast)] ease-out',
          // File input
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-primary)]',
          // Error state
          error && 'border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)] focus-visible:border-[var(--color-danger)] focus-visible:shadow-[0_0_0_3px_rgba(196,92,92,0.15)]',
          // Success state
          success && 'border-[var(--color-success)] focus-visible:ring-[var(--color-success)] focus-visible:border-[var(--color-success)] focus-visible:shadow-[0_0_0_3px_rgba(126,184,74,0.15)]',
          // Default border (when not error/success)
          !error && !success && 'border-[var(--border-default)]',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
