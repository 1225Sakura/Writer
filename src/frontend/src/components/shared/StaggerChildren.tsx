/**
 * StaggerChildren - 子元素依次动画出现
 *
 * 使用 Framer Motion 的 staggerChildren 实现子元素依次进入动画
 * 支持多种预设动画和自定义配置
 */

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
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
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
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
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
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
        transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
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
        transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
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
        transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
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
        transition: { duration: 0.35, ease: 'easeOut' },
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
  childVariants,
}: StaggerChildrenProps) {
  if (!enabled) {
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
      variants={containerVariants}
      initial="hidden"
      animate="visible"
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
    <motion.div variants={presetData.child} className={cn(className)}>
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
}: StaggerListProps<T>) {
  return (
    <StaggerChildren
      preset={preset}
      staggerDelay={staggerDelay}
      delayChildren={delayChildren}
      className={className}
      enabled={enabled}
    >
      {items.map((item, index) => (
        <StaggerItem key={keyExtractor(item, index)} className={itemClassName} preset={preset}>
          {renderItem(item, index)}
        </StaggerItem>
      ))}
    </StaggerChildren>
  )
}
