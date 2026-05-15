import type { ButtonProps } from './ButtonVariants'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/** Loading spinner with Framer Motion */
export function LoadingSpinner({ size }: { size: ButtonProps['size'] }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const sizeMap = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5', icon: 'w-4 h-4' }
  const cls = sizeMap[size || 'md']
  return (
    <motion.span
      className={cn('inline-flex items-center justify-center', cls)}
      animate={prefersReducedMotion ? {} : { rotate: 360 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, repeat: Infinity, ease: 'linear' }}
    >
      <Loader2 className={cn('text-current', cls)} />
    </motion.span>
  )
}

/** Ripple effect */
export function Ripple({ x, y, onComplete }: { x: number; y: number; onComplete: () => void }) {
  return (
    <motion.span
      className="absolute rounded-full pointer-events-none"
      style={{
        left: x,
        top: y,
        background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-100) 20%, transparent) 0%, color-mix(in srgb, var(--accent-100) 8%, transparent) 40%, transparent 70%)',
      }}
      initial={{ width: 0, height: 0, x: 0, y: 0, opacity: 0.6 }}
      animate={{ width: 240, height: 240, x: -120, y: -120, opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      onAnimationComplete={onComplete}
    />
  )
}

/** Premium variant gradient background */
export function PremiumBackground({ isHovered, isPressed }: { isHovered: boolean; isPressed: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, var(--accent-100) 15%, transparent) 0%, color-mix(in srgb, var(--accent-90) 8%, transparent) 50%, color-mix(in srgb, var(--accent-100) 10%, transparent) 100%)`,
      }}
      animate={{ opacity: isHovered ? 1 : 0.6, scale: isPressed ? 0.98 : 1 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    />
  )
}

/** Premium variant animated glow border */
export function PremiumGlowBorder({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        padding: '1px',
        background: `linear-gradient(135deg, color-mix(in srgb, var(--accent-100) 50%, transparent), color-mix(in srgb, var(--accent-90) 30%, transparent), color-mix(in srgb, var(--accent-100) 40%, transparent))`,
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
export function InkInnerGlow({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      style={{
        background: `radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--paper-100) 4%, transparent) 0%, transparent 60%)`,
      }}
      animate={{ opacity: isHovered ? 1 : 0.5 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    />
  )
}

/** Paper variant shadow */
export function PaperShadow({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.span
      className="absolute inset-0 rounded-inherit pointer-events-none"
      animate={{
        boxShadow: isHovered
          ? '0 2px 8px color-mix(in srgb, var(--ink-100) 8%, transparent), 0 1px 3px color-mix(in srgb, var(--ink-100) 6%, transparent)'
          : '0 1px 3px color-mix(in srgb, var(--ink-100) 4%, transparent)',
      }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
    />
  )
}
