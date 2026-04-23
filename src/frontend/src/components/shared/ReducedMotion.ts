/**
 * ReducedMotion utility - provides reduced motion configuration
 * for components that don't use the centralized animations.ts
 */

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

/**
 * Get animation config that respects reduced motion preference
 */
export function useReducedMotionConfig(defaultConfig: {
  animate?: any
  transition?: any
}) {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (prefersReducedMotion) {
    return {
      animate: {},
      transition: { duration: 0 },
    }
  }

  return defaultConfig
}

/**
 * Check if we should skip animation entirely
 */
export function shouldSkipAnimation(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}