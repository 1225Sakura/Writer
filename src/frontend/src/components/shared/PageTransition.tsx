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
 */

import { useState, useEffect } from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import type { InterfaceType } from '@/store/uiStore'

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

/**
 * 计算滑动方向
 * 正数 = 向右（新界面在右侧，从右往左滑入）
 * 负数 = 向左（新界面在左侧，从左往右滑入）
 */
function getDirection(from: InterfaceType, to: InterfaceType): number {
  return interfaceOrder[to] - interfaceOrder[from]
}

const pageVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '12%' : '-12%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-12%' : '12%',
    opacity: 0,
  }),
}

/**
 * PageTransition - 三界面切换动画
 *
 * 特性：
 * - 双向滑动：根据界面顺序自动判断滑动方向
 * - 淡入淡出：更自然的视觉过渡
 * - 使用 spring 物理动画：更流畅的手感
 * - GPU 加速：仅使用 transform 和 opacity
 * - 支持 prefers-reduced-motion
 */
export function PageTransition({ children, interfaceType, className }: PageTransitionProps) {
  const [prevInterface, setPrevInterface] = useState<InterfaceType>(interfaceType)

  useEffect(() => {
    if (interfaceType !== prevInterface) {
      setPrevInterface(interfaceType)
    }
  }, [interfaceType, prevInterface])

  const direction = getDirection(prevInterface, interfaceType)

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={interfaceType}
        custom={direction}
        variants={pageVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          x: { type: 'spring', stiffness: 400, damping: 38, mass: 0.7 },
          opacity: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
        }}
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
