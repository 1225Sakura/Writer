/**
 * RevealText - Scroll-triggered text reveal
 *
 * Uses IntersectionObserver to detect when the element enters the viewport,
 * then triggers a word-by-word animation.
 */

import * as React from 'react'
import { motion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { easeOutSmooth, useReducedMotion } from './AnimatedTextHelpers'

interface RevealTextProps {
  children: string
  className?: string
  delay?: number
  duration?: number
  threshold?: number
}

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
