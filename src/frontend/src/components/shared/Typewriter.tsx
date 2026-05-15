/**
 * Typewriter - Typewriter effect component
 *
 * Displays text character by character, simulating a typing effect.
 * Automatically degrades for prefers-reduced-motion.
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from './AnimatedTextHelpers'

interface TypewriterProps {
  text: string
  speed?: number
  className?: string
  cursor?: boolean
  onComplete?: () => void
}

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
