import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
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
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                   transition-all duration-200 border
                   ${timer.isRunning
                     ? timer.isBreak
                       ? 'bg-[#7eb84a]/10 border-[#7eb84a]/30 text-[#7eb84a]'
                       : 'bg-[#5e6ad2]/10 border-[#5e6ad2]/30 text-[#5e6ad2]'
                     : 'bg-[rgba(255,255,255,0.02)] border-[rgba(255,255,255,0.08)] text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.05)]'
                   }`}
        title="写作冲刺计时器"
      >
        <Timer className="w-3.5 h-3.5" />
        <span>{formatTime(timer.timeRemaining)}</span>
        {timer.isBreak && <Coffee className="w-3 h-3" />}
      </button>
    )
  }

  return (
    <div className="fixed right-4 top-16 z-50 w-64 flex flex-col
                    bg-[#191a1b] border border-[rgba(255,255,255,0.08)] rounded-xl
                    shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5
                      border-b border-[rgba(255,255,255,0.08)]"
      >
        <div className="flex items-center gap-2">
          <Timer className={`w-4 h-4 ${timer.isBreak ? 'text-[#7eb84a]' : 'text-[#5e6ad2]'}`} />
          <span className="text-sm font-medium text-[#f7f8f8]">
            {timer.isBreak ? '休息时间' : '写作冲刺'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="设置"
          >
            <Settings className="w-3.5 h-3.5 text-[#d0d6e0]" />
          </Button>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="关闭"
          >
            <X className="w-3.5 h-3.5 text-[#d0d6e0]" />
          </Button>
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
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke={timer.isBreak ? '#7eb84a' : '#5e6ad2'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - progressPercent / 100)}`}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-mono font-bold text-[#f7f8f8]"
            >
              {formatTime(timer.timeRemaining)}
            </span>
            <span className="text-[10px] text-[#d0d6e0]/60 mt-0.5">
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
              className="h-8 px-3 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]"
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
            <RotateCcw className="w-4 h-4 text-[#d0d6e0]" />
          </Button>
        </div>

        {/* Sprint count */}
        <div className="text-[10px] text-[#d0d6e0]/50">
          已完成 {timer.sprintCount} 个冲刺
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 pb-4 border-t border-[rgba(255,255,255,0.08)] pt-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#d0d6e0]">冲刺时长</span>
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
                  className="w-20 accent-[#5e6ad2]"
                />
                <span className="text-xs text-[#f7f8f8] w-10 text-right">{sprintMinutes}分</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#d0d6e0]">休息时长</span>
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
                  className="w-20 accent-[#7eb84a]"
                />
                <span className="text-xs text-[#f7f8f8] w-10 text-right">{breakMinutes}分</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WritingSprintTimer
