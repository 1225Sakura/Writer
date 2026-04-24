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

export type TransitionVariant = 'slide' | 'fade' | 'slide-fade' | 'fold'
export type TransitionDirection = 'forward' | 'backward' | 'left' | 'right'

interface PageTransitionProps {
  children: ReactNode
  interfaceType: InterfaceType
  className?: string
  variant?: TransitionVariant
}

interface EnhancedPageTransitionProps extends PageTransitionProps {
  /** 自定义进入/退出动画 */
  customVariants?: Variants
  /** 自定义过渡 */
  customTransition?: Transition
}

const interfaceOrder: Record<InterfaceType, number> = {
  chat: 0,
  settings: 1,
  writing: 2,
  global: 3,
}

/** 设计规范 easing */
const EASE_OUT = [0.22, 1, 0.36, 1] as const

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

// Slide variants — 优化的滑动距离
const slideVariants: Variants = {
  enter: (direction: TransitionDirection) => ({
    x: direction === 'left' ? '-5%' : '5%',
    opacity: 0,
    scale: 0.99,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: TransitionDirection) => ({
    x: direction === 'left' ? '4%' : '-4%',
    opacity: 0,
    scale: 0.99,
  }),
}

// Fade variants
const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

// Slide-fade combined variants — 更流畅的复合动画
const slideFadeVariants: Variants = {
  enter: (direction: number) => ({
    x: direction * 16,
    opacity: 0,
    scale: 0.99,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction * -12,
    opacity: 0,
    scale: 0.99,
  }),
}

// Fold variants — 用于 Settings↔Writing 折叠动画
const foldVariants: Variants = {
  enter: (isForward: boolean) => ({
    y: isForward ? '6%' : '-6%',
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    y: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (isForward: boolean) => ({
    y: isForward ? '-4%' : '4%',
    opacity: 0,
    scale: 0.98,
  }),
}

// Reduced motion 版本
const reducedMotionVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

const variantMap: Record<TransitionVariant, Variants> = {
  slide: slideVariants,
  fade: fadeVariants,
  'slide-fade': slideFadeVariants,
  fold: foldVariants,
}

/**
 * EnhancedPageTransition - 增强版页面过渡组件
 *
 * 特性：
 * - 简化过渡效果（滑动、淡入、滑动淡入、折叠）
 * - 支持双向自动判断方向
 * - GPU 加速优化
 * - 支持 prefers-reduced-motion
 * - 设计规范 easing: cubic-bezier(0.22, 1, 0.36, 1)
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

  // 首次渲染无动画，减少动画模式仅淡入淡出
  const variants = isFirstRender.current
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : reducedMotion
      ? reducedMotionVariants
      : (customVariants ?? variantMap[variant])

  const transition: Transition = customTransition ?? (
    reducedMotion
      ? { opacity: { duration: 0.15 } }
      : variant === 'fold'
        ? {
            y: { duration: 0.35, ease: EASE_OUT },
            opacity: { duration: 0.3, ease: EASE_OUT },
            scale: { duration: 0.35, ease: EASE_OUT },
          }
        : variant === 'slide'
          ? {
              x: { duration: 0.3, ease: EASE_OUT },
              opacity: { duration: 0.25, ease: EASE_OUT },
              scale: { duration: 0.3, ease: EASE_OUT },
            }
          : {
              x: { duration: 0.3, ease: EASE_OUT },
              opacity: { duration: 0.25, ease: EASE_OUT },
              scale: { duration: 0.3, ease: EASE_OUT },
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
          style={{
            willChange: 'transform, opacity',
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * PageIndicator - 页面切换指示器
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
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
 * TransitionProvider - 过渡上下文提供者
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
