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
            // Linear textarea: translucent bg, semi-transparent border, 6px radius
            'flex min-h-[80px] w-full rounded-[6px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-sm',
            'text-[#d0d6e0] placeholder:text-[#8a8f98]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-[#5e6ad2]/50 focus:border-[rgba(255,255,255,0.12)]',
            'hover:border-[rgba(255,255,255,0.12)]',
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
