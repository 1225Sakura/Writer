/**
 * AnimatedLayout - 布局变化时的动画 wrapper
 *
 * 使用 Framer Motion 的 layout prop 实现平滑的布局过渡
 * 当子元素的大小或位置发生变化时，自动产生平滑动画
 *
 * 适用于：侧边栏展开/收起、卡片重排、面板大小调整等场景
 */

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { SPRING, EASE, DURATION } from './AnimationConfig'

interface AnimatedLayoutProps {
  children: ReactNode
  className?: string
  layoutId?: string
  /** 动画类型 */
  variant?: 'spring' | 'smooth' | 'snappy'
  /** 是否启用 */
  enabled?: boolean
}

const transitionPresets = {
  spring: SPRING.SNAPPY,
  smooth: SPRING.GENTLE,
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 40,
    mass: 0.5,
  },
}

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
 * AnimatedLayoutGroup - Layout animation container for child elements
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
 * AnimatedContainer - Container with enter/exit animations
 */
export function AnimatedContainer({
  children,
  className,
  initial = { opacity: 0, y: 6 },
  animate = { opacity: 1, y: 0 },
  exit = { opacity: 0, y: -6 },
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
      transition={transition ?? { duration: DURATION.FAST, ease: EASE.STANDARD }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * AnimatedFade - Pure fade animation container
 */
export function AnimatedFade({
  children,
  className,
  duration = DURATION.FAST,
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
      transition={{ duration, delay, ease: EASE.STANDARD }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * AnimatedScale - Scale animation container
 */
export function AnimatedScale({
  children,
  className,
  duration = DURATION.FAST,
}: {
  children: ReactNode
  className?: string
  duration?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration, ease: EASE.STANDARD }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
