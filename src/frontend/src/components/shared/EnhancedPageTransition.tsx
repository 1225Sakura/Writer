/**
 * EnhancedPageTransition - 增强版页面过渡动画
 *
 * 支持多种过渡效果：滑动、淡入淡出、缩放、3D翻转等
 * 使用 Framer Motion 实现流畅动画
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - 过渡时长：350ms (page), 400ms (Settings→Writing), 250ms (返回首页)
 * - Easing: [0.22, 1, 0.36, 1] (custom cubic-bezier)
 * - Stagger children: 80ms, delayChildren: 100ms
 */

import { useState, useEffect } from 'react'
import { AnimatePresence, motion, type Variants, type Transition } from 'framer-motion'
import type { ReactNode } from 'react'
import type { InterfaceType } from '@/store/uiStore'
import { cn } from '@/lib/utils'

export type TransitionVariant = 'slide' | 'fade' | 'scale' | 'slide-fade' | 'flip' | 'slide-up'
export type TransitionDirection = 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down'

interface PageTransitionProps {
  children: ReactNode
  interfaceType: InterfaceType
  className?: string
  variant?: TransitionVariant
  duration?: number
  stiffness?: number
  damping?: number
}

interface EnhancedPageTransitionProps extends PageTransitionProps {
  /** 是否启用 3D 透视效果 */
  enable3D?: boolean
  /** 是否启用模糊效果 */
  enableBlur?: boolean
  /** 是否显示进度指示器 */
  showProgress?: boolean
  /** 自定义进入/退出动画 */
  customVariants?: Variants
  /** 自定义过渡 */
  customTransition?: Transition
}

const interfaceOrder: Record<InterfaceType, number> = {
  chat: 0,
  settings: 1,
  writing: 2,
  global: 3,
}

function getDirection(from: InterfaceType, to: InterfaceType): TransitionDirection {
  const diff = interfaceOrder[to] - interfaceOrder[from]
  if (diff > 0) return 'forward'
  if (diff < 0) return 'backward'
  return 'forward'
}

function getDirectionValue(direction: TransitionDirection): number {
  switch (direction) {
    case 'forward':
    case 'right':
      return 1
    case 'backward':
    case 'left':
      return -1
    case 'up':
      return -1
    case 'down':
      return 1
    default:
      return 0
  }
}

// Slide variants
const slideVariants: Variants = {
  enter: (direction: TransitionDirection) => ({
    x: direction === 'up' || direction === 'down' ? 0 : (direction === 'left' ? '-100%' : '100%'),
    y: direction === 'left' || direction === 'right' ? 0 : (direction === 'up' ? '-100%' : '100%'),
    opacity: 0,
  }),
  center: {
    x: 0,
    y: 0,
    opacity: 1,
  },
  exit: (direction: TransitionDirection) => ({
    x: direction === 'up' || direction === 'down' ? 0 : (direction === 'left' ? '100%' : '-100%'),
    y: direction === 'left' || direction === 'right' ? 0 : (direction === 'up' ? '100%' : '-100%'),
    opacity: 0,
  }),
}

// Fade variants
const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
}

// Scale variants
const scaleVariants: Variants = {
  enter: { opacity: 0, scale: 0.92 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.04 },
}

// Slide-fade combined variants
const slideFadeVariants: Variants = {
  enter: (direction: number) => ({
    x: direction * 40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction * -40,
    opacity: 0,
  }),
}

// Flip variants (3D rotation)
const flipVariants: Variants = {
  enter: (direction: number) => ({
    rotateY: direction > 0 ? 90 : -90,
    opacity: 0,
  }),
  center: {
    rotateY: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    rotateY: direction > 0 ? -90 : 90,
    opacity: 0,
  }),
}

// Slide up variants
const slideUpVariants: Variants = {
  enter: { y: '100%', opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: '-100%', opacity: 0 },
}

const variantMap: Record<TransitionVariant, Variants> = {
  slide: slideVariants,
  fade: fadeVariants,
  scale: scaleVariants,
  'slide-fade': slideFadeVariants,
  flip: flipVariants,
  'slide-up': slideUpVariants,
}

