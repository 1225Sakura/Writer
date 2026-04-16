import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline'
}

const variantStyles = {
  default: 'bg-var-accent/90 text-white',
  character: 'bg-var-character text-var-ink',
  item: 'bg-var-item text-white',
  location: 'bg-var-location text-white',
  faction: 'bg-var-faction text-white',
  outline: 'bg-var-outline text-white',
  ifline: 'bg-var-ifline text-var-ink',
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-all duration-150',
            variantStyles[variant]
          ),
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = 'Badge'
