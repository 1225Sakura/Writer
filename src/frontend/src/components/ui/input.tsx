import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ============================================================
// INPUT VARIANTS (cva)
// Status: default, error, success
// ============================================================

const inputVariants = cva(
  [
    // Base layout
    'flex h-10 w-full rounded-lg border bg-[var(--color-surface-input)] px-3 py-2 text-sm',
    'ring-offset-[var(--color-surface-base)] placeholder:text-[var(--text-tertiary)]',
    // Focus states
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-[var(--focus-ring)] focus-visible:border-[var(--accent-100)]',
    'focus-visible:shadow-[0_0_0_3px_color-mix(in srgb, var(--accent-100) 15%, transparent)]',
    // Hover states
    'hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]',
    // Disabled states
    'disabled:cursor-not-allowed disabled:opacity-50',
    // Transition
    'transition-all duration-[var(--transition-fast)] ease-out',
    // File input
    'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-primary)]',
  ],
  {
    variants: {
      status: {
        default: 'border-[var(--border-default)]',
        error:
          'border-[var(--color-danger)] focus-visible:ring-[var(--vermillion-100)] focus-visible:border-[var(--color-danger)] focus-visible:shadow-[0_0_0_3px_var(--vermillion-muted)]',
        success:
          'border-[var(--color-success)] focus-visible:ring-[var(--color-success)] focus-visible:border-[var(--color-success)] focus-visible:shadow-[0_0_0_3px_color-mix(in srgb, var(--color-location) 15%, transparent)]',
      },
    },
    defaultVariants: {
      status: 'default',
    },
  }
)

// ============================================================
// TYPES
// ============================================================

export type InputVariants = VariantProps<typeof inputVariants>

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    InputVariants {
  /** Error state - convenience alias for status="error" */
  error?: boolean
  /** Success state - convenience alias for status="success" */
  success?: boolean
}

// ============================================================
// INPUT COMPONENT
// ============================================================

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, status, error, success, ...props }, ref) => {
    // Derive status from boolean convenience props
    const resolvedStatus = error ? 'error' : success ? 'success' : status

    return (
      <input
        type={type}
        className={cn(inputVariants({ status: resolvedStatus }), className)}
        ref={ref}
        {...props}
        aria-label={props['aria-label'] ?? '输入'}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input, inputVariants }
