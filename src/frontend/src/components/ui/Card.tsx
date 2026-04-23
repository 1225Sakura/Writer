import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'

// Re-export GlassCard for advanced glass morphism effects
export {
  GlassCard,
  GlassPanel,
  GlassBadge,
  GlassButton,
  GlassDivider,
  type GlassIntensity,
  type GlassBorder,
  type GlassVariant,
} from '../shared/GlassCard'

export interface CardProps {
  className?: string
  variant?: 'default' | 'glass' | 'gradientBorder' | 'elevated' | 'glow'
  hoverLift?: boolean
  animated?: boolean
  children?: React.ReactNode
}

const cardVariants = {
  default: {
    base: 'rounded-xl bg-[var(--color-surface-raised)] border border-[var(--border-default)]',
    hover: { y: -2, backgroundColor: 'var(--color-surface-hover)', borderColor: 'var(--border-strong)' },
  },
  glass: {
    base: 'rounded-xl bg-[rgba(255,255,255,0.04)] backdrop-blur-md border border-[rgba(255,255,255,0.1)]',
    hover: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)' },
  },
  gradientBorder: {
    base: 'rounded-xl relative bg-[var(--color-surface-raised)] p-5',
    before: 'before:absolute before:inset-0 before:rounded-xl before:p-[1px] before:bg-gradient-to-br before:from-[var(--accent-primary)] before:via-[rgba(255,255,255,0.08)] before:to-[var(--color-ifline)] before:-z-10',
    after: 'after:absolute after:inset-[1px] after:rounded-[11px] after:bg-[var(--color-surface-raised)] after:-z-10',
    hover: { '--tw-gradient-from': '#6b76d9', '--tw-gradient-to': '#8cc85a' } as Record<string, string>,
  },
  elevated: {
    base: 'rounded-xl bg-[var(--color-surface-raised)] border border-[var(--border-default)] shadow-lg',
    hover: { backgroundColor: 'var(--color-surface-hover)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' },
  },
  glow: {
    base: 'rounded-xl relative bg-[var(--color-surface-raised)] p-5',
    before: 'before:absolute before:inset-0 before:rounded-xl before:p-[1px] before:bg-gradient-to-br before:from-[var(--accent-primary)]/50 before:via-[rgba(255,255,255,0.08)] before:to-[var(--color-ifline)]/30 before:-z-10',
    after: 'after:absolute after:inset-[1px] after:rounded-xl after:bg-[var(--color-surface-raised)] after:-z-10',
    hover: { boxShadow: '0 0 20px rgba(94,106,210,0.4), 0 0 40px rgba(94,106,210,0.2)' },
  },
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverLift = false, animated = true, children, ...props }, ref) => {
    const v = cardVariants[variant]
    const baseClasses = clsx(v.base, 'before' in v ? v.before : '', 'after' in v ? v.after : '')

    if (!animated) {
      return (
        <div
          ref={ref}
          className={twMerge(
            clsx(baseClasses, hoverLift && 'hover:-translate-y-1 hover:shadow-elevated'),
            className
          )}
          {...props}
        >
          {children}
        </div>
      )
    }

    return (
      <motion.div
        ref={ref}
        className={twMerge(baseClasses, className)}
        whileHover={v.hover as Record<string, string | number>}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: 'center' }}
        {...props}
      >
        {children}
      </motion.div>
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
