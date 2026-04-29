/**
 * AnimatedText - 文字动画组件
 *
 * 支持逐字/逐词/逐行动画揭示
 * 用于重要标题和引导文字
 * 自动检测 prefers-reduced-motion
 */

import * as React from 'react'
import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/** 标准缓动曲线 */
const easeOutSmooth = [0.22, 1, 0.36, 1] as const

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

// ==================== Word by Word Animation ====================

export type TextAnimationType = 'word' | 'line' | 'character' | 'fade-up' | 'blur-in'

interface AnimatedTextProps {
  children: string
  /** 动画类型 */
  type?: TextAnimationType
  /** 每个元素之间的延迟 (秒) */
  staggerDelay?: number
  /** 整体延迟 (秒) */
  delay?: number
  /** 动画持续时间 (秒) */
  duration?: number
  className?: string
  /** 每个词/字的包裹类名 */
  itemClassName?: string
  /** 是否启用 */
  enabled?: boolean
  /** 动画完成后回调 */
  onComplete?: () => void
  /** 作为标题渲染 */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'
}

/**
 * AnimatedText - 文字动画组件
 *
 * 将文本拆分为词/字/行并依次动画揭示
 * 支持 prefers-reduced-motion 自动降级
 */
export function AnimatedText({
  children,
  type = 'word',
  staggerDelay = 0.04,
  delay = 0,
  duration = 0.35,
  className,
  itemClassName,
  enabled = true,
  onComplete,
  as: Tag = 'div',
}: AnimatedTextProps) {
  const reducedMotion = useReducedMotion()
  const [_hasAnimated, setHasAnimated] = React.useState(false)

  const getVariants = (): { container: Variants; item: Variants } => {
    switch (type) {
      case 'character':
      case 'word':
        return {
          container: {
            hidden: {},
            visible: {
              transition: {
                staggerChildren: staggerDelay,
                delayChildren: delay,
              },
            },
          },
          item: {
            hidden: { opacity: 0, y: 12, filter: 'blur(2px)' },
            visible: {
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transition: { duration, ease: easeOutSmooth },
            },
          },
        }
      case 'line':
        return {
          container: {
            hidden: {},
            visible: {
              transition: {
                staggerChildren: staggerDelay * 2,
                delayChildren: delay,
              },
            },
          },
          item: {
            hidden: { opacity: 0, y: 16, clipPath: 'inset(0 0 100% 0)' },
            visible: {
              opacity: 1,
              y: 0,
              clipPath: 'inset(0 0 0% 0)',
              transition: { duration: duration * 1.2, ease: easeOutSmooth },
            },
          },
        }
      case 'fade-up':
        return {
          container: {
            hidden: {},
            visible: {
              transition: {
                staggerChildren: staggerDelay,
                delayChildren: delay,
              },
            },
          },
          item: {
            hidden: { opacity: 0, y: 8 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration, ease: easeOutSmooth },
            },
          },
        }
      case 'blur-in':
        return {
          container: {
            hidden: {},
            visible: {
              transition: {
                staggerChildren: staggerDelay,
                delayChildren: delay,
              },
            },
          },
          item: {
            hidden: { opacity: 0, filter: 'blur(6px)' },
            visible: {
              opacity: 1,
              filter: 'blur(0px)',
              transition: { duration: duration * 1.2, ease: easeOutSmooth },
            },
          },
        }
      default:
        return {
          container: {},
          item: {},
        }
    }
  }

  const { container, item } = getVariants()

  const splitText = (): string[] => {
    switch (type) {
      case 'character':
        return children.split('')
      case 'word':
      case 'fade-up':
      case 'blur-in':
        return children.split(/(\s+)/).filter(Boolean)
      case 'line':
        return children.split('\n').filter(Boolean)
      default:
        return [children]
    }
  }

  const items = splitText()

  const handleAnimationComplete = () => {
    setHasAnimated(true)
    onComplete?.()
  }

  // 减少动画模式下直接渲染
  if (reducedMotion || !enabled) {
    return (
      <Tag className={className}>
        {children}
      </Tag>
    )
  }

  return (
    <motion.div
      className={cn('inline-flex flex-wrap', className)}
      variants={container}
      initial="hidden"
      animate="visible"
      onAnimationComplete={handleAnimationComplete}
      aria-label={children}
    >
      {items.map((text, i) => (
        <motion.span
          key={`${text}-${i}`}
          variants={item}
          className={cn(
            'inline-block',
            type === 'word' || type === 'character' ? 'mr-[0.25em]' : '',
            itemClassName
          )}
          style={{ willChange: 'transform, opacity, filter' }}
        >
          {text}
        </motion.span>
      ))}
    </motion.div>
  )
}

// ==================== Animated Heading ====================

