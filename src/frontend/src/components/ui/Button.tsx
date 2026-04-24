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
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<string, string> = {
  default: 'text-[var(--text-primary)]',
  primary: 'text-[var(--text-primary)]',
  secondary: 'text-[var(--text-primary)]',
  outline: 'text-[var(--text-primary)]',
  ghost: 'text-[var(--text-secondary)]',
  ghostHover: 'text-[var(--text-secondary)]',
  subtle: 'text-[var(--text-secondary)]',
  destructive: 'text-[var(--text-primary)]',
  glow: 'text-[var(--text-primary)]',
  gradient: 'text-[var(--text-primary)]',
}

const variantBackgrounds: Record<string, string> = {
  default: 'var(--accent-primary)',
  primary: 'var(--accent-primary)',
  secondary: 'rgba(255,255,255,0.06)',
  outline: 'transparent',
  ghost: 'transparent',
  ghostHover: 'transparent',
  subtle: 'rgba(255,255,255,0.04)',
  destructive: 'var(--color-danger)',
  glow: 'var(--accent-primary)',
  gradient: 'transparent',
}

const sizeStyles = {
  sm: 'h-8 px-3 py-1.5 text-sm rounded-[var(--radius-button)] gap-1.5',
  md: 'h-10 px-4 py-2 text-sm rounded-[var(--radius-md)] gap-2',
  lg: 'h-12 px-6 py-3 text-base rounded-[var(--radius-lg)] gap-2.5',
  icon: 'h-10 w-10 rounded-full',
  'mobile-sm': 'h-9 px-3 py-1.5 text-sm rounded-[var(--radius-button)] gap-1 touch-target',
  'mobile-md': 'h-11 px-4 py-2 text-sm rounded-[var(--radius-md)] gap-2 touch-target',
  'mobile-lg': 'h-12 px-5 py-2.5 text-base rounded-[var(--radius-lg)] gap-2 touch-target',
}

const variantHoverStyles: Record<string, string> = {
  default: 'hover:brightness-110 active:brightness-90',
  primary: 'hover:brightness-110 active:brightness-90',
  secondary: 'hover:bg-[rgba(255,255,255,0.1)] active:bg-[rgba(255,255,255,0.08)]',
  outline: 'hover:bg-[rgba(255,255,255,0.06)] active:bg-[rgba(255,255,255,0.1)]',
  ghost: 'hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)]',
  ghostHover: 'hover:bg-[var(--color-surface-hover)]',
  subtle: 'hover:bg-[rgba(255,255,255,0.08)] active:bg-[rgba(255,255,255,0.12)]',
  destructive: 'hover:brightness-110 active:brightness-90',
  glow: '',
  gradient: 'hover:brightness-110 active:brightness-90',
}

const variantBorderStyles: Record<string, string> = {
  default: '',
  primary: '',
  secondary: 'border border-[var(--border-default)] hover:border-[rgba(208,214,224,0.4)]',
  outline: 'border border-[var(--border-default)]',
  ghost: 'border border-[var(--border-default)]',
  ghostHover: 'border border-transparent hover:border-[var(--border-default)]',
  subtle: 'border border-[var(--border-default)]',
  destructive: '',
  glow: '',
  gradient: '',
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
      leftIcon,
      rightIcon,
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
    const [isPressed, setIsPressed] = React.useState(false)

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
    const isDisabled = disabled || loading

    return (
      <Comp
        ref={(node: HTMLButtonElement | null) => {
          ;(buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }}
        disabled={isDisabled}
        className={twMerge(
          clsx(
            'relative inline-flex items-center justify-center font-[510] cursor-pointer overflow-hidden',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
            'disabled:pointer-events-none',
            'transition-all duration-[var(--transition-base)] ease-out',
            'hover:scale-[1.02] active:scale-[0.98]',
            variantStyles[variant],
            variantHoverStyles[variant],
            variantBorderStyles[variant],
            sizeStyles[size]
          ),
          className
        )}
        style={
          {
            backgroundColor: variantBackgrounds[variant],
            opacity: isDisabled ? 0.5 : 1,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            ...(isGlow ? {
              boxShadow: `0 0 16px ${glowColor}40, 0 0 32px ${glowColor}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
            } : {}),
          }
        }
        onClick={handleClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        {...props}
      >
        {/* Glow variant animated background */}
        {isGlow && (
          <span
            className="absolute inset-0 opacity-0 hover:opacity-100 active:opacity-100 transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${glowColor}40 0%, transparent 70%)`,
            }}
          />
        )}

        {/* Glow pulse animation */}
        {isGlow && (
          <span
            className="absolute inset-0 animate-glow-pulse opacity-50"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${glowColor}20 0%, transparent 60%)`,
            }}
          />
        )}

        {/* Gradient background for gradient variant */}
        {variant === 'gradient' && (
          <span
            className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]"
          />
        )}

        {/* Content wrapper */}
        <span className="relative z-10 inline-flex flex-row items-center justify-center gap-2">
          {loading ? (
            <Loader2 className={twMerge(
              'text-[var(--icon-secondary)] animate-spin',
              size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
            )} />
          ) : leftIcon ? (
            <span className="inline-flex items-center justify-center flex-shrink-0">{leftIcon}</span>
          ) : null}
          {children && <span className={clsx(
            'whitespace-nowrap',
            leftIcon && 'pl-0.5',
            rightIcon && 'pr-0.5'
          )}>{children}</span>}
          {!loading && rightIcon && (
            <span className="inline-flex items-center justify-center flex-shrink-0">{rightIcon}</span>
          )}
        </span>

        {/* Ripple effects */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/25 pointer-events-none animate-ripple motion-reduce:animate-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}

        {/* Inner highlight for raised variants */}
        {!isDisabled && variant !== 'outline' && variant !== 'ghost' && variant !== 'ghostHover' && (
          <span className="absolute inset-0 rounded-inherit pointer-events-none opacity-[0.03] bg-gradient-to-b from-white to-transparent" />
        )}
      </Comp>
    )
  }
)

Button.displayName = 'Button'
