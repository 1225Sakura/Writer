import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedLayoutProps {
  children: ReactNode
  className?: string
  layoutId?: string
  /** 动画类型 */
  variant?: 'spring' | 'smooth' | 'snappy'
  /** 是否启用布局动画 */
  enabled?: boolean
}

const transitionPresets = {
  spring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  },
  smooth: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
    mass: 1.2,
  },
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 40,
    mass: 0.5,
  },
}

/**
 * AnimatedLayout - 布局变化时的动画 wrapper
 *
 * 使用 Framer Motion 的 layout prop 实现平滑的布局过渡
 * 当子元素的大小或位置发生变化时，自动产生平滑动画
 *
 * 适用于：侧边栏展开/收起、卡片重排、面板大小调整等场景
 */
export function AnimatedLayout({
  children,
  className,
  layoutId,
  variant = 'spring',
  enabled = true,
}: AnimatedLayoutProps) {
  const transition = transitionPresets[variant]

  if (!enabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      layout={layoutId ? true : 'position'}
      layoutId={layoutId}
      transition={transition}
      style={{ willChange: 'transform' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * AnimatedLayoutGroup - 支持子元素布局动画的容器
 *
 * 包裹一组需要布局动画的元素
 */
export function AnimatedLayoutGroup({
  children,
  className,
  variant = 'spring',
}: {
  children: ReactNode
  className?: string
  variant?: 'spring' | 'smooth' | 'snappy'
}) {
  const transition = transitionPresets[variant]

  return (
    <motion.div
      layout
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * AnimatedContainer - 带进入/退出动画的容器
 *
 * 适用于：列表项添加/删除、面板显示/隐藏
 */
export function AnimatedContainer({
  children,
  className,
  initial = { opacity: 0, y: 8 },
  animate = { opacity: 1, y: 0 },
  exit = { opacity: 0, y: -8 },
  transition,
}: {
  children: ReactNode
  className?: string
  initial?: Record<string, any>
  animate?: Record<string, any>
  exit?: Record<string, any>
  transition?: Record<string, any>
}) {
  return (
    <motion.div
      initial={initial}
      animate={animate}
      exit={exit}
      transition={transition ?? { duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * AnimatedFade - 纯淡入淡出动画容器
 */
export function AnimatedFade({
  children,
  className,
  duration = 0.2,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  duration?: number
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, delay, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * AnimatedScale - 缩放动画容器
 */
export function AnimatedScale({
  children,
  className,
  duration = 0.25,
}: {
  children: ReactNode
  className?: string
  duration?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
