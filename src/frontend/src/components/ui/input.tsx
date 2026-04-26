import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--color-surface-base)] px-3 py-2 text-sm',
          'ring-offset-background placeholder:text-[var(--text-tertiary)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:border-[var(--accent-primary)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-all duration-[var(--transition-fast)] ease-out',
          'hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]',
          'focus:shadow-[0_0_0_3px_rgba(94,181,166,0.15)]',
          'dark:bg-[var(--color-surface-raised)] dark:border-[var(--border-strong)]',
          'dark:hover:border-[var(--border-default)] dark:hover:bg-[var(--color-surface-hover)]',
          'dark:focus:border-[var(--accent-primary)] dark:focus:shadow-[0_0_0_3px_rgba(94,181,166,0.2)]',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-primary)]',
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
