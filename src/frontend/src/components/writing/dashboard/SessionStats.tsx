import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Type, Gauge, TrendingUp } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { useWritingStore } from '@/store/writingStore'

// ============================================
// Helpers
// ============================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatWordCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

// ============================================
// Stat Item
// ============================================

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string
  subValue?: string
  color?: string
}

function StatItem({ icon, label, value, subValue, color }: StatItemProps) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
        style={{
          background: color
            ? `color-mix(in srgb, ${color} 12%, transparent)`
            : 'color-mix(in srgb, var(--paper-100) 6%, transparent)',
          color: color ?? 'var(--text-secondary)',
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] leading-tight mb-0.5"
          style={{ color: 'var(--text-muted)' }}
        >
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="text-sm font-semibold leading-tight tabular-nums"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {value}
          </span>
          {subValue && (
            <span
              className="text-[10px] leading-tight"
              style={{ color: 'var(--text-muted)' }}
            >
              {subValue}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// SessionStats Component
// ============================================

export function SessionStats() {
  const sessionStartTime = useWritingStore((s) => s.sessionStartTime)
  const wordCount = useWritingStore((s) => s.wordCount)
  const sessionWordCountStart = useWritingStore((s) => s.sessionWordCountStart)
  const getSessionDuration = useWritingStore((s) => s.getSessionDuration)
  const getSessionWPM = useWritingStore((s) => s.getSessionWPM)
  const dailyStats = useWritingStore((s) => s.dailyStats)

  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Tick every second to update elapsed time
  useEffect(() => {
    if (!sessionStartTime) {
      setElapsed(0)
      return
    }

    const tick = () => {
      setElapsed(getSessionDuration())
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sessionStartTime, getSessionDuration])

  const sessionWords = Math.max(0, wordCount - sessionWordCountStart)
  const wpm = getSessionWPM()
  const todayStats = dailyStats.find((d) => {
    const today = new Date().toISOString().split('T')[0]
    return d.date === today
  })
  const todayWords = todayStats?.wordCount ?? 0
  const todayMinutes = todayStats?.sessionMinutes ?? 0

  const isActive = sessionStartTime !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
      className="px-3 py-3 space-y-2.5"
    >
      {/* Session status indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isActive ? 'var(--color-ifline)' : 'var(--text-muted)',
              boxShadow: isActive
                ? '0 0 6px color-mix(in srgb, var(--color-ifline) 50%, transparent)'
                : 'none',
            }}
            animate={
              isActive
                ? { opacity: [1, 0.4, 1] }
                : { opacity: 1 }
            }
            transition={
              isActive
                ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                : undefined
            }
          />
          <span
            className="text-[10px] font-medium"
            style={{ color: isActive ? 'var(--color-ifline)' : 'var(--text-muted)' }}
          >
            {isActive ? '写作中' : '未开始'}
          </span>
        </div>
        <AnimatePresence>
          {isActive && (
            <motion.span
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="text-[10px] tabular-nums"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {formatDuration(elapsed)}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatItem
          icon={<Clock className="w-3.5 h-3.5" />}
          label="会话时长"
          value={isActive ? formatDuration(elapsed) : '--'}
          color="var(--color-outline)"
        />
        <StatItem
          icon={<Type className="w-3.5 h-3.5" />}
          label="会话字数"
          value={isActive ? formatWordCount(sessionWords) : '--'}
          subValue={sessionWords > 0 ? '字' : undefined}
          color="var(--color-ifline)"
        />
        <StatItem
          icon={<Gauge className="w-3.5 h-3.5" />}
          label="写作速度"
          value={wpm > 0 ? String(Math.round(wpm)) : '--'}
          subValue={wpm > 0 ? '字/分' : undefined}
          color="var(--color-character)"
        />
        <StatItem
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="今日累计"
          value={formatWordCount(todayWords)}
          subValue={todayMinutes > 0 ? `${todayMinutes}分钟` : undefined}
          color="var(--accent-100)"
        />
      </div>
    </motion.div>
  )
}
