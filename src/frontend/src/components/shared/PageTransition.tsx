import { AnimatePresence, motion, Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import type { InterfaceType } from '@/store/uiStore'

interface PageTransitionProps {
  children: ReactNode
  interfaceType: InterfaceType
}

const pageVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
}

const interfaceOrder: Record<InterfaceType, number> = {
  chat: 0,
  settings: 1,
  writing: 2,
}

/**
 * PageTransition - 三界面切换时的平滑过渡
 *
 * 使用 Framer Motion 的 AnimatePresence + motion.div
 * 实现当前页面向左滑出+淡出，新页面从右侧滑入+淡入
 *
 * 动画仅使用 transform 和 opacity，避免 layout 属性动画
 * 确保写作性能不受影响
 */
export function PageTransition({ children, interfaceType }: PageTransitionProps) {
  const direction = interfaceOrder[interfaceType]

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
          x: { type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] },
          opacity: { duration: 0.2, ease: 'easeInOut' },
        }}
        style={{
          willChange: 'transform, opacity',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
