import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'character'
    | 'item'
    | 'location'
    | 'faction'
    | 'outlineEntity'
    | 'ifline'
    | 'success'
    | 'warning'
    | 'error'
  size?: 'sm' | 'md'
  dot?: boolean
  pulse?: boolean
}

const variantStyles: Record<string, string> = {
  default: 'bg-var-accent/90 text-white',
  primary: 'bg-[#5e6ad2] text-white',
  secondary: 'bg-[rgba(255,255,255,0.08)] text-[#d0d6e0]',
  outline: 'bg-transparent border border-[rgba(255,255,255,0.15)] text-[#d0d6e0]',
  ghost: 'bg-transparent text-[#8a8f98] hover:text-[#d0d6e0]',
  // Entity type colors matching project ontology
  character: 'bg-[#e8b87d]/20 text-[#e8b87d] border border-[#e8b87d]/30',
  item: 'bg-[#9b7ed9]/20 text-[#9b7ed9] border border-[#9b7ed9]/30',
  location: 'bg-[#5eb5a6]/20 text-[#5eb5a6] border border-[#5eb5a6]/30',
  faction: 'bg-[#d45d5d]/20 text-[#d45d5d] border border-[#d45d5d]/30',
  outlineEntity: 'bg-[#5b8ee8]/20 text-[#5b8ee8] border border-[#5b8ee8]/30',
  ifline: 'bg-[#7eb84a]/20 text-[#7eb84a] border border-[#7eb84a]/30',
  // Status colors
  success: 'bg-[#6dd45e]/20 text-[#6dd45e] border border-[#6dd45e]/30',
  warning: 'bg-[#e8b87d]/20 text-[#e8b87d] border border-[#e8b87d]/30',
  error: 'bg-[#c45c5c]/20 text-[#c45c5c] border border-[#c45c5c]/30',
}

const dotColors: Record<string, string> = {
  default: 'bg-white',
  primary: 'bg-white',
  secondary: 'bg-[#d0d6e0]',
  outline: 'bg-[#d0d6e0]',
  ghost: 'bg-[#8a8f98]',
  character: 'bg-[#e8b87d]',
  item: 'bg-[#9b7ed9]',
  location: 'bg-[#5eb5a6]',
  faction: 'bg-[#d45d5d]',
  outlineEntity: 'bg-[#5b8ee8]',
  ifline: 'bg-[#7eb84a]',
  success: 'bg-[#6dd45e]',
  warning: 'bg-[#e8b87d]',
  error: 'bg-[#c45c5c]',
}

const sizeStyles = {
  sm: 'px-1.5 py-0 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, pulse = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center gap-1 rounded-md font-medium transition-all duration-150',
            variantStyles[variant],
            sizeStyles[size]
          ),
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={clsx(
              'w-1.5 h-1.5 rounded-full flex-shrink-0',
              dotColors[variant],
              pulse && 'animate-pulse'
            )}
          />
        )}
        {children}
      </span>
    )
  }
)
Badge.displayName = 'Badge'
