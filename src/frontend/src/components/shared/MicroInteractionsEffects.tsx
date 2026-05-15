/**
 * MicroInteractionsEffects - Advanced animation effect components
 *
 * Provides ShimmerButton, MagneticEffect, CountUpNumber, ShakeFeedback.
 */

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { easeOutSmooth, useReducedMotion } from './MicroInteractionsVariants'

// ==================== ShimmerButton ====================

interface ShimmerButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode
  variant?: 'default' | 'accent' | 'danger'
  shimmerColor?: string
}

/**
 * ShimmerButton - Button with shimmer animation
 */
export function ShimmerButton({
  children,
  variant = 'default',
  shimmerColor,
  className,
  ...props
}: ShimmerButtonProps) {
  const variantBg = {
    default: 'var(--elevation-2)',
    accent: 'var(--accent-primary)',
    danger: 'var(--color-danger)',
  }

  const defaultShimmer = {
    default: 'rgba(255, 255, 255, 0.04)',
    accent: 'rgba(255, 255, 255, 0.1)',
    danger: 'rgba(255, 255, 255, 0.04)',
  }

  return (
    <motion.button
      className={cn('relative overflow-hidden rounded-lg px-4 py-2 font-medium', className)}
      style={{ backgroundColor: variantBg[variant] }}
      whileHover={{ opacity: 0.9 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1, ease: easeOutSmooth }}
      {...props}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${shimmerColor ?? defaultShimmer[variant]}, transparent)`,
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}

// ==================== MagneticEffect ====================

interface MagneticEffectProps {
  children: ReactNode
  strength?: number
  className?: string
}

/**
 * MagneticEffect - Magnetic hover follow effect
 */
export function MagneticEffect({ children, strength = 0.15, className }: MagneticEffectProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const reducedMotion = useReducedMotion()

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || reducedMotion) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const deltaX = (e.clientX - centerX) * strength
    const deltaY = (e.clientY - centerY) * strength
    setPosition({ x: deltaX, y: deltaY })
  }

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 })
  }

  return (
    <motion.div
      ref={ref}
      className={cn('inline-flex', className)}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  )
}

// ==================== CountUpNumber ====================

interface CountUpNumberProps {
  value: number
  duration?: number
  className?: string
  formatter?: (value: number) => string
}

/**
 * CountUpNumber - Animated number counter
 */
export function CountUpNumber({
  value,
  duration = 0.8,
  className,
  formatter = (v) => v.toString(),
}: CountUpNumberProps) {
  const [displayValue, setDisplayValue] = React.useState(0)
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value)
      return
    }

    let startTime: number | null = null
    const startValue = displayValue

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease out cubic
      setDisplayValue(Math.round(startValue + (value - startValue) * eased))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration, reducedMotion])

  return <span className={className}>{formatter(displayValue)}</span>
}

// ==================== Shake Feedback ====================

interface ShakeFeedbackProps {
  children: ReactNode
  trigger: boolean
  className?: string
}

/**
 * ShakeFeedback - Shake animation for error feedback
 */
export function ShakeFeedback({ children, trigger, className }: ShakeFeedbackProps) {
  return (
    <motion.div
      className={className}
      animate={trigger ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
