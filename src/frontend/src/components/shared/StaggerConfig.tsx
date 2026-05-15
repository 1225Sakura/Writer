/**
 * StaggerConfig - Types, presets, and configuration for stagger animations
 */

import type { Variants } from 'framer-motion'
import { EASE } from './AnimationConfig'

export type StaggerPreset =
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale'
  | 'slide-up'
  | 'blur'
  | 'none'

export interface StaggerChildrenProps {
  children: React.ReactNode
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

/** Standard ease-out from AnimationConfig */
const easeOutSmooth = EASE.OUT

export const presetVariants: Record<StaggerPreset, { container: Variants; child: Variants }> = {
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
