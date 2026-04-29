/**
 * StaggerChildren - 子元素依次动画出现
 *
 * 使用 Framer Motion 的 staggerChildren 实现子元素依次进入动画
 * 支持多种预设动画和自定义配置
 * 自动检测 prefers-reduced-motion 进行降级
 */

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import * as React from 'react'

export type StaggerPreset =
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale'
  | 'slide-up'
  | 'blur'
  | 'none'

interface StaggerChildrenProps {
  children: ReactNode
  /** 动画预设 */
  preset?: StaggerPreset
  /** 子元素间延迟 (秒) */
  staggerDelay?: number
  /** 整体延迟 (秒) */
  delayChildren?: number
  /** 动画持续时间 (秒) */
  duration?: number
  className?: string
  /** 子元素类名 */
  childClassName?: string
  /** 是否启用 */
  enabled?: boolean
  /** 触发条件：onMount 或 inView */
  trigger?: 'onMount' | 'inView'
  /** 自定义子元素变体 */
  childVariants?: Variants
  /** inView 阈值 */
  inViewThreshold?: number
  /** inView 根边距 */
  inViewMargin?: string
  /** 动画完成后回调 */
  onComplete?: () => void
}

import { EASE } from './AnimationConfig'

/** Standard ease-out from AnimationConfig */
const easeOutSmooth = EASE.OUT

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

const presetVariants: Record<StaggerPreset, { container: Variants; child: Variants }> = {
  'fade-up': {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.06,
          delayChildren: 0,
        },
      },
    },
    child: {
      hidden: { opacity: 0, y: 12 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: easeOutSmooth },
      },
    },
  },
  'fade-down': {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.06,
          delayChildren: 0,
        },
      },
    },
    child: {
      hidden: { opacity: 0, y: -12 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.35, ease: easeOutSmooth },
      },
    },
  },
  'fade-left': {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.06,
          delayChildren: 0,
        },
      },
    },
    child: {
      hidden: { opacity: 0, x: 12 },
      visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.35, ease: easeOutSmooth },
      },
    },
  },
  'fade-right': {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.06,
          delayChildren: 0,
        },
      },
    },
    child: {
      hidden: { opacity: 0, x: -12 },
      visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.35, ease: easeOutSmooth },
      },
    },
  },
  scale: {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.05,
          delayChildren: 0,
        },
      },
    },
    child: {
      hidden: { opacity: 0, scale: 0.94 },
      visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.3, ease: easeOutSmooth },
      },
    },
  },
  'slide-up': {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.08,
          delayChildren: 0,
        },
      },
    },
    child: {
      hidden: { opacity: 0, y: 20 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: easeOutSmooth },
      },
    },
  },
  blur: {
    container: {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.08,
          delayChildren: 0,
        },
      },
    },
    child: {
      hidden: { opacity: 0, filter: 'blur(4px)' },
      visible: {
        opacity: 1,
        filter: 'blur(0px)',
        transition: { duration: 0.4, ease: easeOutSmooth },
      },
    },
  },
  none: {
    container: {
      hidden: {},
      visible: {},
    },
    child: {
      hidden: {},
      visible: {},
    },
  },
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
 * StaggerItem - 配合 StaggerChildren 使用的子元素包装器
 *
 * 必须作为 StaggerChildren 的直接子元素使用
 */
export function StaggerItem({
  children,
  className,
  preset = 'fade-up',
}: {
  children: ReactNode
  className?: string
  preset?: StaggerPreset
}) {
  const presetData = presetVariants[preset]

  return (
    <motion.div
      variants={presetData.child}
      className={cn(className)}
      style={{ willChange: 'transform, opacity' }}
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
