/**
 * WritingSprintTimer - Pomodoro-style sprint timer for focused writing
 *
 * Sub-components: CircularProgress, CelebrationAnimation, SprintSettings,
 *                 SprintCompactButton, SprintExpandedPanel
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { SprintCompactButton } from './SprintCompactButton'
import { SprintExpandedPanel } from './SprintExpandedPanel'
import { writingSettingsApi } from '@/api/settings'

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
  const [showCelebration, setShowCelebration] = useState(false)
  const [timer, setTimer] = useState<SprintTimerState>({
    isRunning: false,
    isBreak: false,
    timeRemaining: DEFAULT_SPRINT_MINUTES * 60,
    totalTime: DEFAULT_SPRINT_MINUTES * 60,
    sprintCount: 0,
  })
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(false)

  // Load sprint data from backend on mount
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    writingSettingsApi.get().then((settings) => {
      if (settings.sprint_data_json) {
        try {
          const data = JSON.parse(settings.sprint_data_json) as {
            sprintMinutes?: number
            breakMinutes?: number
            sprintCount?: number
          }
          if (data.sprintMinutes) setSprintMinutes(data.sprintMinutes)
          if (data.breakMinutes) setBreakMinutes(data.breakMinutes)
          if (data.sprintCount) {
            setTimer((prev) => ({ ...prev, sprintCount: data.sprintCount! }))
          }
          if (data.sprintMinutes) {
            setTimer((prev) => ({
              ...prev,
              timeRemaining: data.sprintMinutes! * 60,
              totalTime: data.sprintMinutes! * 60,
            }))
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }).catch(() => {
      // Backend unavailable, use defaults
    })
  }, [])

  // Debounced save of sprint data to backend
  const saveSprintData = useCallback(
    (sm: number, bm: number, sc: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        writingSettingsApi.saveSprintData({
          sprintMinutes: sm,
          breakMinutes: bm,
          sprintCount: sc,
        }).catch(() => {
          // Save failed silently
        })
      }, 1500)
    },
    []
  )

  // Persist sprint data when sprintMinutes, breakMinutes, or sprintCount change
  useEffect(() => {
    if (!loadedRef.current) return
    saveSprintData(sprintMinutes, breakMinutes, timer.sprintCount)
  }, [sprintMinutes, breakMinutes, timer.sprintCount, saveSprintData])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
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
    return (
      <SprintCompactButton
        timeRemaining={formatTime(timer.timeRemaining)}
        isRunning={timer.isRunning}
        isBreak={timer.isBreak}
        sprintCount={timer.sprintCount}
        onOpen={() => setIsOpen(true)}
      />
    )
  }

  return (
    <SprintExpandedPanel
      isRunning={timer.isRunning}
      isBreak={timer.isBreak}
      timeRemaining={timer.timeRemaining}
      totalTime={timer.totalTime}
      sprintCount={timer.sprintCount}
      progressPercent={progressPercent}
      currentColor={currentColor}
      formatTime={formatTime}
      showSettings={showSettings}
      showCelebration={showCelebration}
      sprintMinutes={sprintMinutes}
      breakMinutes={breakMinutes}
      onStart={() => setTimer((prev) => ({ ...prev, isRunning: true }))}
      onPause={() => setTimer((prev) => ({ ...prev, isRunning: false }))}
      onReset={() => setTimer((prev) => ({
        ...prev,
        isRunning: false,
        timeRemaining: prev.isBreak ? breakMinutes * 60 : sprintMinutes * 60,
        totalTime: prev.isBreak ? breakMinutes * 60 : sprintMinutes * 60,
      }))}
      onClose={() => setIsOpen(false)}
      onToggleSettings={() => setShowSettings(!showSettings)}
      onCelebrationComplete={() => setShowCelebration(false)}
      onSprintMinutesChange={(val) => {
        setSprintMinutes(val)
        if (!timer.isRunning && !timer.isBreak) {
          setTimer((prev) => ({ ...prev, timeRemaining: val * 60, totalTime: val * 60 }))
        }
      }}
      onBreakMinutesChange={(val) => {
        setBreakMinutes(val)
        if (!timer.isRunning && timer.isBreak) {
          setTimer((prev) => ({ ...prev, timeRemaining: val * 60, totalTime: val * 60 }))
        }
      }}
    />
  )
}

export default WritingSprintTimer
