/**
 * EnhancedPageTransition - 增强版页面过渡动画
 *
 * 简化为两种核心过渡效果：滑动和淡入淡出
 * 使用 Framer Motion 实现流畅动画
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - Chat→Settings: 350ms, 向右滑出 + 淡入
 * - Settings↔Writing: 350-400ms, 折叠/展开动画
 * - Easing: cubic-bezier(0.22, 1, 0.36, 1)
 */

import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion, type Variants, type Transition } from 'framer-motion'
import type { ReactNode } from 'react'
import type { InterfaceType } from '@/store/uiStore'
import { usePrefersReducedMotion } from '@/hooks'
import { cn } from '@/lib/utils'
import { EASE, DURATION, REDUCED_MOTION } from './AnimationConfig'

export type TransitionVariant = 'slide' | 'fade' | 'slide-fade' | 'fold'
export type TransitionDirection = 'forward' | 'backward' | 'left' | 'right'

interface PageTransitionProps {
  children: ReactNode
  interfaceType: InterfaceType
  className?: string
  variant?: TransitionVariant
}

interface EnhancedPageTransitionProps extends PageTransitionProps {
  customVariants?: Variants
  customTransition?: Transition
}

const interfaceOrder: Record<InterfaceType, number> = {
  chat: 0,
  settings: 1,
  writing: 2,
  global: 3,
}

function getDirection(from: InterfaceType, to: InterfaceType): TransitionDirection {
  const diff = interfaceOrder[to] - interfaceOrder[from]
  if (diff > 0) return 'forward'
  if (diff < 0) return 'backward'
  return 'forward'
}

function getDirectionValue(direction: TransitionDirection): number {
  switch (direction) {
    case 'forward':
    case 'right':
      return 1
    case 'backward':
    case 'left':
      return -1
    default:
      return 0
  }
}

const slideVariants: Variants = {
  enter: (direction: TransitionDirection) => ({
    x: direction === 'left' ? '-5%' : '5%',
    opacity: 0,
    scale: 0.99,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: TransitionDirection) => ({
    x: direction === 'left' ? '4%' : '-4%',
    opacity: 0,
    scale: 0.99,
  }),
}

const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

const slideFadeVariants: Variants = {
  enter: (direction: number) => ({
    x: direction * 16,
    opacity: 0,
    scale: 0.99,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({
    x: direction * -12,
    opacity: 0,
    scale: 0.99,
  }),
}

const foldVariants: Variants = {
  enter: (isForward: boolean) => ({
    y: isForward ? '6%' : '-6%',
    opacity: 0,
    scale: 0.98,
  }),
  center: { y: 0, opacity: 1, scale: 1 },
  exit: (isForward: boolean) => ({
    y: isForward ? '-4%' : '4%',
    opacity: 0,
    scale: 0.98,
  }),
}

const variantMap: Record<TransitionVariant, Variants> = {
  slide: slideVariants,
  fade: fadeVariants,
  'slide-fade': slideFadeVariants,
  fold: foldVariants,
}

/**
 * EnhancedPageTransition - Enhanced page transition component
 *
 * Features:
 * - Simplified transitions (slide, fade, slide-fade, fold)
 * - Auto-detected bidirectional direction
 * - GPU acceleration (transform + opacity only)
 * - Supports prefers-reduced-motion
 * - Unified easing from AnimationConfig
 */
export function EnhancedPageTransition({
  children,
  interfaceType,
  className,
  variant = 'slide-fade',
  customVariants,
  customTransition,
}: EnhancedPageTransitionProps) {
  const [prevInterface, setPrevInterface] = useState<InterfaceType>(interfaceType)
  const reducedMotion = usePrefersReducedMotion()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (interfaceType !== prevInterface) {
      setPrevInterface(interfaceType)
    }
  }, [interfaceType, prevInterface])

  const direction = getDirection(prevInterface, interfaceType)
  const directionValue = getDirectionValue(direction)
  const isForward = interfaceOrder[interfaceType] > interfaceOrder[prevInterface]

  const variants = isFirstRender.current
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : reducedMotion
      ? REDUCED_MOTION
      : (customVariants ?? variantMap[variant])

  const transition: Transition = customTransition ?? (
    reducedMotion
      ? { opacity: { duration: DURATION.FAST } }
      : {
          x: { duration: DURATION.NORMAL, ease: EASE.OUT },
          y: { duration: DURATION.NORMAL, ease: EASE.OUT },
          opacity: { duration: DURATION.NORMAL, ease: EASE.OUT },
          scale: { duration: DURATION.NORMAL, ease: EASE.OUT },
        }
  )

  useEffect(() => {
    isFirstRender.current = false
  }, [])

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait" custom={variant === 'fold' ? isForward : directionValue} initial={false}>
        <motion.div
          key={interfaceType}
          custom={variant === 'fold' ? isForward : directionValue}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          style={{ willChange: 'transform, opacity' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * PageIndicator - Page switching indicator
 */
export function PageIndicator({
  currentIndex,
  total = 3,
}: {
  currentIndex: number
  total?: number
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="flex items-center"
          initial={false}
          animate={{
            width: i === currentIndex ? 20 : 6,
            opacity: i === currentIndex ? 1 : 0.35,
          }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        >
          <div
            className="h-1 rounded-full w-full"
            style={{
              backgroundColor:
                i === currentIndex
                  ? 'var(--accent-primary)'
                  : 'var(--border-strong)',
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

/**
 * usePageTransition - Transition state hook
 */
export function usePageTransition() {
  const [transitionState, setTransitionState] = useState({
    isTransitioning: false,
    from: 'chat' as InterfaceType,
    to: 'chat' as InterfaceType,
  })

  const startTransition = (from: InterfaceType, to: InterfaceType) => {
    setTransitionState({ isTransitioning: true, from, to })
  }

  const endTransition = () => {
    setTransitionState((prev) => ({ ...prev, isTransitioning: false }))
  }

  return {
    ...transitionState,
    startTransition,
    endTransition,
  }
}
