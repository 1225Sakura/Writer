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
  variant?: 'default' | 'glass' | 'gradientBorder' | 'elevated' | 'glow' | 'ink' | 'paper' | 'entity'
  hoverLift?: boolean
  animated?: boolean
  children?: React.ReactNode
  /** 实体颜色编码（用于 entity 变体） */
  entityColor?: 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'accent'
}

const entityColorMap: Record<string, string> = {
  character: '#e8b87d',
  item: '#9b7ed9',
  location: '#5eb5a6',
  faction: '#d45d5d',
  outline: '#5b8ee8',
  ifline: '#7eb84a',
  accent: '#5e6ad2',
}

const cardVariants = {
  default: {
    base: 'rounded-[var(--radius-card)] bg-[var(--color-surface-raised)] border border-[var(--border-default)]',
    hover: { y: -2, backgroundColor: 'var(--color-surface-hover)', borderColor: 'var(--border-strong)' },
  },
  glass: {
    base: 'rounded-[var(--radius-card)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border border-[var(--glass-border)]',
    hover: { backgroundColor: 'var(--glass-bg-strong)', borderColor: 'var(--border-strong)' },
  },
  gradientBorder: {
    base: 'rounded-[var(--radius-card)] relative bg-[var(--color-surface-raised)] p-5',
    before: 'before:absolute before:inset-0 before:rounded-[var(--radius-card)] before:p-[1px] before:bg-gradient-to-br before:from-[var(--accent-primary)] before:via-[var(--border-default)] before:to-[var(--color-ifline)] before:-z-10',
    after: 'after:absolute after:inset-[1px] after:rounded-[11px] after:bg-[var(--color-surface-raised)] after:-z-10',
    hover: { '--tw-gradient-from': 'var(--accent-hover)', '--tw-gradient-to': 'var(--color-ifline)' } as Record<string, string>,
  },
  elevated: {
    base: 'rounded-[var(--radius-card)] bg-[var(--color-surface-raised)] border border-[var(--border-default)] shadow-[var(--shadow-elevated)]',
    hover: { backgroundColor: 'var(--color-surface-hover)', boxShadow: 'var(--shadow-elevated-lg)' },
  },
  glow: {
    base: 'rounded-[var(--radius-card)] relative bg-[var(--color-surface-raised)] p-5',
    before: 'before:absolute before:inset-0 before:rounded-[var(--radius-card)] before:p-[1px] before:bg-gradient-to-br before:from-[var(--accent-primary)]/50 before:via-[var(--border-default)] before:to-[var(--color-ifline)]/30 before:-z-10',
    after: 'after:absolute after:inset-[1px] after:rounded-[var(--radius-card)] after:bg-[var(--color-surface-raised)] after:-z-10',
    hover: { boxShadow: 'var(--shadow-glow)' },
  },
  ink: {
    base: 'rounded-[var(--radius-card)] bg-[var(--ink-90)] border border-[var(--ink-70)]',
    hover: { backgroundColor: 'var(--ink-85)', borderColor: 'var(--ink-60)', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)' },
  },
  paper: {
    base: 'rounded-[var(--radius-card)] bg-[var(--paper-100)] border border-[var(--paper-85)]',
    hover: { backgroundColor: 'var(--paper-95)', borderColor: 'var(--paper-80)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' },
  },
  entity: {
    base: 'rounded-[var(--radius-card)] relative bg-[var(--color-surface-raised)] p-5',
    before: '',
    after: '',
    hover: { y: -2, boxShadow: 'var(--shadow-elevated)' },
  },
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverLift = false, animated = true, entityColor = 'accent', children, ...props }, ref) => {
    const v = cardVariants[variant]
    const baseClasses = clsx(v.base, 'before' in v ? v.before : '', 'after' in v ? v.after : '')

    // Entity variant uses dynamic colors
    const isEntity = variant === 'entity'
    const entityColorValue = entityColorMap[entityColor]

    if (!animated) {
      return (
        <div
          ref={ref}
          className={twMerge(
            clsx(baseClasses, hoverLift && 'hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)]'),
            className
          )}
          {...props}
        >
          {isEntity && (
            <>
              <div
                className="absolute inset-0 rounded-[var(--radius-card)] pointer-events-none -z-10"
                style={{
                  padding: '1.5px',
                  background: `linear-gradient(135deg, ${entityColorValue}80, ${entityColorValue}30)`,
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />
              <div
                className="absolute inset-[1.5px] rounded-[calc(var(--radius-card)-1.5px)] bg-[var(--color-surface-raised)] -z-10"
              />
            </>
          )}
          {children}
        </div>
      )
    }

    return (
      <motion.div
        ref={ref}
        className={twMerge(baseClasses, className)}
        whileHover={v.hover as Record<string, string | number>}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: 'center' }}
        {...props}
      >
        {isEntity && (
          <>
            <motion.div
              className="absolute inset-0 rounded-[var(--radius-card)] pointer-events-none -z-10"
              style={{
                padding: '1.5px',
                background: `linear-gradient(135deg, ${entityColorValue}80, ${entityColorValue}30)`,
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />
            <div
              className="absolute inset-[1.5px] rounded-[calc(var(--radius-card)-1.5px)] bg-[var(--color-surface-raised)] -z-10"
            />
          </>
        )}
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