interface AnimatedHeadingProps {
  children: string
  level?: 1 | 2 | 3 | 4
  className?: string
  delay?: number
  staggerDelay?: number
  type?: 'word' | 'line' | 'character'
}

/**
 * AnimatedHeading - 带动画的标题组件
 *
 * 预配置的标题动画，支持 h1-h4
 */
export function AnimatedHeading({
  children,
  level = 1,
  className,
  delay = 0,
  staggerDelay = 0.04,
  type = 'word',
}: AnimatedHeadingProps) {
  const tagMap = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4' } as const

  return (
    <AnimatedText
      as={tagMap[level]}
      type={type}
      delay={delay}
      staggerDelay={staggerDelay}
      className={cn(
        'font-serif font-semibold tracking-tight',
        level === 1 && 'text-3xl md:text-4xl',
        level === 2 && 'text-2xl md:text-3xl',
        level === 3 && 'text-xl md:text-2xl',
        level === 4 && 'text-lg md:text-xl',
        className
      )}
    >
      {children}
    </AnimatedText>
  )
}

// ==================== Typewriter Effect ====================

interface TypewriterProps {
  text: string
  speed?: number
  className?: string
  cursor?: boolean
  onComplete?: () => void
}

/**
 * Typewriter - 打字机效果
 *
 * 逐字显示文本，模拟打字效果
 * 自动检测 prefers-reduced-motion
 */
export function Typewriter({
  text,
  speed = 50,
  className,
  cursor = true,
  onComplete,
}: TypewriterProps) {
  const [displayText, setDisplayText] = React.useState('')
  const [showCursor, setShowCursor] = React.useState(cursor)
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    if (reducedMotion) {
      setDisplayText(text)
      setShowCursor(false)
      onComplete?.()
      return
    }

    let index = 0
    setDisplayText('')
    setShowCursor(cursor)

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(timer)
        if (cursor) {
          setTimeout(() => setShowCursor(false), 800)
        }
        onComplete?.()
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed, cursor, reducedMotion, onComplete])

  return (
    <span className={className}>
      {displayText}
      {showCursor && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          className="inline-block w-[2px] h-[1em] bg-current ml-[1px] align-middle"
        />
      )}
    </span>
  )
}

// ==================== Reveal On Scroll ====================

interface RevealTextProps {
  children: string
  className?: string
  delay?: number
  duration?: number
  threshold?: number
}

/**
 * RevealText - 滚动进入视口时文字揭示
 *
 * 使用 IntersectionObserver 检测，进入视口时触发文字动画
 */
export function RevealText({
  children,
  className,
  delay = 0,
  duration = 0.6,
  threshold = 0.2,
}: RevealTextProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = React.useState(false)
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  const words = children.split(/(\s+)/).filter(Boolean)

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.03,
        delayChildren: delay,
      },
    },
  }

  const wordVariants: Variants = {
    hidden: { opacity: 0, y: 12, filter: 'blur(3px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration, ease: easeOutSmooth },
    },
  }

  return (
    <motion.div
      ref={ref}
      className={cn('inline-flex flex-wrap', className)}
      variants={containerVariants}
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
    >
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          variants={wordVariants}
          className="inline-block mr-[0.25em]"
          style={{ willChange: 'transform, opacity, filter' }}
        >
          {word}
        </motion.span>
      ))}
    </motion.div>
  )
}

// ==================== Highlight Text ====================

interface HighlightTextProps {
  children: string
  highlights: string[]
  highlightClassName?: string
  className?: string
  animate?: boolean
}

/**
 * HighlightText - 高亮关键词动画
 *
 * 对指定关键词添加高亮动画效果
 */
export function HighlightText({
  children,
  highlights,
  highlightClassName = 'text-accent-100',
  className,
  animate = true,
}: HighlightTextProps) {
  const reducedMotion = useReducedMotion()
  const shouldAnimate = animate && !reducedMotion

  const parts: ReactNode[] = []
  let remaining = children

  highlights.forEach((highlight, hi) => {
    const index = remaining.indexOf(highlight)
    if (index === -1) return

    if (index > 0) {
      parts.push(
        <span key={`text-${hi}`}>{remaining.slice(0, index)}</span>
      )
    }

    parts.push(
      shouldAnimate ? (
        <motion.span
          key={`highlight-${hi}`}
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.SLOW, delay: hi * 0.15, ease: EASE.SMOOTH }}
          className={cn('font-medium', highlightClassName)}
        >
          {highlight}
        </motion.span>
      ) : (
        <span key={`highlight-${hi}`} className={cn('font-medium', highlightClassName)}>
          {highlight}
        </span>
      )
    )

    remaining = remaining.slice(index + highlight.length)
  })

  if (remaining) {
    parts.push(<span key="text-end">{remaining}</span>)
  }

  return <span className={className}>{parts}</span>
}
