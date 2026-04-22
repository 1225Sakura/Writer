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
  default: 'bg-var-accent text-white hover:bg-[#828fff] active:bg-[#4f5ab8]',
  primary: 'bg-[#5e6ad2] text-white hover:bg-[#828fff] active:bg-[#4f5ab8]',
  secondary:
    'bg-var-border text-var-text hover:bg-var-border/80 active:bg-var-border/60 border border-transparent hover:border-var-text-secondary/30',
  outline:
    'border border-var-border bg-transparent hover:bg-var-border/20 active:bg-var-border/40',
  ghost:
    'bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] text-[#d0d6e0] border border-[rgba(255,255,255,0.08)]',
  ghostHover:
    'bg-transparent text-[#d0d6e0] border border-transparent hover:bg-[rgba(255,255,255,0.05)] hover:border-[rgba(255,255,255,0.08)]',
  subtle:
    'bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[#d0d6e0] border border-[rgba(255,255,255,0.06)]',
  destructive: 'bg-var-error text-white hover:brightness-110 active:brightness-90',
  glow: 'bg-var-accent text-white relative overflow-hidden',
  gradient:
    'bg-gradient-to-r from-[#5e6ad2] to-[#7b87e0] text-white hover:from-[#6b76d9] hover:to-[#8a94e8] active:from-[#4f5ab8] active:to-[#6b76d9]',
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
      glowColor = '#5e6ad2',
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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-var-accent focus-visible:ring-offset-2 focus-visible:ring-offset-var-bg',
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

        {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        <span className="relative z-10">{children}</span>

        {/* Ripple effects */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/30 pointer-events-none animate-ripple"
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
