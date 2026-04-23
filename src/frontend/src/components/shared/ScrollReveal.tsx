/**
 * ScrollReveal - 滚动进入视口揭示动画
 *
 * 使用 IntersectionObserver 检测元素是否进入视口
 * 支持多种动画效果：fade、slide-up、slide-left、slide-right、scale、blur
 * 可配置触发阈值、延迟、持续时间
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
}

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
}

/**
 * ScrollReveal - 滚动揭示动画组件
 *
 * 当元素滚动进入视口时触发动画
 * 使用 IntersectionObserver 实现高性能检测
 */
export function ScrollReveal({
  children,
  animation = 'slide-up-fade',
  threshold = 0.1,
  rootMargin = '0px 0px -20px 0px',
  delay = 0,
  duration = 400,
  once = true,
  className,
  customInitial,
  customAnimate,
  keepHidden = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            setHasAnimated(true)
            observer.unobserve(element)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  const styles = animationStyles[animation]
  const initialStyle = customInitial ?? styles.initial
  const animateStyle = customAnimate ?? styles.animate

  const shouldShow = once ? (hasAnimated || isVisible) : isVisible

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        ...initialStyle,
        ...(shouldShow ? animateStyle : keepHidden ? initialStyle : {}),
        transition: `all ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
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
 */
interface ScrollRevealGroupProps {
  children: ReactNode[]
  animation?: RevealAnimation
  staggerDelay?: number
  threshold?: number
  className?: string
  itemClassName?: string
  once?: boolean
}

export function ScrollRevealGroup({
  children,
  animation = 'slide-up-fade',
  staggerDelay = 60,
  threshold = 0.05,
  className,
  itemClassName,
  once = true,
}: ScrollRevealGroupProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <ScrollReveal
          key={i}
          animation={animation}
          delay={i * staggerDelay}
          threshold={threshold}
          once={once}
          className={itemClassName}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}
