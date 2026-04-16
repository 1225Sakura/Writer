import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={twMerge(
          clsx(
            'flex h-10 w-full rounded-xl border-2 border-var-border bg-var-bg px-4 py-2 text-sm',
            'text-var-text placeholder:text-var-text-secondary/60',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-var-accent focus:border-var-accent',
            'hover:border-var-text-secondary/40',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-var-border',
            'shadow-sm hover:shadow-md focus:shadow-lg'
          ),
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
