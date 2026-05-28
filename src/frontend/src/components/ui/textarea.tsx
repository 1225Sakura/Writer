import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// ============================================================
// TEXTAREA VARIANTS (cva)
// Status: default, error, success
// ============================================================

const textareaVariants = cva(
  [
    // Base layout
    'flex min-h-[80px] w-full rounded-lg border bg-[var(--color-surface-input)] px-3 py-2 text-sm',
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
    // Resize
    'resize-y',
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

export type TextareaVariants = VariantProps<typeof textareaVariants>

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    TextareaVariants {
  /** Error state - convenience alias for status="error" */
  error?: boolean
  /** Success state - convenience alias for status="success" */
  success?: boolean
  /** Auto-resize to content height */
  autoResize?: boolean
}

// ============================================================
// TEXTAREA COMPONENT
// ============================================================

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, status, error, success, autoResize, onInput, ...props }, ref) => {
    // Derive status from boolean convenience props
    const resolvedStatus = error ? 'error' : success ? 'success' : status

    const handleInput = React.useCallback(
      (e: React.FormEvent<HTMLTextAreaElement>) => {
        if (autoResize) {
          const target = e.currentTarget
          target.style.height = 'auto'
          target.style.height = `${target.scrollHeight}px`
        }
        onInput?.(e)
      },
      [autoResize, onInput]
    )

    return (
      <textarea
        className={cn(textareaVariants({ status: resolvedStatus }), className)}
        ref={ref}
        onInput={handleInput}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea, textareaVariants }
