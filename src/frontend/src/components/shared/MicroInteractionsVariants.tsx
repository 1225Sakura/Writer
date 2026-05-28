/**
 * MicroInteractionsVariants - Shared variants, hooks, and re-exports
 *
 * Provides reusable Framer Motion variants and the useReducedMotion hook
 * used across all micro-interaction components.
 */

import * as React from 'react'
import type { Variants } from 'framer-motion'

import { EASE } from './AnimationConfig'

/** Standard ease-out curve (re-export from AnimationConfig) */
export const easeOutSmooth = EASE.OUT

/** Spring bounce curve (re-export from AnimationConfig) */
export const easeSpring = EASE.BOUNCE

/** Micro-interaction variant collection */
export const microVariants: Record<string, Variants> = {
  /** Button press feedback */
  buttonPress: {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.97 },
  },
  /** List item staggered entrance */
  listItem: {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: easeOutSmooth,
      },
    }),
  },
  /** Card hover glow expansion */
  cardGlow: {
    initial: { boxShadow: '0 0 0 var(--glow-primary-sm)' },
    hover: {
      boxShadow: 'var(--glow-accent), 0 8px 24px color-mix(in srgb, var(--ink-100) 12%, transparent)',
      y: -2,
      transition: { duration: 0.25, ease: easeOutSmooth },
    },
  },
  /** Input focus glow expansion */
  inputGlow: {
    initial: { boxShadow: '0 0 0 0 var(--glow-primary-sm)' },
    focus: {
      boxShadow: '0 0 0 3px var(--glow-primary-sm), 0 0 12px var(--glow-primary-sm)',
      transition: { duration: 0.2, ease: easeOutSmooth },
    },
  },
  /** Fade up */
  fadeUp: {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: easeOutSmooth },
    },
  },
  /** Scale in */
  scaleIn: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.25, ease: easeOutSmooth },
    },
  },
  /** Shake (error feedback) */
  shake: {
    initial: { x: 0 },
    shake: {
      x: [0, -6, 6, -4, 4, -2, 2, 0],
      transition: { duration: 0.4, ease: 'easeInOut' },
    },
  },
}

/** Detect reduced motion (prefers-reduced-motion or low-performance device) */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
