import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Slot } from '@radix-ui/react-slot'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
    | 'premium'
    | 'ink'
    | 'paper'
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
  premium: 'text-[var(--text-primary)]',
  ink: 'text-[var(--paper-100)]',
  paper: 'text-[var(--ink-100)]',
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
  premium: 'transparent',
  ink: 'var(--ink-90)',
  paper: 'var(--paper-100)',
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
  premium: '',
  ink: 'hover:bg-[var(--ink-85)] active:bg-[var(--ink-80)]',
  paper: 'hover:bg-[var(--paper-95)] active:bg-[var(--paper-90)]',
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
  premium: 'border border-[var(--border-default)]',
  ink: 'border border-[var(--ink-70)] hover:border-[var(--ink-60)]',
  paper: 'border border-[var(--paper-80)] hover:border-[var(--paper-75)]',
}

/** Premium variant: subtle gradient overlay with glow on hover */
function PremiumBackground({ isHovered, isPressed }: { isHovered: boolean; isPressed: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.15) 0%, rgba(94, 181, 166, 0.08) 50%, rgba(232, 184, 125, 0.1) 100%)',
      }}
      animate={{
        opacity: isHovered ? 1 : 0.6,
        scale: isPressed ? 0.98 : 1,
      }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    />
  )
}

/** Premium variant: animated glow border on hover */
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
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    />
  )
}

/** Ink variant: subtle inner glow for writing interface */
function InkInnerGlow({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(245, 240, 230, 0.04) 0%, transparent 60%)',
      }}
      animate={{ opacity: isHovered ? 1 : 0.5 }}
      transition={{ duration: 0.2 }}
    />
  )
}

/** Paper variant: subtle shadow for light theme feel */
function PaperShadow({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      animate={{
        boxShadow: isHovered
          ? '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.06)'
          : '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    />
  )
}

/** Enhanced loading spinner with Framer Motion */
function LoadingSpinner({ size }: { size: ButtonProps['size'] }) {
  const sizeMap = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    icon: 'w-4 h-4',
  }

  return (
    <motion.span
      className={twMerge('inline-flex items-center justify-center', sizeMap[size || 'md'])}
      animate={{ rotate: 360 }}
      transition={{
        duration: 0.8,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <Loader2 className={twMerge('text-current', sizeMap[size || 'md'])} />
    </motion.span>
  )
}

/** Ripple effect with improved animation */
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
    const [isHovered, setIsHovered] = React.useState(false)

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

    const isGlow = variant === 'glow'
    const isPremium = variant === 'premium'
    const isInk = variant === 'ink'
    const isPaper = variant === 'paper'
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
            ...(isPremium ? {
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
            } : {}),
          }
        }
        onClick={handleClick}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => { setIsPressed(false); setIsHovered(false) }}
        onMouseEnter={() => setIsHovered(true)}
        {...props}
      >
        {/* Glow variant animated background */}
        {isGlow && (
          <motion.span
            className="absolute inset-0 rounded-inherit pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${glowColor}40 0%, transparent 70%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Glow pulse animation */}
        {isGlow && (
          <motion.span
            className="absolute inset-0 glow pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${glowColor}20 0%, transparent 60%)`,
            }}
            animate={{
              opacity: [0.3, 0.5, 0.3],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
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

        {/* Gradient background for gradient variant */}
        {variant === 'gradient' && (
          <span
            className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]"
          />
        )}

        {/* Content wrapper */}
        <span className="relative z-10 inline-flex flex-row items-center justify-center gap-2">
          {loading ? (
            <LoadingSpinner size={size} />
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

        {/* Ripple effects with AnimatePresence */}
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

        {/* Inner highlight for raised variants */}
        {!isDisabled && variant !== 'outline' && variant !== 'ghost' && variant !== 'ghostHover' && (
          <span className="absolute inset-0 rounded-inherit pointer-events-none opacity-[0.03] bg-gradient-to-b from-white to-transparent" />
        )}
      </Comp>
    )
  }
)

Button.displayName = 'Button'
