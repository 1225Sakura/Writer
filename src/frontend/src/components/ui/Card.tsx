import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradientBorder' | 'elevated' | 'glow'
  hoverLift?: boolean
  animated?: boolean
}

const cardVariants = {
  default: {
    base: 'rounded-[8px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]',
    hover: { y: -2, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' },
  },
  glass: {
    base: 'rounded-[8px] bg-[rgba(255,255,255,0.04)] backdrop-blur-md border border-[rgba(255,255,255,0.1)]',
    hover: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)' },
  },
  gradientBorder: {
    base: 'rounded-[8px] relative bg-[#0f1011] p-5',
    before: 'before:absolute before:inset-0 before:rounded-[8px] before:p-[1px] before:bg-gradient-to-br before:from-[#5e6ad2] before:via-[rgba(255,255,255,0.08)] before:to-[#7eb84a] before:-z-10',
    after: 'after:absolute after:inset-[1px] after:rounded-[7px] after:bg-[#0f1011] after:-z-10',
    hover: { '--tw-gradient-from': '#6b76d9', '--tw-gradient-to': '#8cc85a' } as Record<string, string>,
  },
  elevated: {
    base: 'rounded-[8px] bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] shadow-elevated',
    hover: { backgroundColor: 'rgba(255,255,255,0.05)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  },
  glow: {
    base: 'rounded-[12px] relative bg-[#1a1a2e] p-5',
    before: 'before:absolute before:inset-0 before:rounded-[12px] before:p-[1px] before:bg-gradient-to-br before:from-[#5e6ad2]/50 before:via-[rgba(255,255,255,0.08)] before:to-[#7eb84a]/30 before:-z-10',
    after: 'after:absolute after:inset-[1px] after:rounded-[11px] after:bg-[#1a1a2e] after:-z-10',
    hover: { boxShadow: '0 0 20px rgba(94,106,210,0.4), 0 0 40px rgba(94,106,210,0.2)' },
  },
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverLift = false, animated = true, ...props }, ref) => {
    const v = cardVariants[variant]

    if (!animated) {
      return (
        <div
          ref={ref}
          className={twMerge(
            clsx(v.base, v.before, v.after, hoverLift && 'hover:-translate-y-1 hover:shadow-elevated'),
            className
          )}
          {...props}
        />
      )
    }

    return (
      <motion.div
        ref={ref}
        className={twMerge(clsx(v.base, v.before, v.after), className)}
        whileHover={v.hover as Record<string, string | number>}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
