/**
 * StaggerContainer - StaggerChildren component + StaggerList
 *
 * Uses Framer Motion's variants + staggerChildren for sequential animations.
 */

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { type StaggerPreset, type StaggerChildrenProps, presetVariants } from './StaggerConfig'
import { StaggerItem } from './StaggerItem'

/** 检测是否应减少动画 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}

/**
 * StaggerChildren - 子元素依次动画出现
 *
 * 使用 Framer Motion 的 variants + staggerChildren 实现
 * 所有子元素必须包裹在 motion.div 中
 */
export function StaggerChildren({
  children,
  preset = 'fade-up',
  staggerDelay = 0.06,
  delayChildren = 0,
  duration,
  className,
  childClassName,
  enabled = true,
  trigger = 'onMount',
  childVariants,
  inViewThreshold = 0.1,
  inViewMargin = '0px 0px -40px 0px',
  onComplete,
}: StaggerChildrenProps) {
  const reducedMotion = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = React.useState(trigger === 'onMount')

  React.useEffect(() => {
    if (trigger !== 'inView' || !ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { threshold: inViewThreshold, rootMargin: inViewMargin }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [trigger, inViewThreshold, inViewMargin])

  if (!enabled || reducedMotion) {
    return <div className={className}>{children}</div>
  }

  const presetData = presetVariants[preset]

  const containerVariants: Variants = {
    hidden: presetData.container.hidden,
    visible: {
      ...presetData.container.visible,
      transition: {
        ...((presetData.container.visible as Record<string, unknown>).transition as object),
        staggerChildren: staggerDelay,
        delayChildren,
      },
    },
  }

  const itemVariants: Variants = childVariants ?? {
    hidden: presetData.child.hidden,
    visible: duration
      ? {
          ...presetData.child.visible,
          transition: {
            ...((presetData.child.visible as Record<string, unknown>).transition as object),
            duration,
          },
        }
      : presetData.child.visible,
  }

  void itemVariants
  void childClassName

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      onAnimationComplete={onComplete}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

/**
 * StaggerList - 列表项依次出现的便捷组件
 *
 * 自动将列表项包装为 StaggerItem
 */
interface StaggerListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  keyExtractor: (item: T, index: number) => string | number
  preset?: StaggerPreset
  staggerDelay?: number
  delayChildren?: number
  className?: string
  itemClassName?: string
  enabled?: boolean
  trigger?: 'onMount' | 'inView'
}

export function StaggerList<T>({
  items,
  renderItem,
  keyExtractor,
  preset = 'fade-up',
  staggerDelay = 0.06,
  delayChildren = 0,
  className,
  itemClassName,
  enabled = true,
  trigger = 'onMount',
}: StaggerListProps<T>) {
  return (
    <StaggerChildren
      preset={preset}
      staggerDelay={staggerDelay}
      delayChildren={delayChildren}
      className={className}
      enabled={enabled}
      trigger={trigger}
    >
      {items.map((item, index) => (
        <StaggerItem key={keyExtractor(item, index)} className={itemClassName} preset={preset}>
          {renderItem(item, index)}
        </StaggerItem>
      ))}
    </StaggerChildren>
  )
}
