import { motion, useSpring } from 'framer-motion'
import { useEffect } from 'react'
import { BookOpen, Clock } from 'lucide-react'

interface StatsChartProps {
  wordCount: number
  todayWordCount: number
  targetWordCount: number
  sessionDuration: number
  burstWPM: number
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

export function StatsChart({
  wordCount,
  todayWordCount,
  targetWordCount,
  sessionDuration,
  burstWPM,
}: StatsChartProps) {
  const animatedTodayWordCount = useSpring(todayWordCount, {
    stiffness: 80,
    damping: 25,
    mass: 1,
  })

  useEffect(() => {
    animatedTodayWordCount.set(todayWordCount)
  }, [todayWordCount, animatedTodayWordCount])

  const progressPercentage = Math.min(100, Math.round((todayWordCount / targetWordCount) * 100))
  const progressColor = getProgressColor(progressPercentage)

  return (
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
          <BookOpen className="w-3 h-3" style={{ color: 'var(--icon-secondary)' }} />
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>预计阅读</span>
        </div>
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {estimateReadTime(wordCount)}
        </span>
      </div>

      {/* Session duration */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" style={{ color: 'var(--icon-secondary)' }} />
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>本次时长</span>
        </div>
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {formatDuration(sessionDuration)}
        </span>
      </div>

      {/* Today's progress */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>今日进度</span>
          <motion.span
            className="text-[11px] font-semibold"
            style={{ color: progressColor }}
            key={todayWordCount}
          >
            {Math.round(animatedTodayWordCount.get())} / {targetWordCount}
          </motion.span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{
            background: 'color-mix(in srgb, var(--paper-100) 3%, transparent)',
            boxShadow: 'inset 0 1px 2px color-mix(in srgb, var(--ink-100) 15%, transparent)',
          }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${progressColor}cc, ${progressColor})`,
              boxShadow: `0 0 8px ${progressColor}50`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="flex justify-end mt-1">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{progressPercentage}%</span>
        </div>
      </div>
    </div>
  )
}
