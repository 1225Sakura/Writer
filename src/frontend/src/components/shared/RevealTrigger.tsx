/**
 * RevealTrigger - Scroll-triggered reveal animation components
 *
 * Uses IntersectionObserver to detect when elements enter the viewport.
 * Supports multiple animation effects with configurable threshold, delay, duration.
 * Auto-detects prefers-reduced-motion for graceful degradation.
 */

import { useRef, useState, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { type RevealAnimation, animationStyles, easeOutSmooth, useReducedMotion } from './RevealContainer'

interface ScrollRevealProps {
  children: ReactNode
  animation?: RevealAnimation
  threshold?: number
  rootMargin?: string
  delay?: number
  duration?: number
  once?: boolean
  className?: string
  customInitial?: React.CSSProperties
  customAnimate?: React.CSSProperties
  keepHidden?: boolean
  onEnter?: () => void
  onComplete?: () => void
}

/**
 * ScrollReveal - Scroll-triggered reveal animation
 *
 * Triggers animation when element scrolls into viewport.
 * Uses IntersectionObserver for high-performance detection.
 * Optimized: earlier trigger (rootMargin expansion), smoother easing.
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
            // Callback after animation completes (estimated time)
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

  // Reduced motion mode: show immediately
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
 * ScrollRevealStagger - Scroll reveal + staggered child animation
 *
 * Combines ScrollReveal with stagger effect: children animate sequentially
 * after entering the viewport.
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
