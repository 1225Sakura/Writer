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
            // Linear input: translucent bg, semi-transparent border, 6px radius
            'flex h-10 w-full rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-2 text-sm',
            'text-[#d0d6e0] placeholder:text-[#8a8f98]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/50 focus:border-[rgba(255,255,255,0.12)]',
            'hover:border-[rgba(255,255,255,0.12)]',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[rgba(255,255,255,0.08)]'
          ),
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'
