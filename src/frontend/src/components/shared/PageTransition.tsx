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
import { EASE, DURATION, REDUCED_MOTION } from './AnimationConfig'

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

function getDirection(from: InterfaceType, to: InterfaceType): number {
  return interfaceOrder[to] - interfaceOrder[from]
}

function getTransitionType(from: InterfaceType, to: InterfaceType): 'slide' | 'fold' {
  const pair = [from, to].sort((a, b) => interfaceOrder[a] - interfaceOrder[b]).join('-')
  if (pair === 'settings-writing') {
    return 'fold'
  }
  return 'slide'
}

/** GPU-accelerated slide variants: only transform + opacity */
const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '5%' : '-5%',
    opacity: 0,
    scale: 0.99,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-4%' : '4%',
    opacity: 0,
    scale: 0.99,
  }),
}

/** Fold variants for Settings↔Writing */
const foldVariants: Variants = {
  enter: (isForwardDir: boolean) => ({
    y: isForwardDir ? '6%' : '-6%',
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (isForwardDir: boolean) => ({
    y: isForwardDir ? '-4%' : '4%',
    opacity: 0,
    scale: 0.98,
  }),
}

/**
 * PageTransition - Three-interface switching animation
 *
 * Features:
 * - Bidirectional sliding with auto-detected direction
 * - GPU-accelerated: only transform and opacity
 * - Supports prefers-reduced-motion
 * - Unified easing from AnimationConfig
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

  const variants = isFirstRender.current
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : reducedMotion
      ? REDUCED_MOTION
      : transitionType === 'fold'
        ? foldVariants
        : slideVariants

  const transition: Transition = reducedMotion
    ? { opacity: { duration: DURATION.FAST } }
    : {
        x: { duration: DURATION.NORMAL, ease: EASE.OUT },
        y: { duration: DURATION.NORMAL, ease: EASE.OUT },
        opacity: { duration: DURATION.NORMAL, ease: EASE.OUT },
        scale: { duration: DURATION.NORMAL, ease: EASE.OUT },
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
 */
interface StaggeredPageTransitionProps extends PageTransitionProps {
  staggerDelay?: number
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
        transition={{ duration: DURATION.SLOW, ease: EASE.OUT }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

