/**
 * PageTransition - 三界面切换时的平滑过渡
 *
 * 使用 Framer Motion 的 AnimatePresence + motion.div
 * 实现当前页面向左滑出+淡出，新页面从右侧滑入+淡入
 * 支持双向滑动（根据界面顺序决定滑动方向）
 *
 * 动画仅使用 transform 和 opacity，避免 layout 属性动画
 * 确保写作性能不受影响
 * 支持 prefers-reduced-motion
 *
 * 设计规范 (DESIGN_VISUAL.md):
 * - Chat→Settings: 350ms, 向右滑出 + 淡入
 * - Settings→Writing: 400ms, 向下折叠 + 淡入
 * - Writing→Settings: 350ms, 向上展开 + 淡入
 * - Easing: cubic-bezier(0.22, 1, 0.36, 1)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
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

/** 设计规范 easing */
const EASE_OUT = [0.22, 1, 0.36, 1] as const
const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const

/**
 * 计算滑动方向
 * 正数 = 向右（新界面在右侧，从右往左滑入）
 * 负数 = 向左（新界面在左侧，从左往右滑入）
 */
function getDirection(from: InterfaceType, to: InterfaceType): number {
  return interfaceOrder[to] - interfaceOrder[from]
}

/** 判断是否为前进方向（界面序号增大） */
function isForward(from: InterfaceType, to: InterfaceType): boolean {
  return interfaceOrder[to] > interfaceOrder[from]
}

/**
 * 根据页面切换组合获取过渡类型
 * Settings↔Writing 使用特殊的折叠动画
 */
function getTransitionType(from: InterfaceType, to: InterfaceType): 'slide' | 'fold' {
  const pair = [from, to].sort((a, b) => interfaceOrder[a] - interfaceOrder[b]).join('-')
  if (pair === 'settings-writing' || pair === 'writing-settings') {
    return 'fold'
  }
  return 'slide'
}

/** 流畅的 slide + fade 组合动画 - 优化的滑动距离 */
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

/** 折叠动画变体 - 用于 Settings↔Writing 切换 */
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

/** 减少动画版本：仅淡入淡出 */
const reducedMotionVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

/**
 * PageTransition - 三界面切换动画
 *
 * 特性：
 * - 双向滑动：根据界面顺序自动判断滑动方向
 * - 淡入淡出 + 微缩放：更自然的视觉过渡
 * - 特殊折叠动画用于 Settings↔Writing 切换
 * - GPU 加速：仅使用 transform 和 opacity
 * - 支持 prefers-reduced-motion
 * - 设计规范 easing: cubic-bezier(0.22, 1, 0.36, 1)
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
  const forward = isForward(prevInterface, interfaceType)
  const transitionType = getTransitionType(prevInterface, interfaceType)

  // 首次渲染无动画
  const variants = isFirstRender.current
    ? { enter: { opacity: 1 }, center: { opacity: 1 }, exit: { opacity: 0 } }
    : reducedMotion
      ? reducedMotionVariants
      : transitionType === 'fold'
        ? foldVariants
        : slideVariants

  // 根据切换类型使用不同的过渡配置
  const transition: Transition = reducedMotion
    ? { opacity: { duration: 0.15 } }
    : transitionType === 'fold'
      ? {
          y: { duration: 0.35, ease: EASE_OUT },
          opacity: { duration: 0.3, ease: EASE_OUT },
          scale: { duration: 0.35, ease: EASE_OUT },
        }
      : {
          x: { duration: 0.3, ease: EASE_OUT },
          opacity: { duration: 0.25, ease: EASE_OUT },
          scale: { duration: 0.3, ease: EASE_OUT },
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
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
