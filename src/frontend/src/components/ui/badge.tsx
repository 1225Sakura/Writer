import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ============================================================
// BADGE VARIANTS (cva)
// Unified: default, secondary, destructive, outline, ghost,
//          ink, paper, success, warning, glow, entity
// ============================================================

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-[var(--transition-fast)] ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--accent-primary)] text-[var(--ink-100)] hover:brightness-110 hover:scale-105 active:scale-95',
        secondary:
          'border-transparent bg-[var(--ink-80)] text-[var(--ink-100)] hover:bg-[var(--ink-75)] hover:scale-105 active:scale-95',
        destructive:
          'border-transparent bg-[var(--color-danger)] text-white hover:brightness-110 hover:scale-105 active:scale-95',
        outline:
          'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10',
        ghost:
          'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)]',
        ink: 'border-[var(--ink-70)] bg-[var(--ink-90)] text-[var(--paper-100)] hover:bg-[var(--ink-85)] hover:border-[var(--ink-60)]',
        paper:
          'border-[var(--paper-80)] bg-[var(--paper-100)] text-[var(--ink-90)] hover:bg-[var(--paper-95)] hover:border-[var(--paper-75)]',
        success:
          'border-transparent bg-[var(--color-success)] text-white hover:brightness-110 hover:scale-105 active:scale-95',
        warning:
          'border-transparent bg-[var(--color-warning)] text-[var(--ink-100)] hover:brightness-110 hover:scale-105 active:scale-95',
        glow: 'border-transparent bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30 hover:bg-[var(--accent-primary)]/30 hover:scale-105 active:scale-95',
        // Entity type color variants
        character:
          'border-transparent bg-[var(--color-character)]/20 text-[var(--color-character)] hover:bg-[var(--color-character)]/30',
        item:
          'border-transparent bg-[var(--color-item)]/20 text-[var(--color-item)] hover:bg-[var(--color-item)]/30',
        location:
          'border-transparent bg-[var(--color-location)]/20 text-[var(--color-location)] hover:bg-[var(--color-location)]/30',
        faction:
          'border-transparent bg-[var(--color-faction)]/20 text-[var(--color-faction)] hover:bg-[var(--color-faction)]/30',
        outline_entity:
          'border-transparent bg-[var(--color-outline)]/20 text-[var(--color-outline)] hover:bg-[var(--color-outline)]/30',
        ifline:
          'border-transparent bg-[var(--color-ifline)]/20 text-[var(--color-ifline)] hover:bg-[var(--color-ifline)]/30',
        world:
          'border-transparent bg-[var(--color-world)]/20 text-[var(--color-world)] hover:bg-[var(--color-world)]/30',
        rule:
          'border-transparent bg-[var(--color-rule)]/20 text-[var(--color-rule)] hover:bg-[var(--color-rule)]/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

// ============================================================
// TYPES
// ============================================================

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulse?: boolean
}

// ============================================================
// MAIN BADGE COMPONENT
// ============================================================

function Badge({ className, variant, pulse = false, ...props }: BadgeProps) {
  const shouldReduceMotion = useReducedMotion() ?? false

  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {pulse && !shouldReduceMotion && (
        <motion.span
          className="absolute inset-0 rounded-full"
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'currentColor' }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1">{props.children}</span>
    </div>
  )
}

export { Badge, badgeVariants }
