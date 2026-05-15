/**
 * AnimatedTextHelpers - Shared hooks, types, and base component for text animations
 *
 * Contains useReducedMotion, easeOutSmooth, and the core AnimatedText component.
 */

import * as React from 'react'
import { motion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Standard easing curve */
export const easeOutSmooth = [0.22, 1, 0.36, 1] as const

/** Detect reduced motion preference */
export function useReducedMotion(): boolean {
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

export type TextAnimationType = 'word' | 'line' | 'character' | 'fade-up' | 'blur-in'

export interface AnimatedTextProps {
  children: string
  /** Animation type */
  type?: TextAnimationType
  /** Delay between each element (seconds) */
  staggerDelay?: number
  /** Overall delay (seconds) */
  delay?: number
  /** Animation duration (seconds) */
  duration?: number
  className?: string
  /** Wrapper class for each word/character */
  itemClassName?: string
  /** Whether animation is enabled */
  enabled?: boolean
  /** Callback when animation completes */
  onComplete?: () => void
  /** Render as heading element */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'
}

/**
 * AnimatedText - Text animation component
 *
 * Splits text into words/characters/lines and animates them in sequence.
 * Automatically degrades for prefers-reduced-motion.
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
