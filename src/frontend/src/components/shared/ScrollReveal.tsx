/**
 * ScrollReveal - 滚动进入视口揭示动画
 *
 * 使用 IntersectionObserver 检测元素是否进入视口
 * 支持多种动画效果：fade、slide-up、slide-left、slide-right、scale、blur
 * 可配置触发阈值、延迟、持续时间
 * 自动检测 prefers-reduced-motion 进行降级
 */

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type RevealAnimation =
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'blur'
  | 'slide-up-fade'
  | 'slide-up-blur'

interface ScrollRevealProps {
  children: ReactNode
  /** 动画类型 */
  animation?: RevealAnimation
  /** 触发阈值 (0-1) */
  threshold?: number
  /** 根边距 */
  rootMargin?: string
  /** 动画延迟 (ms) */
  delay?: number
  /** 动画持续时间 (ms) */
  duration?: number
  /** 只触发一次 */
  once?: boolean
  className?: string
  /** 自定义初始状态 */
  customInitial?: React.CSSProperties
  /** 自定义结束状态 */
  customAnimate?: React.CSSProperties
  /** 是否在视口外保持隐藏 */
  keepHidden?: boolean
  /** 进入视口回调 */
  onEnter?: () => void
  /** 动画完成后回调 */
  onComplete?: () => void
}

/** 标准缓动曲线：cubic-bezier(0.22, 1, 0.36, 1) */
const easeOutSmooth = 'cubic-bezier(0.22, 1, 0.36, 1)'

const animationStyles: Record<RevealAnimation, { initial: React.CSSProperties; animate: React.CSSProperties }> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  'slide-up': {
    initial: { opacity: 0, transform: 'translateY(16px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
  },
  'slide-down': {
    initial: { opacity: 0, transform: 'translateY(-16px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
  },
  'slide-left': {
    initial: { opacity: 0, transform: 'translateX(16px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
  },
  'slide-right': {
    initial: { opacity: 0, transform: 'translateX(-16px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
  },
  scale: {
    initial: { opacity: 0, transform: 'scale(0.96)' },
    animate: { opacity: 1, transform: 'scale(1)' },
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(4px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
  },
  'slide-up-fade': {
    initial: { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
    animate: { opacity: 1, transform: 'translateY(0) scale(1)' },
  },
  'slide-up-blur': {
    initial: { opacity: 0, transform: 'translateY(12px)', filter: 'blur(3px)' },
    animate: { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' },
  },
}

/** 检测是否应减少动画 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}

/**
 * ScrollReveal - 滚动揭示动画组件
 *
 * 当元素滚动进入视口时触发动画
 * 使用 IntersectionObserver 实现高性能检测
 * 优化：更早触发（rootMargin 扩大），更平滑的缓动
 */
export function ScrollReveal({
  children,
  animation = 'slide-up-fade',
  threshold = 0.05,
  rootMargin = '0px 0px -30px 0px',
  delay = 0,
  duration = 450,
  once = true,
  className,
  customInitial,
  customAnimate,
  keepHidden = false,
  onEnter,
  onComplete,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          onEnter?.()
          if (once) {
            setHasAnimated(true)
            observer.unobserve(element)
            // 动画完成后回调（估算时间）
            setTimeout(() => onComplete?.(), delay + duration)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once, delay, duration, onEnter, onComplete])

  const styles = animationStyles[animation]
  const initialStyle = customInitial ?? styles.initial
  const animateStyle = customAnimate ?? styles.animate

  const shouldShow = once ? (hasAnimated || isVisible) : isVisible

  // 减少动画模式下直接显示
  if (reducedMotion) {
    return (
      <div ref={ref} className={cn(className)}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        ...initialStyle,
        ...(shouldShow ? animateStyle : keepHidden ? initialStyle : {}),
        transition: `all ${duration}ms ${easeOutSmooth} ${delay}ms`,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  )
}

/**
 * ScrollRevealGroup - 一组子元素依次揭示
 *
 * 自动为每个子元素添加递增的延迟
 * 优化：更合理的 stagger 延迟，更平滑的入场
 */
interface ScrollRevealGroupProps {
  children: ReactNode[]
  animation?: RevealAnimation
  staggerDelay?: number
  threshold?: number
  className?: string
  itemClassName?: string
  once?: boolean
  rootMargin?: string
}

export function ScrollRevealGroup({
  children,
  animation = 'slide-up-fade',
  staggerDelay = 50,
  threshold = 0.05,
  className,
  itemClassName,
  once = true,
  rootMargin = '0px 0px -30px 0px',
}: ScrollRevealGroupProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal
          key={i}
          animation={animation}
          delay={i * staggerDelay}
          threshold={threshold}
          rootMargin={rootMargin}
          once={once}
          className={itemClassName}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}

/**
 * ScrollRevealStagger - 滚动揭示 + 子元素依次动画
 *
 * 结合 ScrollReveal 和 stagger 效果，子元素在进入视口后依次动画
 */
interface ScrollRevealStaggerProps {
  children: ReactNode[]
  className?: string
  itemClassName?: string
  threshold?: number
  rootMargin?: string
  staggerDelay?: number
  itemDelay?: number
  duration?: number
  once?: boolean
}

export function ScrollRevealStagger({
  children,
  className,
  itemClassName,
  threshold = 0.05,
  rootMargin = '0px 0px -30px 0px',
  staggerDelay = 60,
  itemDelay = 0,
  duration = 400,
  once = true,
}: ScrollRevealStaggerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(element)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  if (reducedMotion) {
    return (
      <div ref={ref} className={cn(className)}>
        {children.map((child, i) => (
          <div key={i} className={itemClassName}>
            {child}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className={cn(className)}>
      {children.map((child, i) => (
        <div
          key={i}
          className={cn(itemClassName)}
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
            transition: `all ${duration}ms ${easeOutSmooth} ${itemDelay + i * staggerDelay}ms`,
            willChange: 'transform, opacity',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
