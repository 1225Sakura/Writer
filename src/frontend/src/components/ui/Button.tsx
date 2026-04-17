import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Slot } from '@radix-ui/react-slot'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'outline' | 'ghost' | 'subtle' | 'destructive' | 'secondary'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  asChild?: boolean
}

const variantStyles = {
  default: 'bg-var-accent text-white hover:bg-[#828fff] active:bg-[#4f5ab8] shadow-sm hover:shadow-md',
  primary: 'bg-[#5e6ad2] text-white hover:bg-[#828fff] active:bg-[#4f5ab8] shadow-sm hover:shadow-md',
  secondary: 'bg-var-border text-var-text hover:bg-var-border/80 active:bg-var-border/60 border border-transparent hover:border-var-text-secondary/30',
  outline: 'border border-var-border bg-transparent hover:bg-var-border/20 active:bg-var-border/40',
  ghost: 'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] text-[#e2e4e7] border border-[rgb(36,40,44)]',
  subtle: 'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[#d0d6e0] border border-transparent',
  destructive: 'bg-var-error text-white hover:brightness-110 active:brightness-90 shadow-sm hover:shadow-md',
}

const sizeStyles = {
  sm: 'h-8 px-3 py-1.5 text-sm rounded-lg',
  md: 'h-10 px-4 py-2 text-base rounded-xl',
  lg: 'h-12 px-6 py-3 text-lg rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild = false, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        disabled={disabled}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-var-accent focus-visible:ring-offset-2 focus-visible:ring-offset-var-bg',
            'disabled:pointer-events-none disabled:opacity-50',
            variantStyles[variant],
            sizeStyles[size]
          ),
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
