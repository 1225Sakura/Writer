/**
 * RevealContainer - Shared types, animation definitions, and grouped reveal components
 */

import { useState, useEffect, type ReactNode } from 'react'
import { ScrollReveal } from './RevealTrigger'

export type RevealAnimation =
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'blur'
  | 'slide-up-fade'
  | 'slide-up-blur'

/** Standard easing curve: cubic-bezier(0.22, 1, 0.36, 1) */
export const easeOutSmooth = 'cubic-bezier(0.22, 1, 0.36, 1)'

export const animationStyles: Record<RevealAnimation, { initial: React.CSSProperties; animate: React.CSSProperties }> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  'slide-up': {
    initial: { opacity: 0, transform: 'translateY(16px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
  },
  'slide-down': {
    initial: { opacity: 0, transform: 'translateY(-16px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
  },
  'slide-left': {
    initial: { opacity: 0, transform: 'translateX(16px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
  },
  'slide-right': {
    initial: { opacity: 0, transform: 'translateX(-16px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
  },
  scale: {
    initial: { opacity: 0, transform: 'scale(0.96)' },
    animate: { opacity: 1, transform: 'scale(1)' },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(4px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
  },
  'slide-up-fade': {
    initial: { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
    animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
  },
  'slide-up-blur': {
    initial: { opacity: 0, transform: 'translateY(12px)', filter: 'blur(3px)' },
    animate: { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
  },
}

/** Detect whether animations should be reduced */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}

/**
 * ScrollRevealGroup - A group of children that reveal sequentially
 *
 * Automatically adds incrementing delay to each child.
 */
interface ScrollRevealGroupProps {
  children: ReactNode[]
  animation?: RevealAnimation
  staggerDelay?: number
  threshold?: number
  className?: string
  itemClassName?: string
  once?: boolean
  rootMargin?: string
}

export function ScrollRevealGroup({
  children,
  animation = 'slide-up-fade',
  staggerDelay = 50,
  threshold = 0.05,
  className,
  itemClassName,
  once = true,
  rootMargin = '0px 0px -30px 0px',
}: ScrollRevealGroupProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal
          key={i}
          animation={animation}
          delay={i * staggerDelay}
          threshold={threshold}
          rootMargin={rootMargin}
          once={once}
          className={itemClassName}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}
