import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

interface StatusBarProps {
  chapterTitle: string
  wordCount: number
  todayWordCount: number
  targetWordCount: number
  sessionDuration: string
  sessionWPM: number
  humanAIRatio: number
  writingStyle: string
  focusModeEnabled: boolean
  onToggleFocusMode: () => void
}

const WRITING_STYLE_NAMES: Record<string, string> = {
  default: '默认',
  jiangnan: '江南',
  kafka: '卡夫卡',
  camus: '加缪',
  custom: '自定义',
}

export function StatusBar({
  chapterTitle,
  wordCount,
  todayWordCount,
  targetWordCount,
  sessionDuration,
  sessionWPM,
  humanAIRatio,
  writingStyle,
  focusModeEnabled,
  onToggleFocusMode,
}: StatusBarProps) {
  return (
    <div
      className="flex items-center px-5 py-2 text-xs font-medium glass-ink"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.03)',
        color: 'var(--text-tertiary)',
        fontFamily: 'var(--font-sans)',
        minHeight: '36px',
        gap: '2px',
      }}
    >
      <span
        className="px-2 py-0.5 rounded-md"
        style={{
          color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {chapterTitle}
      </span>
      <span className="mx-1.5 opacity-15">|</span>
      <span className="px-1.5">{wordCount} 字</span>
      <span className="mx-1.5 opacity-15">|</span>
      <span className="px-1.5">
        今日: {todayWordCount} / {targetWordCount} 字
      </span>
      <span className="mx-1.5 opacity-15">|</span>
      <span className="px-1.5">时长: {sessionDuration}</span>
      <span className="mx-1.5 opacity-15">|</span>
      <span className="px-1.5">速度: {sessionWPM} 字/分</span>
      <span className="mx-1.5 opacity-15">|</span>
      <span className="px-1.5">人机比例: {humanAIRatio}%</span>
      <span className="mx-1.5 opacity-15">|</span>
      <span className="px-1.5" style={{ color: 'var(--color-character)' }}>
        文笔: {WRITING_STYLE_NAMES[writingStyle] || writingStyle}
      </span>
      <span className="mx-1.5 opacity-15">|</span>
      <button
        onClick={onToggleFocusMode}
        className={`px-2 py-0.5 rounded-md text-xs transition-all duration-200 ${
          focusModeEnabled
            ? 'text-[var(--color-outline)]'
            : 'text-[var(--text-tertiary)]'
        }`}
        style={focusModeEnabled ? {
          background: 'color-mix(in srgb, var(--color-outline) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-outline) 20%, transparent)',
        } : {
          border: '1px solid transparent',
        }}
        onMouseEnter={(e) => {
          if (!focusModeEnabled) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'
          }
        }}
        onMouseLeave={(e) => {
          if (!focusModeEnabled) {
            (e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'transparent'
          }
        }}
        title="聚焦模式 (Ctrl+Shift+F)"
      >
        {focusModeEnabled ? '聚焦中' : '聚焦'}
      </button>
    </div>
  )
}