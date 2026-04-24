import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Play, Pause, RotateCcw, Settings, X, Coffee, Trophy, Zap, CheckCircle2 } from 'lucide-react'

const DEFAULT_SPRINT_MINUTES = 25
const DEFAULT_BREAK_MINUTES = 5

interface SprintTimerState {
  isRunning: boolean
  isBreak: boolean
  timeRemaining: number
  totalTime: number
  sprintCount: number
}

/* ============================================================
   CircularProgress — Elegant circular progress indicator
   ============================================================ */

function CircularProgress({
  progress,
  size = 128,
  strokeWidth = 6,
  color,
  children,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  color: string
  children: React.ReactNode
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress / 100)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-linear"
          style={{
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
        {/* Glow effect underneath */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity={0.15}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

/* ============================================================
   CelebrationAnimation — Completion celebration
   ============================================================ */

function CelebrationAnimation({ onComplete }: { onComplete: () => void }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i / 12) * 360,
    color: ['#e8b87d', '#7eb84a', '#5eb5a6', '#5b8ee8', '#c45c5c', '#9b7ed9'][i % 6],
    distance: 40 + Math.random() * 40,
    size: 4 + Math.random() * 4,
  }))

  useEffect(() => {
    const timer = setTimeout(onComplete, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1, 0.5],
            x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
            y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 8px ${p.color}80`,
          }}
        />
      ))}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(126, 184, 74, 0.2) 0%, rgba(94, 181, 166, 0.2) 100%)',
            border: '1px solid rgba(126, 184, 74, 0.3)',
          }}
        >
          <Trophy className="w-7 h-7 text-[var(--color-success)]" />
        </div>
      </motion.div>
    </div>
  )
}

/* ============================================================
   WritingSprintTimer — Main Component
   ============================================================ */

export function WritingSprintTimer() {
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sprintMinutes, setSprintMinutes] = useState(DEFAULT_SPRINT_MINUTES)
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES)
  const [showCelebration, setShowCelebration] = useState(false)
  const [timer, setTimer] = useState<SprintTimerState>({
    isRunning: false,
    isBreak: false,
    timeRemaining: DEFAULT_SPRINT_MINUTES * 60,
    totalTime: DEFAULT_SPRINT_MINUTES * 60,
    sprintCount: 0,
  })
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const playNotification = useCallback(() => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        const ctx = new AudioContext()
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.frequency.value = timer.isBreak ? 523.25 : 440
        oscillator.type = 'sine'
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 0.5)
      }
    } catch {
      // Audio not available
    }
  }, [timer.isBreak])

  const startTimer = useCallback(() => {
    setTimer((prev) => ({ ...prev, isRunning: true }))
  }, [])

  const pauseTimer = useCallback(() => {
    setTimer((prev) => ({ ...prev, isRunning: false }))
  }, [])

  const resetTimer = useCallback(() => {
    setTimer((prev) => ({
      ...prev,
      isRunning: false,
      timeRemaining: prev.isBreak ? breakMinutes * 60 : sprintMinutes * 60,
      totalTime: prev.isBreak ? breakMinutes * 60 : sprintMinutes * 60,
    }))
  }, [sprintMinutes, breakMinutes])

  // Timer tick
  useEffect(() => {
    if (!timer.isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev.timeRemaining <= 1) {
          playNotification()
          const isBreak = !prev.isBreak
          const totalTime = isBreak ? breakMinutes * 60 : sprintMinutes * 60
          const newSprintCount = isBreak ? prev.sprintCount + 1 : prev.sprintCount

          // Show celebration on sprint completion
          if (!isBreak) {
            setShowCelebration(true)
          }

          return {
            ...prev,
            isRunning: false,
            isBreak,
            timeRemaining: totalTime,
            totalTime,
            sprintCount: newSprintCount,
          }
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 }
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timer.isRunning, breakMinutes, sprintMinutes, playNotification])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const progressPercent = timer.totalTime > 0
    ? ((timer.totalTime - timer.timeRemaining) / timer.totalTime) * 100
    : 0

  const currentColor = timer.isBreak ? 'var(--color-ifline)' : 'var(--accent-primary)'

  // Compact button when closed
  if (!isOpen) {
    const timerBg = timer.isRunning
      ? timer.isBreak
        ? 'bg-[var(--color-ifline)]/10'
        : 'bg-[var(--accent-primary)]/10'
      : 'bg-[var(--color-surface-raised)]'
    const timerBorder = timer.isRunning
      ? timer.isBreak
        ? 'border-[var(--color-ifline)]/30'
        : 'border-[var(--accent-primary)]/30'
      : 'border-[var(--border-default)]'
    const timerText = timer.isRunning
      ? timer.isBreak
        ? 'text-[var(--color-ifline)]'
        : 'text-[var(--accent-primary)]'
      : 'text-[var(--text-secondary)]'
    const timerGlow = timer.isRunning
      ? timer.isBreak
        ? 'shadow-[0_0_12px_rgba(126,184,74,0.15)]'
        : 'shadow-[0_0_12px_rgba(94,106,210,0.15)]'
      : 'shadow-drawer'

    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setIsOpen(true)}
        className={`fixed right-4 top-16 z-50 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                   transition-all duration-200 border ${timerBg} ${timerBorder} ${timerText} ${timerGlow}`}
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        title="写作冲刺计时器"
      >
        {timer.isRunning ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <Timer className="w-3.5 h-3.5" />
          </motion.div>
        ) : (
          <Timer className="w-3.5 h-3.5" />
        )}
        <span className="tabular-nums font-semibold tracking-tight">{formatTime(timer.timeRemaining)}</span>
        {timer.isBreak && <Coffee className="w-3 h-3" />}
        {timer.sprintCount > 0 && (
          <span className="text-[10px] opacity-60">({timer.sprintCount})</span>
        )}
        {timer.isRunning && (
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: timer.isBreak ? 'var(--color-ifline)' : 'var(--accent-primary)',
            }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </motion.button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed right-4 top-16 z-50 w-64 flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.30), 0 4px 12px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.03)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Subtle panel texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.012]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            background: timer.isBreak
              ? 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 4%, transparent) 0%, transparent 60%)'
              : 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 4%, transparent) 0%, transparent 60%)',
          }}
        />
        <div className="flex items-center gap-2.5 relative z-10">
          <motion.div
            animate={timer.isRunning ? { rotate: 360 } : {}}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            {timer.isBreak ? (
              <Coffee className="w-4 h-4 text-[var(--color-ifline)]" />
            ) : (
              <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
            )}
          </motion.div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {timer.isBreak ? '休息时间' : '写作冲刺'}
            </span>
            {timer.sprintCount > 0 && (
              <span className="ml-1.5 text-[10px] text-[var(--text-tertiary)]">
                第 {timer.sprintCount + 1} 轮
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 relative z-10">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSettings(!showSettings)}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
            title="设置"
          >
            <Settings className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(false)}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
            title="关闭"
          >
            <X className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
          </motion.button>
        </div>
      </div>

      {/* Timer Display */}
      <div className="p-4 flex flex-col items-center gap-3 relative">
        {/* Celebration overlay */}
        <AnimatePresence>
          {showCelebration && (
            <CelebrationAnimation onComplete={() => setShowCelebration(false)} />
          )}
        </AnimatePresence>

        {/* Progress ring */}
        <CircularProgress
          progress={progressPercent}
          size={140}
          strokeWidth={5}
          color={currentColor}
        >
          <div className="flex flex-col items-center">
            <span
              className="text-3xl font-mono font-bold text-[var(--text-primary)] tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(timer.timeRemaining)}
            </span>
            <span className="text-[10px] mt-1 text-[var(--text-tertiary)]">
              {timer.isBreak ? '放松一下，充电中' : '保持专注，高效写作'}
            </span>
          </div>
        </CircularProgress>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {timer.isRunning ? (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={pauseTimer}
                variant="ghost"
                size="sm"
                className="h-9 px-4 bg-[var(--hover-bg)] border border-[var(--border-default)] hover:border-[var(--border-strong)]"
              >
                <Pause className="w-4 h-4 mr-1.5" />
                暂停
              </Button>
            </motion.div>
          ) : (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={startTimer}
                variant="primary"
                size="sm"
                className="h-9 px-4"
              >
                <Play className="w-4 h-4 mr-1.5" />
                {timer.timeRemaining === timer.totalTime ? '开始' : '继续'}
              </Button>
            </motion.div>
          )}
          <motion.div whileHover={{ scale: 1.1, rotate: -180 }} whileTap={{ scale: 0.9 }}>
            <Button
              onClick={resetTimer}
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              title="重置"
            >
              <RotateCcw className="w-4 h-4 text-[var(--text-secondary)]" />
            </Button>
          </motion.div>
        </div>

        {/* Sprint stats */}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
            <CheckCircle2 className="w-3 h-3 text-[var(--color-success)]" />
            <span>已完成 {timer.sprintCount} 个冲刺</span>
          </div>
          {timer.sprintCount >= 4 && (
            <div className="flex items-center gap-1 text-[10px] text-[var(--color-warning)]">
              <Trophy className="w-3 h-3" />
              <span>太棒了!</span>
            </div>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 border-t border-[var(--border-default)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">冲刺时长</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={5}
                    max={60}
                    step={5}
                    value={sprintMinutes}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setSprintMinutes(val)
                      if (!timer.isRunning && !timer.isBreak) {
                        setTimer((prev) => ({
                          ...prev,
                          timeRemaining: val * 60,
                          totalTime: val * 60,
                        }))
                      }
                    }}
                    className="w-20 accent-[var(--accent-primary)]"
                  />
                  <span className="text-xs w-10 text-right text-[var(--text-primary)] tabular-nums">{sprintMinutes}分</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">休息时长</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    step={1}
                    value={breakMinutes}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      setBreakMinutes(val)
                      if (!timer.isRunning && timer.isBreak) {
                        setTimer((prev) => ({
                          ...prev,
                          timeRemaining: val * 60,
                          totalTime: val * 60,
                        }))
                      }
                    }}
                    className="w-20 accent-[var(--color-ifline)]"
                  />
                  <span className="text-xs w-10 text-right text-[var(--text-primary)] tabular-nums">{breakMinutes}分</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default WritingSprintTimer
