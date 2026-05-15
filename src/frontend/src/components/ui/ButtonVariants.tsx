import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

// ============================================================
// BUTTON VARIANTS (cva)
// Unified variant system: default, ghost, subtle, accent, danger, glass
// Sizes: sm, md, lg, icon
// ============================================================

export const buttonVariants = cva(
  'relative inline-flex items-center justify-center font-[510] cursor-pointer overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] border border-transparent',
        subtle:
          'bg-[var(--color-surface-overlay)] text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-pressed)] border border-[var(--border-subtle)]',
        accent:
          'bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
        danger:
          'bg-[var(--color-danger)] text-white hover:brightness-110 active:brightness-90',
        glass:
          'bg-[var(--color-surface-raised)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-pressed)]',
        outline:
          'bg-transparent text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--hover-bg)] active:bg-[var(--active-bg)]',
        secondary:
          'bg-[var(--color-surface-overlay)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-pressed)]',
        ink:
          'bg-[var(--ink-90)] text-[var(--paper-100)] border border-[var(--ink-70)] hover:bg-[var(--ink-85)] active:bg-[var(--ink-80)]',
        paper:
          'bg-[var(--paper-100)] text-[var(--ink-90)] border border-[var(--paper-80)] hover:bg-[var(--paper-95)] active:bg-[var(--paper-90)]',
        gradient:
          'bg-transparent text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
        premium:
          'bg-[var(--color-surface-raised)] text-[var(--text-primary)] border border-[var(--border-default)]',
        glow:
          'bg-[var(--accent-primary)] text-[var(--ink-100)] hover:brightness-110 active:brightness-90',
        primary:
          'bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
      },
      size: {
        sm: 'h-8 px-3 py-1.5 text-sm rounded-[var(--radius-button)] gap-1.5',
        md: 'h-10 px-4 py-2 text-sm rounded-[var(--radius-md)] gap-2',
        lg: 'h-12 px-6 py-3 text-base rounded-[var(--radius-lg)] gap-2.5',
        icon: 'h-10 w-10 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

// ============================================================
// TYPES
// ============================================================

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  glowColor?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}
