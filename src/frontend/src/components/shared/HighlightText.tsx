/**
 * HighlightText - Animated keyword highlighting
 *
 * Highlights specified keywords in a text block with optional animation.
 * Uses AnimationConfig for timing values.
 */

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { useReducedMotion } from './AnimatedTextHelpers'

interface HighlightTextProps {
  children: string
  highlights: string[]
  highlightClassName?: string
  className?: string
  animate?: boolean
}

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
