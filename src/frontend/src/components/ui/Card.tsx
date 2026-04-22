import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradientBorder' | 'elevated'
  hoverLift?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverLift = false, ...props }, ref) => {
    const variantClasses = {
      default: clsx(
        'rounded-[8px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]',
        'transition-all duration-200',
        'hover:bg-[rgba(255,255,255,0.05)]'
      ),
      glass: clsx(
        'rounded-[8px]',
        'bg-[rgba(255,255,255,0.04)] backdrop-blur-md',
        'border border-[rgba(255,255,255,0.1)]',
        'transition-all duration-300',
        'hover:bg-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)]'
      ),
      gradientBorder: clsx(
        'rounded-[8px] relative',
        'bg-[#0f1011]',
        'before:absolute before:inset-0 before:rounded-[8px] before:p-[1px]',
        'before:bg-gradient-to-br before:from-[#5e6ad2] before:via-[rgba(255,255,255,0.08)] before:to-[#7eb84a]',
        'before:-z-10',
        'after:absolute after:inset-[1px] after:rounded-[7px] after:bg-[#0f1011] after:-z-10',
        'transition-all duration-300',
        'hover:before:from-[#6b76d9] hover:before:to-[#8cc85a]'
      ),
      elevated: clsx(
        'rounded-[8px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]',
        'shadow-elevated',
        'transition-all duration-200',
        'hover:bg-[rgba(255,255,255,0.05)] hover:shadow-elevated-lg'
      ),
    }

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            variantClasses[variant],
            hoverLift && 'hover:-translate-y-1 hover:shadow-elevated',
            variant === 'gradientBorder' && 'p-5'
          ),
          className
        )}
        {...props}
      />
    )
  }
)
Card.displayName = 'Card'

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(clsx('flex flex-col space-y-1.5 p-5 pb-3'), className)}
        {...props}
      />
    )
  }
)
CardHeader.displayName = 'CardHeader'

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(clsx('p-5 pt-0'), className)}
        {...props}
      />
    )
  }
)
CardContent.displayName = 'CardContent'

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(clsx('flex items-center p-5 pt-0'), className)}
        {...props}
      />
    )
  }
)
CardFooter.displayName = 'CardFooter'
