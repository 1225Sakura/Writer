/**
 * MicroInteractionsButtons - Button feedback and card/input effects
 *
 * Provides RippleEffect, ButtonFeedback, PressFeedback for button interactions,
 * plus StaggerListEntrance, CardHoverGlow, InputFocusGlow for container effects.
 */

import * as React from 'react'
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { easeOutSmooth, useReducedMotion } from './MicroInteractionsVariants'

// ==================== Ripple Effect ====================

interface RippleEffectProps extends HTMLMotionProps<'span'> {
  color?: string
}

/**
 * RippleEffect - Ripple click effect
 * Only triggers on click, not persistent
 */
export function RippleEffect({ color = 'rgba(255, 255, 255, 0.2)', ...props }: RippleEffectProps) {
  return (
    <motion.span
      {...props}
      className={cn('absolute inset-0 pointer-events-none', props.className)}
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 0.35, ease: easeOutSmooth }}
      style={{
        backgroundColor: color,
        borderRadius: '50%',
        width: '100%',
        height: '100%',
      }}
    />
  )
}

// ==================== Button Feedback ====================

/**
 * ButtonFeedback - Button feedback wrapper
 * Wraps a button to provide click feedback with optional ripple
 */
export function ButtonFeedback({
  children,
  className,
  ripple = false,
  rippleColor,
  scaleOnClick = true,
  ...props
}: {
  children: ReactNode
  className?: string
  ripple?: boolean
  rippleColor?: string
  scaleOnClick?: boolean
} & Omit<HTMLMotionProps<'button'>, 'children'>) {
  const [isPressed, setIsPressed] = React.useState(false)
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      className={cn('relative overflow-hidden cursor-pointer', className)}
      whileHover={reducedMotion ? undefined : { opacity: 0.9 }}
      whileTap={scaleOnClick && !reducedMotion ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      {...props}
    >
      {children}
      {ripple && isPressed && !reducedMotion && <RippleEffect color={rippleColor} />}
    </motion.button>
  )
}

// ==================== Press Feedback ====================

interface PressFeedbackProps extends HTMLMotionProps<'button'> {
  children: ReactNode
  hoverScale?: number
  pressScale?: number
}

/**
 * PressFeedback - Button press feedback
 * Slightly enlarges on hover, slightly shrinks on press
 */
export function PressFeedback({
  children,
  className,
  hoverScale = 1.02,
  pressScale = 0.97,
  ...props
}: PressFeedbackProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.button
      className={cn('relative cursor-pointer', className)}
      whileHover={reducedMotion ? undefined : { scale: hoverScale }}
      whileTap={reducedMotion ? undefined : { scale: pressScale }}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

// ==================== Stagger List Entrance ====================

interface StaggerListProps {
  children: ReactNode[]
  className?: string
  itemClassName?: string
  staggerDelay?: number
  initialDelay?: number
  direction?: 'up' | 'down' | 'left' | 'right'
}

/**
 * StaggerListEntrance - Staggered list item entrance animation
 * Children appear sequentially with fade + translate
 */
export function StaggerListEntrance({
  children,
  className,
  itemClassName,
  staggerDelay = 0.05,
  initialDelay = 0,
  direction = 'up',
}: StaggerListProps) {
  const reducedMotion = useReducedMotion()

  const directionOffset = {
    up: { y: 8 },
    down: { y: -8 },
    left: { x: 8 },
    right: { x: -8 },
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, ...directionOffset[direction] },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        delay: initialDelay + i * staggerDelay,
        duration: 0.3,
        ease: easeOutSmooth,
      },
    }),
  }

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <div className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          custom={i}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className={itemClassName}
        >
          {child}
        </motion.div>
      ))}
    </div>
  )
}

// ==================== Card Hover Glow ====================

interface CardHoverGlowProps extends HTMLMotionProps<'div'> {
  children: ReactNode
  glowColor?: string
  glowIntensity?: number
}

/**
 * CardHoverGlow - Card hover glow expansion
 * Card lifts and expands glow effect on hover
 */
export function CardHoverGlow({
  children,
  className,
  glowColor = 'var(--glow-primary)',
  glowIntensity = 1,
  ...props
}: CardHoverGlowProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      className={cn('relative', className)}
      initial={{ y: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' }}
      whileHover={
        reducedMotion
          ? undefined
          : {
              y: -2,
              boxShadow: `0 0 ${20 * glowIntensity}px ${glowColor}, 0 0 ${40 * glowIntensity}px ${glowColor}, 0 8px 24px rgba(0, 0, 0, 0.12)`,
            }
      }
      transition={{ duration: 0.25, ease: easeOutSmooth }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

// ==================== Input Focus Glow ====================

interface InputFocusGlowProps extends React.InputHTMLAttributes<HTMLInputElement> {
  glowColor?: string
  containerClassName?: string
}

/**
 * InputFocusGlow - Input focus glow expansion
 * Expands glow effect on focus
 */
export function InputFocusGlow({
  className,
  containerClassName,
  glowColor = 'var(--glow-primary-sm)',
  onFocus,
  onBlur,
  ...props
}: InputFocusGlowProps) {
  const [isFocused, setIsFocused] = React.useState(false)
  const reducedMotion = useReducedMotion()

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }

  const glowStyle = isFocused && !reducedMotion
    ? {
        boxShadow: `0 0 0 3px ${glowColor}, 0 0 12px ${glowColor}`,
        borderColor: 'var(--border-focus)',
      }
    : {}

  return (
    <motion.div
      className={cn('relative', containerClassName)}
      animate={glowStyle as any}
      transition={{ duration: 0.2, ease: easeOutSmooth }}
    >
      <input
        className={cn(
          'w-full rounded-lg border border-border-default bg-elevation-2 px-3 py-2',
          'text-sm text-text-primary placeholder:text-text-tertiary',
          'focus:outline-none focus:border-border-focus',
          'transition-colors duration-200',
          className
        )}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
        aria-label={props['aria-label'] ?? '输入'}
      />
    </motion.div>
  )
}
