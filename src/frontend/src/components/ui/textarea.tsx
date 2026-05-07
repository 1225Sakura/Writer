import * as React from 'react'
import { cn } from '@/lib/utils'

// ============================================================
// TEXTAREA COMPONENT
// Unified focus states, consistent design tokens
// ============================================================

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Error state - adds red border and subtle background tint */
  error?: boolean
  /** Success state - adds green border */
  success?: boolean
  /** Auto-resize to content height */
  autoResize?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, success, autoResize, onInput, ...props }, ref) => {
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
        className={cn(
          // Base layout
          'flex min-h-[80px] w-full rounded-lg border bg-[var(--color-surface-input)] px-3 py-2 text-sm',
          'ring-offset-[var(--color-surface-base)] placeholder:text-[var(--text-tertiary)]',
          // Focus states
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'focus-visible:ring-[var(--focus-ring)] focus-visible:border-[var(--accent-100)]',
          'focus-visible:shadow-[0_0_0_3px_rgba(201,169,110,0.15)]',
          // Hover states
          'hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]',
          // Disabled states
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Transition
          'transition-all duration-[var(--transition-fast)] ease-out',
          // Resize
          'resize-y',
          // Error state
          error && 'border-[var(--color-danger)] focus-visible:ring-[var(--vermillion-100)] focus-visible:border-[var(--color-danger)] focus-visible:shadow-[0_0_0_3px_var(--vermillion-muted)]',
          // Success state
          success && 'border-[var(--color-success)] focus-visible:ring-[var(--color-success)] focus-visible:border-[var(--color-success)] focus-visible:shadow-[0_0_0_3px_rgba(107,158,142,0.15)]',
          // Default border (when not error/success)
          !error && !success && 'border-[var(--border-default)]',
          className
        )}
        ref={ref}
        onInput={handleInput}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
