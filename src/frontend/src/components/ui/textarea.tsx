import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-[var(--border-default)] bg-[var(--color-surface-base)] px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-[var(--text-tertiary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:border-[var(--accent-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-[var(--transition-fast)] ease-out',
          'hover:border-[var(--border-strong)]',
          'focus:shadow-[0_0_0_3px_rgba(94,181,166,0.15)]',
          'dark:bg-[var(--color-surface-raised)] dark:border-[var(--border-strong)]',
          'dark:hover:border-[var(--border-default)]',
          'dark:focus:border-[var(--accent-primary)] dark:focus:shadow-[0_0_0_3px_rgba(94,181,166,0.2)]',
          'resize-none',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
