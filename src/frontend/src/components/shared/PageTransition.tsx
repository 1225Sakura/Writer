/**
 * PageTransition - Enhanced three-interface switching with smoother transitions
 *
 * Uses Framer Motion's AnimatePresence + motion.div
 * Implements direction-aware slide/fade/scale combinations
 * Supports bidirectional sliding, depth layering, and spring physics
 *
 * Animation only uses transform and opacity, avoiding layout property animations
 * Ensures writing performance is not affected
 * Supports prefers-reduced-motion
 *
 * Design spec (DESIGN_VISUAL.md):
 * - Chat→Settings: 350ms, slide right + fade
 * - Settings→Writing: 400ms, fold down + fade
 * - Writing→Settings: 350ms, unfold up + fade
 * - Easing: cubic-bezier(0.22, 1, 0.36, 1)
 */

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, type Variants, type Transition } from 'framer-motion'
import type { ReactNode } from 'react'
import type { InterfaceType } from '@/store/uiStore'
import { usePrefersReducedMotion } from '@/hooks'

interface PageTransitionProps {
  children: ReactNode
  interfaceType: InterfaceType
  className?: string
}

const interfaceOrder: Record<InterfaceType, number> = {
  chat: 0,
  settings: 1,
  writing: 2,
  global: 3,
}

/** Design spec easing */
const EASE_OUT = [0.22, 1, 0.36, 1] as const

/**
 * Calculate slide direction
 * Positive = right (new interface on right, slides in from right)
 * Negative = left (new interface on left, slides in from left)
 */
function getDirection(from: InterfaceType, to: InterfaceType): number {
  return interfaceOrder[to] - interfaceOrder[from]
}

/**
 * Get transition type based on page switch combination
 * Settings↔Writing uses special fold animation
 */
function getTransitionType(from: InterfaceType, to: InterfaceType): 'slide' | 'fold' | 'depth' {
  const pair = [from, to].sort((a, b) => interfaceOrder[a] - interfaceOrder[b]).join('-')
  if (pair === 'settings-writing') {
    return 'fold'
  }
  if (pair === 'chat-settings') {
    return 'depth'
  }
  return 'slide'
}

/** Enhanced slide + fade + subtle scale */
const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '6%' : '-6%',
    opacity: 0,
    scale: 0.985,
    filter: 'blur(2px)',
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-5%' : '5%',
    opacity: 0,
    scale: 0.985,
    filter: 'blur(2px)',
  }),
}

/** Fold animation variants - for Settings↔Writing */
const foldVariants: Variants = {
  enter: (isForwardDir: boolean) => ({
    y: isForwardDir ? '5%' : '-5%',
    opacity: 0,
    scale: 0.98,
    rotateX: isForwardDir ? 2 : -2,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
    rotateX: 0,
  },
  exit: (isForwardDir: boolean) => ({
    y: isForwardDir ? '-4%' : '4%',
    opacity: 0,
    scale: 0.98,
    rotateX: isForwardDir ? -2 : 2,
  }),
}

/** Depth animation - for Chat→Settings with z-layering */
const depthVariants: Variants = {
  enter: {
    x: '4%',
    opacity: 0,
    scale: 0.99,
    zIndex: 2,
  },
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    zIndex: 1,
  },
  exit: {
    x: '-3%',
    opacity: 0,
    scale: 0.99,
    zIndex: 0,
  },
}

/** Reduced motion version: fade only */
const reducedMotionVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

/**
 * PageTransition - Three-interface switching animation
 *
 * Features:
 * - Bidirectional sliding: auto-detects slide direction based on interface order
 * - Fade + micro-scale: more natural visual transition
 * - Special fold animation for Settings↔Writing
 * - Depth layering for Chat→Settings
 * - GPU acceleration: only uses transform and opacity
 * - Supports prefers-reduced-motion
 * - Spring physics for organic feel
 * - Design spec easing: cubic-bezier(0.22, 1, 0.36, 1)
 */
export function PageTransition({ children, interfaceType, className }: PageTransitionProps) {
  const [prevInterface, setPrevInterface] = useState<InterfaceType>(interfaceType)
  const reducedMotion = usePrefersReducedMotion()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (interfaceType !== prevInterface) {
      setPrevInterface(interfaceType)
    }
  }, [interfaceType, prevInterface])

  const direction = getDirection(prevInterface, interfaceType)
  const transitionType = getTransitionType(prevInterface, interfaceType)

  // First render has no animation
  const variants = isFirstRender.current
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : reducedMotion
      ? reducedMotionVariants
      : transitionType === 'fold'
        ? foldVariants
        : transitionType === 'depth'
          ? depthVariants
          : slideVariants

  // Different transition configs based on switch type
  const transition: Transition = reducedMotion
    ? { opacity: { duration: 0.15 } }
    : transitionType === 'fold'
      ? {
          y: { duration: 0.38, ease: EASE_OUT },
          opacity: { duration: 0.32, ease: EASE_OUT },
          scale: { duration: 0.38, ease: EASE_OUT },
          rotateX: { duration: 0.38, ease: EASE_OUT },
          filter: { duration: 0.3 },
        }
      : transitionType === 'depth'
        ? {
            x: { duration: 0.32, ease: EASE_OUT },
            opacity: { duration: 0.28, ease: EASE_OUT },
            scale: { duration: 0.32, ease: EASE_OUT },
            filter: { duration: 0.25 },
          }
        : {
            x: { duration: 0.32, ease: EASE_OUT },
            opacity: { duration: 0.26, ease: EASE_OUT },
            scale: { duration: 0.32, ease: EASE_OUT },
            filter: { duration: 0.25 },
          }

  useEffect(() => {
    isFirstRender.current = false
  }, [])

  return (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <motion.div
        key={interfaceType}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={transition}
        style={{
          willChange: 'transform, opacity',
          transformOrigin: 'center center',
          perspective: 1200,
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * StaggeredPageTransition - Page transition with staggered child animations
 * Useful for pages with multiple sections that should animate in sequence
 */
interface StaggeredPageTransitionProps extends PageTransitionProps {
  staggerDelay?: number
  childSelector?: string
}

export function StaggeredPageTransition({
  children,
  interfaceType,
  className,
  staggerDelay = 0.05,
}: StaggeredPageTransitionProps) {
  const [prevInterface, setPrevInterface] = useState<InterfaceType>(interfaceType)
  const reducedMotion = usePrefersReducedMotion()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (interfaceType !== prevInterface) {
      setPrevInterface(interfaceType)
    }
  }, [interfaceType, prevInterface])

  const direction = getDirection(prevInterface, interfaceType)

  const containerVariants: Variants = {
    enter: {
      opacity: 0,
      x: direction > 0 ? '4%' : '-4%',
    },
    center: {
      opacity: 1,
      x: 0,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.05,
      },
    },
    exit: {
      opacity: 0,
      x: direction > 0 ? '-3%' : '3%',
      transition: {
        staggerChildren: staggerDelay * 0.5,
        staggerDirection: -1,
      },
    },
  }

  const variants = isFirstRender.current || reducedMotion
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : containerVariants

  useEffect(() => {
    isFirstRender.current = false
  }, [])

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={interfaceType}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

