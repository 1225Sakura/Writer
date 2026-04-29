import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/hooks'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


// ============================================================
// BUTTON VARIANTS (cva)
// Unified variant system: default, ghost, subtle, accent, danger, glass
// Sizes: sm, md, lg, icon
// ============================================================

const buttonVariants = cva(
  'relative inline-flex items-center justify-center font-[510] cursor-pointer overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
        ghost:
          'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] border border-transparent',
        subtle:
          'bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.08)] active:bg-[rgba(255,255,255,0.12)] border border-[var(--border-default)]',
        accent:
          'bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
        danger:
          'bg-[var(--color-danger)] text-white hover:brightness-110 active:brightness-90',
        glass:
          'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.1)] active:bg-[rgba(255,255,255,0.08)]',
        outline:
          'bg-transparent text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[rgba(255,255,255,0.06)] active:bg-[rgba(255,255,255,0.1)]',
        secondary:
          'bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[rgba(255,255,255,0.1)] active:bg-[rgba(255,255,255,0.08)]',
        ink:
          'bg-[var(--ink-90)] text-[var(--paper-100)] border border-[var(--ink-70)] hover:bg-[var(--ink-85)] active:bg-[var(--ink-80)]',
        paper:
          'bg-[var(--paper-100)] text-[var(--ink-90)] border border-[var(--paper-80)] hover:bg-[var(--paper-95)] active:bg-[var(--paper-90)]',
        gradient:
          'bg-transparent text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
        premium:
          'bg-[var(--color-surface-raised)] text-[var(--text-primary)] border border-[var(--border-default)]',
        glow:
          'bg-[var(--accent-primary)] text-[var(--text-primary)] hover:brightness-110 active:brightness-90',
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

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Loading spinner with Framer Motion */
function LoadingSpinner({ size }: { size: ButtonProps['size'] }) {
  const sizeMap = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5', icon: 'w-4 h-4' }
  const cls = sizeMap[size || 'md']
  return (
    <motion.span
      className={cn('inline-flex items-center justify-center', cls)}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    >
      <Loader2 className={cn('text-current', cls)} />
    </motion.span>
  )
}

/** Ripple effect */
function Ripple({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  return (
    <motion.span
      className="absolute rounded-full pointer-events-none"
      style={{
        left: x,
        top: y,
        background: 'radial-gradient(circle, rgba(94, 106, 210, 0.2) 0%, rgba(94, 106, 210, 0.08) 40%, transparent 70%)',
      }}
      initial={{ width: 0, height: 0, x: 0, y: 0, opacity: 0.6 }}
      animate={{ width: 240, height: 240, x: -120, y: -120, opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      onAnimationComplete={onComplete}
    />
  )
}

/** Premium variant gradient background */
function PremiumBackground({ isHovered, isPressed }: { isHovered: boolean; isPressed: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.15) 0%, rgba(94, 181, 166, 0.08) 50%, rgba(232, 184, 125, 0.1) 100%)',
      }}
      animate={{ opacity: isHovered ? 1 : 0.6, scale: isPressed ? 0.98 : 1 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    />
  )
}

/** Premium variant animated glow border */
function PremiumGlowBorder({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        padding: '1px',
        background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.5), rgba(94, 181, 166, 0.3), rgba(232, 184, 125, 0.4))',
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
        borderRadius: 'inherit',
      }}
      animate={{ opacity: isHovered ? 1 : 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    />
  )
}

/** Ink variant inner glow */
function InkInnerGlow({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(245, 240, 230, 0.04) 0%, transparent 60%)',
      }}
      animate={{ opacity: isHovered ? 1 : 0.5 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    />
  )
}

/** Paper variant shadow */
function PaperShadow({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      animate={{
        boxShadow: isHovered
          ? '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)'
          : '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    />
  )
}

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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
          'disabled:pointer-events-none disabled:opacity-50',
          'transition-all duration-[var(--transition-base)] ease-out',
          className
        )}
        style={{
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          ...(isGlass || isGlow
            ? {
                boxShadow: `0 0 16px ${glowColor}40, 0 0 32px ${glowColor}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
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
              background: `radial-gradient(circle at 50% 50%, ${glowColor}40 0%, transparent 70%)`,
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
              background: `radial-gradient(circle at 50% 50%, ${glowColor}20 0%, transparent 60%)`,
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
            <span className="absolute inset-0 rounded-inherit pointer-events-none opacity-[0.03] bg-gradient-to-b from-white to-transparent" />
          )}
      </Comp>
    )
  }
)

Button.displayName = 'Button'

export { buttonVariants }
