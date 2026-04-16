import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={twMerge(
          clsx(
            'flex min-h-[80px] w-full rounded-[var(--radius-input)] border border-var-border bg-var-bg px-3 py-2 text-sm',
            'text-var-text placeholder:text-var-text-secondary',
            'transition-all duration-[var(--transition-fast)]',
            'focus:outline-none focus:ring-2 focus:ring-var-vermillion/50 focus:border-var-vermillion',
            'hover:border-var-text-secondary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-y'
          ),
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = 'Textarea'
