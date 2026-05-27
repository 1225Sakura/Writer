import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/hooks'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { buttonVariants, type ButtonProps } from './ButtonVariants'
import {
  LoadingSpinner,
  Ripple,
  PremiumBackground,
  PremiumGlowBorder,
  InkInnerGlow,
  PaperShadow,
} from './ButtonEffects'

// ============================================================
// MAIN BUTTON COMPONENT
// ============================================================

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
    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([])
    const buttonRef = React.useRef<HTMLButtonElement>(null)
    const [isPressed, setIsPressed] = React.useState(false)
    const [isHovered, setIsHovered] = React.useState(false)
    const prefersReducedMotion = usePrefersReducedMotion()

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
        }
        onClick?.(e)
      },
      [loading, disabled, onClick]
    )

    const removeRipple = React.useCallback((id: number) => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, [])

    const isGlass = variant === 'glass'
    const isGlow = variant === 'glow'
    const isPremium = variant === 'premium'
    const isInk = variant === 'ink'
    const isPaper = variant === 'paper'
    const isGradient = variant === 'gradient'
    const isDisabled = disabled || loading

    return (
      <Comp
        ref={(node: HTMLButtonElement | null) => {
          ;(buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
        }}
        disabled={isDisabled}
        className={cn(
          buttonVariants({ variant, size }),
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
          'disabled:pointer-events-none disabled:opacity-50',
          'transition-all duration-[var(--transition-base)] ease-out',
          className
        )}
        style={{
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          ...(isGlass || isGlow
            ? {
                boxShadow: `0 0 16px color-mix(in srgb, ${glowColor} 25%, transparent), 0 0 32px color-mix(in srgb, ${glowColor} 13%, transparent), inset 0 1px 0 color-mix(in srgb, var(--accent-100) 8%, transparent)`,
              }
            : {}),
          ...(isPremium
            ? {
                background: 'var(--color-surface-raised)',
              }
            : {}),
        }}
        onClick={handleClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => { setIsPressed(false); setIsHovered(false) }}
        onMouseEnter={() => setIsHovered(true)}
        {...props}
      >
        {/* Glass/Glow variant animated background */}
        {(isGlass || isGlow) && (
          <motion.span
            className="absolute inset-0 rounded-inherit pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${glowColor} 25%, transparent) 0%, transparent 70%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          />
        )}

        {/* Glass/Glow pulse animation */}
        {(isGlass || isGlow) && (
          <motion.span
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${glowColor} 13%, transparent) 0%, transparent 60%)`,
            }}
            animate={
              prefersReducedMotion
                ? {}
                : { opacity: [0.3, 0.5, 0.3], scale: [1, 1.05, 1] }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        )}

        {/* Premium variant backgrounds */}
        {isPremium && (
          <>
            <PremiumBackground isHovered={isHovered} isPressed={isPressed} />
            <PremiumGlowBorder isHovered={isHovered} />
          </>
        )}

        {/* Ink variant inner glow */}
        {isInk && <InkInnerGlow isHovered={isHovered} />}

        {/* Paper variant shadow */}
        {isPaper && <PaperShadow isHovered={isHovered} />}

        {/* Gradient background */}
        {isGradient && (
          <span className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]" />
        )}

        {/* Content */}
        <span className="relative z-10 inline-flex flex-row items-center justify-center gap-2">
          {loading ? (
            <LoadingSpinner size={size} />
          ) : leftIcon ? (
            <span className="inline-flex items-center justify-center flex-shrink-0">{leftIcon}</span>
          ) : null}
          {children && (
            <span className={cn('whitespace-nowrap', leftIcon && 'pl-0.5', rightIcon && 'pr-0.5')}>
              {children}
            </span>
          )}
          {!loading && rightIcon && (
            <span className="inline-flex items-center justify-center flex-shrink-0">{rightIcon}</span>
          )}
        </span>

        {/* Ripples */}
        <AnimatePresence>
          {ripples.map((ripple) => (
            <Ripple
              key={ripple.id}
              x={ripple.x}
              y={ripple.y}
              onComplete={() => removeRipple(ripple.id)}
            />
          ))}
        </AnimatePresence>

        {/* Inner highlight for solid variants */}
        {!isDisabled &&
          variant !== 'outline' &&
          variant !== 'ghost' &&
          variant !== 'subtle' &&
          variant !== 'glass' && (
            <span className="absolute inset-0 rounded-inherit pointer-events-none opacity-[0.04] bg-gradient-to-b from-[var(--paper-100)] to-transparent" />
          )}
      </Comp>
    )
  }
)

Button.displayName = 'Button'

export { buttonVariants }
export type { ButtonProps }
