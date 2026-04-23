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

const variantStyles = {
  default: 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-active)]',
  primary: 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] active:bg-[var(--accent-primary-active)]',
  secondary:
    'bg-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--border-strong)] active:bg-[var(--border-strong)]/80 border border-transparent hover:border-[var(--text-secondary)]/30',
  outline:
    'border border-[var(--border-default)] bg-transparent hover:bg-[var(--border-default)]/20 active:bg-[var(--border-default)]/40',
  ghost:
    'bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-default)]',
  ghostHover:
    'bg-transparent text-[var(--text-secondary)] border border-transparent hover:bg-[var(--color-surface-hover)] hover:border-[var(--border-default)]',
  subtle:
    'bg-[var(--color-surface-raised)] hover:bg-[var(--border-default)] text-[var(--text-secondary)] border border-[var(--border-default)]',
  destructive: 'bg-[var(--color-danger)] text-white hover:brightness-110 active:brightness-90',
  glow: 'bg-[var(--accent-primary)] text-white relative overflow-hidden',
  gradient:
    'bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)] active:from-[var(--accent-primary-active)] active:to-[var(--accent-secondary-active)]',
}

const sizeStyles = {
  sm: 'h-8 px-3 py-1.5 text-sm rounded-lg',
  md: 'h-10 px-4 py-2 text-base rounded-xl',
  lg: 'h-12 px-6 py-3 text-lg rounded-xl',
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
          isGlow
            ? {
                boxShadow: `0 0 16px ${glowColor}40, 0 0 32px ${glowColor}20`,
              }
            : undefined
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
