import { motion, AnimatePresence, useSpring } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Type, Clock } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface StatsGridProps {
  wordCount: number
  sessionWPM: number
}

export function StatsGrid({ wordCount, sessionWPM }: StatsGridProps) {
  const [lastWordCount, setLastWordCount] = useState(wordCount)
  const [wordCountDelta, setWordCountDelta] = useState(0)
  const [showDelta, setShowDelta] = useState(false)
  const deltaTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const animatedWordCount = useSpring(wordCount, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  })

  useEffect(() => {
    animatedWordCount.set(wordCount)
  }, [wordCount, animatedWordCount])

  // Track burst writing speed
  useEffect(() => {
    const delta = wordCount - lastWordCount
    if (delta > 0) {
      setWordCountDelta(delta)
      setShowDelta(true)
      if (deltaTimeoutRef.current) {
        clearTimeout(deltaTimeoutRef.current)
      }
      deltaTimeoutRef.current = setTimeout(() => {
        setShowDelta(false)
      }, 2000)
    }
    setLastWordCount(wordCount)
  }, [wordCount])

  // Reset delta after inactivity
  useEffect(() => {
    if (wordCountDelta === 0) return
    const timeout = setTimeout(() => {
      setWordCountDelta(0)
    }, 6000)
    return () => clearTimeout(timeout)
  }, [wordCountDelta])

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Type className="w-3 h-3" style={{ color: 'var(--icon-secondary)' }} />
        <motion.span
          className="text-xs font-semibold"
          style={{ color: 'var(--text-primary)' }}
          key={wordCount}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        >
          {Math.round(animatedWordCount.get())}
        </motion.span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>字</span>
        {/* Delta indicator */}
        <AnimatePresence>
          {showDelta && wordCountDelta > 0 && (
            <motion.span
              initial={{ opacity: 0, y: 4, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.8 }}
              className="text-[10px] font-semibold ml-0.5"
              style={{ color: 'var(--color-ifline)' }}
            >
              +{wordCountDelta}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="w-px h-3" style={{ background: 'var(--border-default)' }} />
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3" style={{ color: 'var(--icon-secondary)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{sessionWPM}</span>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>字/分</span>
      </div>
    </div>
  )
}