/**
 * EnhancedPageTransition - 增强版页面过渡组件
 *
 * 特性：
 * - 多种过渡效果（滑动、淡入、缩放、3D翻转）
 * - 支持双向自动判断方向
 * - 可选 3D 透视效果
 * - 可选模糊效果
 * - GPU 加速优化
 */
export function EnhancedPageTransition({
  children,
  interfaceType,
  className,
  variant = 'slide',
  duration = 0.35,
  stiffness = 350,
  damping = 35,
  enable3D = false,
  enableBlur = false,
  customVariants,
  customTransition,
}: EnhancedPageTransitionProps) {
  const [prevInterface, setPrevInterface] = useState<InterfaceType>(interfaceType)
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    if (interfaceType !== prevInterface) {
      setIsTransitioning(true)
      setPrevInterface(interfaceType)

      const timer = setTimeout(() => {
        setIsTransitioning(false)
      }, duration * 1000)

      return () => clearTimeout(timer)
    }
  }, [interfaceType, prevInterface, duration])

  const direction = getDirection(prevInterface, interfaceType)
  const directionValue = getDirectionValue(direction)
  const variants = customVariants ?? variantMap[variant]

  const transition: Transition = customTransition ?? {
    x: { type: 'spring', stiffness, damping, mass: 0.8 },
    y: { type: 'spring', stiffness, damping, mass: 0.8 },
    opacity: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
    scale: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    rotateY: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }

  return (
    <div
      className={cn('relative overflow-hidden', enable3D && 'preserve-3d', className)}
      style={{
        perspective: enable3D ? '1200px' : undefined,
      }}
    >
      {/* Progress indicator */}
      {isTransitioning && (
        <motion.div
          className="absolute top-0 left-0 h-0.5 z-50"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          exit={{ width: '100%' }}
          transition={{ duration, ease: 'easeOut' }}
          style={{
            background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
          }}
        />
      )}

      <AnimatePresence mode="wait" custom={directionValue}>
        <motion.div
          key={interfaceType}
          custom={directionValue}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={transition}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            willChange: 'transform, opacity',
            ...(enableBlur && {
              filter: isTransitioning ? 'blur(4px)' : 'blur(0px)',
              transition: 'filter 0.2s ease',
            }),
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * TransitionOverlay - 过渡遮罩（用于切换时的视觉反馈）
 */
export function TransitionOverlay({
  visible,
  variant = 'fade',
}: {
  visible: boolean
  variant?: 'fade' | 'slide' | 'scale'
}) {
  const variants: Variants = {
    enter: { opacity: 1 },
    center: { opacity: 0 },
    exit: { opacity: 1 },
  }

  if (variant === 'slide') {
    variants.enter = { x: '100%' }
    variants.center = { x: 0 }
    variants.exit = { x: '-100%' }
  }

  if (variant === 'scale') {
    variants.enter = { scale: 1.1, opacity: 1 }
    variants.center = { scale: 1, opacity: 0 }
    variants.exit = { scale: 0.9, opacity: 1 }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, var(--elevation-1), var(--elevation-2))',
          }}
        />
      )}
    </AnimatePresence>
  )
}

/**
 * PageIndicator - 页面切换指示器
 */
export function PageIndicator({
  currentIndex,
  total = 3,
}: {
  currentIndex: number
  total?: number
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          className="flex items-center"
          initial={false}
          animate={{
            width: i === currentIndex ? 24 : 8,
            opacity: i === currentIndex ? 1 : 0.4,
          }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="h-1 rounded-full"
            style={{
              backgroundColor:
                i === currentIndex
                  ? 'var(--accent-primary)'
                  : 'var(--border-strong)',
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

/**
 * TransitionProvider - 过渡上下文提供者
 */
export function usePageTransition() {
  const [transitionState, setTransitionState] = useState({
    isTransitioning: false,
    from: 'chat' as InterfaceType,
    to: 'chat' as InterfaceType,
  })

  const startTransition = (from: InterfaceType, to: InterfaceType) => {
    setTransitionState({ isTransitioning: true, from, to })
  }

  const endTransition = () => {
    setTransitionState((prev) => ({ ...prev, isTransitioning: false }))
  }

  return {
    ...transitionState,
    startTransition,
    endTransition,
  }
}