import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { Timer, Play, Pause, RotateCcw, Settings, X, Coffee } from 'lucide-react'

const DEFAULT_SPRINT_MINUTES = 25
const DEFAULT_BREAK_MINUTES = 5

interface SprintTimerState {
  isRunning: boolean
  isBreak: boolean
  timeRemaining: number
  totalTime: number
  sprintCount: number
}

export function WritingSprintTimer() {
  const [isOpen, setIsOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sprintMinutes, setSprintMinutes] = useState(DEFAULT_SPRINT_MINUTES)
  const [breakMinutes, setBreakMinutes] = useState(DEFAULT_BREAK_MINUTES)
  const [timer, setTimer] = useState<SprintTimerState>({
    isRunning: false,
    isBreak: false,
    timeRemaining: DEFAULT_SPRINT_MINUTES * 60,
    totalTime: DEFAULT_SPRINT_MINUTES * 60,
    sprintCount: 0,
  })
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  // Create audio context for notification
  useEffect(() => {
    // Simple beep using Web Audio API
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
        oscillator.frequency.value = timer.isBreak ? 523.25 : 440 // C5 for break, A4 for sprint
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
          // Timer finished
          playNotification()
          const isBreak = !prev.isBreak
          const totalTime = isBreak ? breakMinutes * 60 : sprintMinutes * 60
          return {
            ...prev,
            isRunning: false,
            isBreak,
            timeRemaining: totalTime,
            totalTime,
            sprintCount: isBreak ? prev.sprintCount + 1 : prev.sprintCount,
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
        <span className="tabular-nums font-semibold">{formatTime(timer.timeRemaining)}</span>
        {timer.isBreak && <Coffee className="w-3 h-3" />}
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
      {/* Refined Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] relative overflow-hidden">
        {/* Subtle header gradient */}
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
            <Timer
              className={`w-4 h-4 ${timer.isBreak ? 'text-[var(--color-ifline)]' : 'text-[var(--accent-primary)]'}`}
            />
          </motion.div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {timer.isBreak ? '休息时间' : '写作冲刺'}
          </span>
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
      <div className="p-4 flex flex-col items-center gap-3">
        {/* Progress ring */}
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={timer.isBreak ? 'var(--color-ifline)' : 'var(--accent-primary)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - progressPercent / 100)}`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-mono font-bold text-[var(--text-primary)]"
            >
              {formatTime(timer.timeRemaining)}
            </span>
            <span className="text-[10px] mt-0.5 text-[var(--text-tertiary)]">
              {timer.isBreak ? '休息一下' : '专注写作'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {timer.isRunning ? (
            <Button
              onClick={pauseTimer}
              variant="ghost"
              size="sm"
              className="h-8 px-3 bg-[var(--hover-bg)] border border-[var(--border-default)]"
            >
              <Pause className="w-4 h-4 mr-1" />
              暂停
            </Button>
          ) : (
            <Button
              onClick={startTimer}
              variant="primary"
              size="sm"
              className="h-8 px-3"
            >
              <Play className="w-4 h-4 mr-1" />
              开始
            </Button>
          )}
          <Button
            onClick={resetTimer}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="重置"
          >
            <RotateCcw className="w-4 h-4 text-[var(--text-secondary)]" />
          </Button>
        </div>

        {/* Sprint count */}
        <div className="text-[10px] text-[var(--text-tertiary)]">
          已完成 {timer.sprintCount} 个冲刺
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 pb-4 pt-3 border-t border-[var(--border-default)]">
          <div className="space-y-3">
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
                <span className="text-xs w-10 text-right text-[var(--text-primary)]">{sprintMinutes}分</span>
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
                <span className="text-xs w-10 text-right text-[var(--text-primary)]">{breakMinutes}分</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default WritingSprintTimer
