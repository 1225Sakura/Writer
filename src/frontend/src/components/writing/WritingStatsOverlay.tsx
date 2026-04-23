import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useSpring } from 'framer-motion'
import { Type, Clock, BookOpen, ChevronUp, ChevronDown, Zap } from 'lucide-react'

interface WritingStatsOverlayProps {
  wordCount: number
  sessionWPM: number
  sessionDuration: number
  todayWordCount: number
  targetWordCount: number
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) return `${mins}分${secs > 0 ? `${secs}秒` : ''}`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}时${remainingMins > 0 ? `${remainingMins}分` : ''}`
}

function estimateReadTime(wordCount: number): string {
  // Average Chinese reading speed: 300-500 characters per minute
  const minutes = Math.ceil(wordCount / 400)
  if (minutes < 1) return '< 1分钟'
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  return `${hours}时${remainingMins > 0 ? `${remainingMins}分` : ''}`
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'var(--color-ifline)'
  if (percentage >= 75) return 'var(--color-location)'
  if (percentage >= 50) return 'var(--color-character)'
  if (percentage >= 25) return 'var(--color-outline)'
  return 'var(--color-vermillion)'
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
  const [wordCountDelta, setWordCountDelta] = useState(0)
  const [showDelta, setShowDelta] = useState(false)
  const deltaTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Animated word count with spring physics
  const animatedWordCount = useSpring(wordCount, {
    stiffness: 100,
    damping: 30,
    mass: 1,
  })

  // Animated today word count
  const animatedTodayWordCount = useSpring(todayWordCount, {
    stiffness: 80,
    damping: 25,
    mass: 1,
  })

  // Update spring value when wordCount changes
  useEffect(() => {
    animatedWordCount.set(wordCount)
  }, [wordCount, animatedWordCount])

  useEffect(() => {
    animatedTodayWordCount.set(todayWordCount)
  }, [todayWordCount, animatedTodayWordCount])

  // Track burst writing speed (words per minute over last 10 seconds)
  useEffect(() => {
    const delta = wordCount - lastWordCount
    if (delta > 0) {
      setWordCountDelta(delta)
      setShowDelta(true)
      // Calculate WPM based on 5-second sampling
      setBurstWPM(Math.round(delta * 12))

      // Clear previous timeout
      if (deltaTimeoutRef.current) {
        clearTimeout(deltaTimeoutRef.current)
      }
      // Hide delta after 2 seconds
      deltaTimeoutRef.current = setTimeout(() => {
        setShowDelta(false)
      }, 2000)
    }
    setLastWordCount(wordCount)
  }, [wordCount])

  // Reset burst WPM after inactivity
  useEffect(() => {
    if (wordCountDelta === 0) return
    const timeout = setTimeout(() => {
      setBurstWPM(0)
      setWordCountDelta(0)
    }, 6000)
    return () => clearTimeout(timeout)
  }, [wordCountDelta])

  const progressPercentage = Math.min(100, Math.round((todayWordCount / targetWordCount) * 100))
  const progressColor = getProgressColor(progressPercentage)

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
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
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
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed left-4 bottom-16 z-50 flex flex-col
                       bg-[var(--color-surface-raised)] border border-[var(--border-default)] rounded-xl
                       overflow-hidden shadow-elevated-lg
                       ${expanded ? 'min-w-[200px]' : 'min-w-[160px]'}`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-3 py-2
                         border-b border-[var(--border-subtle)] cursor-pointer"
              onClick={toggleExpanded}
            >
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[var(--icon-primary)]" />
                <span className="text-[11px] font-medium text-[var(--text-muted)]">写作统计</span>
              </div>
              <div className="flex items-center gap-0.5">
                {expanded ? (
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
                ) : (
                  <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleVisible()
                  }}
                  className="ml-1 w-5 h-5 flex items-center justify-center rounded
                             hover:bg-[var(--border-subtle)] transition-colors text-[var(--text-muted)]"
                >
                  <span className="text-[10px]">×</span>
                </button>
              </div>
            </div>

            {/* Compact stats row */}
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Type className="w-3 h-3 text-[var(--icon-secondary)]" />
                <motion.span
                  className="text-xs font-medium"
                  style={{ color: 'var(--text-primary)' }}
                  key={wordCount}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  {Math.round(animatedWordCount.get())}
                </motion.span>
                <span className="text-[10px] text-[var(--text-muted)]">字</span>
                {/* Delta indicator */}
                <AnimatePresence>
                  {showDelta && wordCountDelta > 0 && (
                    <motion.span
                      initial={{ opacity: 0, y: 4, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.8 }}
                      className="text-[10px] font-medium ml-0.5 text-[var(--color-ifline)]"
                    >
                      +{wordCountDelta}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="w-px h-3 bg-[var(--border-default)]" />
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[var(--icon-secondary)]" />
                <span className="text-xs font-medium text-[var(--text-primary)]">{sessionWPM}</span>
                <span className="text-[10px] text-[var(--text-muted)]">字/分</span>
              </div>
            </div>

            {/* Expanded content */}
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2.5">
                    {/* Burst speed indicator */}
                    {burstWPM > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-1.5 h-1.5 rounded-full animate-pulse motion-reduce:animate-none bg-[var(--color-ifline)]" />
                        <span className="text-[11px] text-[var(--color-ifline)]">
                          当前速度: {burstWPM} 字/分
                        </span>
                      </motion.div>
                    )}

                    {/* Reading time */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-[var(--icon-secondary)]" />
                        <span className="text-[11px] text-[var(--text-muted)]">预计阅读</span>
                      </div>
                      <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                        {estimateReadTime(wordCount)}
                      </span>
                    </div>

                    {/* Session duration */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-[var(--icon-secondary)]" />
                        <span className="text-[11px] text-[var(--text-muted)]">本次时长</span>
                      </div>
                      <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                        {formatDuration(sessionDuration)}
                      </span>
                    </div>

                    {/* Today's progress */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-[var(--text-muted)]">今日进度</span>
                        <motion.span
                          className="text-[11px] font-medium"
                          style={{ color: progressColor }}
                          key={todayWordCount}
                        >
                          {Math.round(animatedTodayWordCount.get())} / {targetWordCount}
                        </motion.span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border-subtle)]">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: progressColor }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercentage}%` }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                      <div className="flex justify-end mt-1">
                        <span className="text-[10px] text-[var(--text-muted)]">{progressPercentage}%</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
