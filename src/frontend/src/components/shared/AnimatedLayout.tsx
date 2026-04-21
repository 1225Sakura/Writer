import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface AnimatedLayoutProps {
  children: ReactNode
  className?: string
  layoutId?: string
}

/**
 * AnimatedLayout - 布局变化时的动画 wrapper
 *
 * 使用 Framer Motion 的 layout prop 实现平滑的布局过渡
 * 当子元素的大小或位置发生变化时，自动产生平滑动画
 *
 * 适用于：侧边栏展开/收起、卡片重排、面板大小调整等场景
 */
export function AnimatedLayout({ children, className, layoutId }: AnimatedLayoutProps) {
  return (
    <motion.div
      layout={layoutId ? true : 'position'}
      layoutId={layoutId}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
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
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      layout
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
