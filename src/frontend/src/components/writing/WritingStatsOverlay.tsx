import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { StatsHeader } from './StatsHeader'
import { StatsGrid } from './StatsGrid'
import { StatsChart } from './StatsChart'


interface WritingStatsOverlayProps {
  wordCount: number
  sessionWPM: number
  sessionDuration: number
  todayWordCount: number
  targetWordCount: number
}

export function WritingStatsOverlay({
  wordCount,
  sessionWPM,
  sessionDuration,
  todayWordCount,
  targetWordCount,
}: WritingStatsOverlayProps) {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(true)
  const [lastWordCount, setLastWordCount] = useState(wordCount)
  const [burstWPM, setBurstWPM] = useState(0)

  // Track burst writing speed (words per minute over last 10 seconds)
  useEffect(() => {
    const delta = wordCount - lastWordCount
    if (delta > 0) {
      setBurstWPM(Math.round(delta * 12))
    }
    setLastWordCount(wordCount)
  }, [wordCount])

  // Reset burst WPM after inactivity
  useEffect(() => {
    if (burstWPM === 0) return
    const timeout = setTimeout(() => {
      setBurstWPM(0)
    }, 6000)
    return () => clearTimeout(timeout)
  }, [burstWPM])

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const toggleVisible = useCallback(() => {
    setVisible((prev) => !prev)
  }, [])

  return (
    <>
      {/* Toggle button when collapsed */}
      <AnimatePresence>
        {!visible && (
          <motion.button
            key="stats-toggle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            onClick={toggleVisible}
            className="fixed left-4 bottom-16 z-50 flex items-center justify-center w-8 h-8 rounded-full
                       bg-[var(--color-surface-raised)] border border-[var(--border-default)]
                       text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                       hover:bg-[var(--border-subtle)] transition-all duration-200
                       shadow-lg"
            title="显示写作统计"
          >
            <Zap className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <motion.div
            key="stats-overlay"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className={`fixed left-4 bottom-16 z-50 flex flex-col
                       rounded-xl overflow-hidden
                       ${expanded ? 'min-w-[200px]' : 'min-w-[160px]'}`}
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, var(--ink-100) 95%, transparent) 0%, color-mix(in srgb, var(--ink-100) 98%, transparent) 100%)`,
              border: '1px solid color-mix(in srgb, var(--paper-100) 5%, transparent)',
              boxShadow: '0 4px 20px color-mix(in srgb, var(--ink-100) 25%, transparent), 0 8px 40px color-mix(in srgb, var(--ink-100) 15%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 4%, transparent)',
            }}
          >
            <StatsHeader
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              onToggleVisible={toggleVisible}
            />

            <StatsGrid wordCount={wordCount} sessionWPM={sessionWPM} />

            {/* Expanded content */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                  className="overflow-hidden"
                >
                  <StatsChart
                    wordCount={wordCount}
                    todayWordCount={todayWordCount}
                    targetWordCount={targetWordCount}
                    sessionDuration={sessionDuration}
                    burstWPM={burstWPM}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
