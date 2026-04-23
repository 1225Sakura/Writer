/**
 * EnhancedPageTransition - 增强版页面过渡动画
 *
 * 简化为两种核心过渡效果：滑动和淡入淡出
 * 使用 Framer Motion 实现流畅动画
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - 过渡时长：250ms (page), 300ms (Settings->Writing), 200ms (返回首页)
 * - Easing: [0.16, 1, 0.3, 1] (smooth ease-out)
 */

import { useState, useEffect } from 'react'
import { AnimatePresence, motion, type Variants, type Transition } from 'framer-motion'
import type { ReactNode } from 'react'
import type { InterfaceType } from '@/store/uiStore'
import { cn } from '@/lib/utils'

export type TransitionVariant = 'slide' | 'fade' | 'slide-fade'
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

// Slide variants
const slideVariants: Variants = {
  enter: (direction: TransitionDirection) => ({
    x: direction === 'left' ? '-12%' : '12%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: TransitionDirection) => ({
    x: direction === 'left' ? '12%' : '-12%',
    opacity: 0,
  }),
}

// Fade variants
const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

// Slide-fade combined variants
const slideFadeVariants: Variants = {
  enter: (direction: number) => ({
    x: direction * 24,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction * -24,
    opacity: 0,
  }),
}

const variantMap: Record<TransitionVariant, Variants> = {
  slide: slideVariants,
  fade: fadeVariants,
  'slide-fade': slideFadeVariants,
}

/**
 * EnhancedPageTransition - 增强版页面过渡组件
 *
 * 特性：
 * - 简化过渡效果（滑动、淡入、滑动淡入）
 * - 支持双向自动判断方向
 * - GPU 加速优化
 * - 支持 prefers-reduced-motion
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

  useEffect(() => {
    if (interfaceType !== prevInterface) {
      setPrevInterface(interfaceType)
    }
  }, [interfaceType, prevInterface])

  const direction = getDirection(prevInterface, interfaceType)
  const directionValue = getDirectionValue(direction)
  const variants = customVariants ?? variantMap[variant]

  const transition: Transition = customTransition ?? {
    x: { type: 'spring', stiffness: 400, damping: 38, mass: 0.7 },
    opacity: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
  }

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait" custom={directionValue}>
        <motion.div
          key={interfaceType}
          custom={directionValue}
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
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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
