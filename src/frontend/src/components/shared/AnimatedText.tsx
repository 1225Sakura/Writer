/**
 * AnimatedText - Text animation component
 *
 * Re-exports sub-components and adds AnimatedHeading.
 * Sub-components are split into:
 *   - AnimatedTextHelpers.tsx  — useReducedMotion, easeOutSmooth, AnimatedText
 *   - Typewriter.tsx           — Typewriter effect
 *   - RevealText.tsx           — Scroll-triggered reveal
 *   - HighlightText.tsx        — Keyword highlight animation
 */

import { cn } from '@/lib/utils'
import { AnimatedText } from './AnimatedTextHelpers'

// Re-export all sub-components and types for backward compatibility
export { AnimatedText, type TextAnimationType } from './AnimatedTextHelpers'
export { Typewriter } from './Typewriter'
export { RevealText } from './RevealText'
export { HighlightText } from './HighlightText'

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
 * AnimatedHeading - Animated heading component
 *
 * Pre-configured heading animation, supports h1-h4
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
