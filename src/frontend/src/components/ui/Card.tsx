import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            // Linear card: translucent background, semi-transparent border, 8px radius
            'rounded-[8px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]',
            'transition-all duration-200',
            'hover:bg-[rgba(255,255,255,0.05)]',
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
