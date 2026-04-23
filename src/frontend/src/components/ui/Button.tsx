import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'outline'
    | 'ghost'
    | 'ghostHover'
    | 'subtle'
    | 'destructive'
    | 'secondary'
    | 'glow'
    | 'gradient'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  asChild?: boolean
  loading?: boolean
  glowColor?: string
}

const variantStyles: Record<string, string> = {
  default: 'text-[var(--text-primary)] hover:brightness-110 active:brightness-90 disabled:brightness-75 disabled:cursor-not-allowed',
  primary: 'text-[var(--text-primary)] hover:brightness-110 active:brightness-90 disabled:brightness-75 disabled:cursor-not-allowed',
  secondary:
    'text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.1)] active:bg-[rgba(255,255,255,0.08)] border border-[var(--border-default)] hover:border-[rgba(208,214,224,0.3)] disabled:opacity-50 disabled:cursor-not-allowed',
  outline:
    'border border-[var(--border-default)] bg-transparent hover:bg-[rgba(255,255,255,0.06)]/20 active:bg-[rgba(255,255,255,0.06)]/40 disabled:opacity-40 disabled:cursor-not-allowed',
  ghost:
    'hover:bg-[var(--color-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-default)] disabled:opacity-50 disabled:cursor-not-allowed',
  ghostHover:
    'text-[var(--text-secondary)] border border-transparent hover:bg-[var(--color-surface-hover)] hover:border-[var(--border-default)] disabled:opacity-40 disabled:cursor-not-allowed',
  subtle:
    'hover:bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] border border-[var(--border-default)] disabled:opacity-50 disabled:cursor-not-allowed',
  destructive: 'bg-[var(--color-danger)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90 disabled:brightness-75 disabled:cursor-not-allowed',
  glow: 'text-[var(--text-primary)] relative overflow-hidden disabled:brightness-75 disabled:cursor-not-allowed',
  gradient:
    'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90 disabled:brightness-75 disabled:cursor-not-allowed',
}

const variantBackgrounds: Record<string, string> = {
  default: 'var(--accent-primary)',
  primary: 'var(--accent-primary)',
  secondary: 'rgba(255,255,255,0.06)',
  outline: 'transparent',
  ghost: 'var(--color-surface-raised)',
  ghostHover: 'transparent',
  subtle: 'var(--color-surface-raised)',
  destructive: 'var(--color-danger)',
  glow: 'var(--accent-primary)',
  gradient: 'transparent',
}

const sizeStyles = {
  sm: 'h-8 px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'h-10 px-4 py-2 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 py-3 text-base rounded-xl gap-2.5',
  icon: 'h-10 w-10 rounded-full',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      asChild = false,
      disabled,
      loading,
      children,
      glowColor = 'var(--accent-primary)',
      onClick,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'
    const [ripples, setRipples] = React.useState<
      Array<{ id: number; x: number; y: number }>
    >([])
    const buttonRef = React.useRef<HTMLButtonElement>(null)

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (loading || disabled) return

        const button = buttonRef.current
        if (button) {
          const rect = button.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const id = Date.now()
          setRipples((prev) => [...prev, { id, x, y }])
          setTimeout(() => {
            setRipples((prev) => prev.filter((r) => r.id !== id))
          }, 600)
        }

        onClick?.(e)
      },
      [loading, disabled, onClick]
    )

    const isGlow = variant === 'glow'

    return (
      <Comp
        ref={(node: HTMLButtonElement | null) => {
          ;(buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }}
        disabled={disabled || loading}
        className={twMerge(
          clsx(
            'relative inline-flex items-center justify-center font-[510] transition-all duration-200 cursor-pointer overflow-hidden',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
            'disabled:pointer-events-none disabled:opacity-50',
            'hover:scale-[1.02] active:scale-[0.98]',
            variantStyles[variant],
            sizeStyles[size]
          ),
          className
        )}
        style={
          {
            backgroundColor: variantBackgrounds[variant],
            ...(isGlow ? { boxShadow: `0 0 16px ${glowColor}40, 0 0 32px ${glowColor}20` } : {}),
          }
        }
        onClick={handleClick}
        {...props}
      >
        {/* Glow variant animated background */}
        {isGlow && (
          <span
            className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${glowColor}30 0%, transparent 70%)`,
            }}
          />
        )}

        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin motion-reduce:animate-none" />}
        <span className="relative z-10">{children}</span>

        {/* Ripple effects */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/30 pointer-events-none animate-ripple motion-reduce:animate-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </Comp>
    )
  }
)

Button.displayName = 'Button'
