/**
 * SprintExpandedPanel - Expanded timer panel with controls, stats, and settings
 */

import { Button } from '@/components/ui/Button'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Settings, X, Coffee, Zap, CheckCircle2, Trophy } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { CircularProgress } from './SimpleCircularProgress'
import { CelebrationAnimation } from './CelebrationAnimation'
import { SprintSettings } from './SprintSettings'

interface SprintExpandedPanelProps {
  isRunning: boolean
  isBreak: boolean
  timeRemaining: number
  totalTime: number
  sprintCount: number
  progressPercent: number
  currentColor: string
  formatTime: (seconds: number) => string
  showSettings: boolean
  showCelebration: boolean
  sprintMinutes: number
  breakMinutes: number
  onStart: () => void
  onPause: () => void
  onReset: () => void
  onClose: () => void
  onToggleSettings: () => void
  onCelebrationComplete: () => void
  onSprintMinutesChange: (val: number) => void
  onBreakMinutesChange: (val: number) => void
}

export function SprintExpandedPanel({
  isRunning,
  isBreak,
  timeRemaining,
  totalTime,
  sprintCount,
  progressPercent,
  currentColor,
  formatTime,
  showSettings,
  showCelebration,
  sprintMinutes,
  breakMinutes,
  onStart,
  onPause,
  onReset,
  onClose,
  onToggleSettings,
  onCelebrationComplete,
  onSprintMinutesChange,
  onBreakMinutesChange,
}: SprintExpandedPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      className="fixed right-4 top-16 z-50 w-64 flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-float), 0 0 0 1px var(--border-subtle)',
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
            background: isBreak
              ? 'linear-gradient(135deg, color-mix(in srgb, var(--color-ifline) 4%, transparent) 0%, transparent 60%)'
              : 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 4%, transparent) 0%, transparent 60%)',
          }}
        />
        <div className="flex items-center gap-2.5 relative z-10">
          <motion.div
            animate={isRunning ? { rotate: 360 } : {}}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            {isBreak ? (
              <Coffee className="w-4 h-4 text-[var(--color-ifline)]" />
            ) : (
              <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
            )}
          </motion.div>
          <div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {isBreak ? '休息时间' : '写作冲刺'}
            </span>
            {sprintCount > 0 && (
              <span className="ml-1.5 text-[10px] text-[var(--text-tertiary)]">
                第 {sprintCount + 1} 轮
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 relative z-10">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleSettings}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
            title="设置"
          >
            <Settings className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
            title="关闭"
          >
            <X className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
          </motion.button>
        </div>
      </div>

      {/* Timer Display */}
      <div className="p-4 flex flex-col items-center gap-3 relative">
        <AnimatePresence>
          {showCelebration && (
            <CelebrationAnimation onComplete={onCelebrationComplete} />
          )}
        </AnimatePresence>

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
              {formatTime(timeRemaining)}
            </span>
            <span className="text-[10px] mt-1 text-[var(--text-tertiary)]">
              {isBreak ? '放松一下，充电中' : '保持专注，高效写作'}
            </span>
          </div>
        </CircularProgress>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={onPause}
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
                onClick={onStart}
                variant="accent"
                size="sm"
                className="h-9 px-4"
              >
                <Play className="w-4 h-4 mr-1.5" />
                {timeRemaining === totalTime ? '开始' : '继续'}
              </Button>
            </motion.div>
          )}
          <motion.div whileHover={{ scale: 1.1, rotate: -180 }} whileTap={{ scale: 0.9 }}>
            <Button
              onClick={onReset}
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
            <span>已完成 {sprintCount} 个冲刺</span>
          </div>
          {sprintCount >= 4 && (
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
            transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
            className="overflow-hidden"
          >
            <SprintSettings
              sprintMinutes={sprintMinutes}
              breakMinutes={breakMinutes}
              onSprintMinutesChange={onSprintMinutesChange}
              onBreakMinutesChange={onBreakMinutesChange}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
