import { useUIStore, useWritingStore, useCheckerStore, useAIStore } from '@/store'
import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  AlertTriangle,
  Moon,
  Sun,
  Eye,
  Palette,
  Coffee,
  TreePine,
  Maximize2,
  Minimize2,
  EyeOff,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { showToast } from '@/components/ui/Toast'
import { useThemeContext } from '@/components/shared/ThemeProvider'
import type { Theme } from '@/hooks/useTheme'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

const themeIconMap: Record<Theme, React.ReactNode> = {
  dark: <Icon icon={Moon} size="sm" />,
  light: <Icon icon={Sun} size="sm" />,
  'eye-care': <Icon icon={Eye} size="sm" />,
  'deep-blue': <Icon icon={Palette} size="sm" />,
  'sepia': <Icon icon={Coffee} size="sm" />,
  'forest': <Icon icon={TreePine} size="sm" />,
}

export function ToolbarRightSection() {
  const { theme, toggleTheme } = useThemeContext()
  const {
    immersiveMode,
    toggleImmersiveMode,
    focusModeEnabled,
    toggleFocusMode,
  } = useUIStore()
  const {
    wordCount,
  } = useWritingStore()
  const {
    oocWarnings,
    powerImbalanceWarnings,
  } = useCheckerStore()

  const hasWarnings = oocWarnings.length > 0 || powerImbalanceWarnings.length > 0

  const handleWarningClick = () => {
    const oocMsg = oocWarnings.length > 0 ? `OOC警告:\n${oocWarnings.join('\n')}` : ''
    const powerMsg = powerImbalanceWarnings.length > 0 ? `战力失衡警告:\n${powerImbalanceWarnings.join('\n')}` : ''
    showToast(`${oocMsg}${oocMsg && powerMsg ? '\n\n' : ''}${powerMsg}`, 'warning')
  }

  return (
    <div className="ml-auto flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
      <AIStatusIndicator />

      <TodayProgress />

      <Divider />

      <span
        className="text-xs font-medium tabular-nums px-1"
        style={{ color: 'var(--text-secondary)' }}
      >
        {wordCount} 字
      </span>

      {hasWarnings && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleWarningClick}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
            color: 'var(--color-danger)',
            border: '1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)',
          }}
          title={`OOC: ${oocWarnings.length}, 战力: ${powerImbalanceWarnings.length}`}
        >
          <Icon icon={AlertTriangle} size="xs" />
          <span className="hidden sm:inline">{oocWarnings.length + powerImbalanceWarnings.length}</span>
        </motion.button>
      )}

      <IconButton
        onClick={toggleTheme}
        icon={themeIconMap[theme] || themeIconMap.dark}
        title={`当前主题: ${theme}`}
      />

      <IconButton
        onClick={toggleImmersiveMode}
        icon={immersiveMode ? <Icon icon={Minimize2} size="sm" /> : <Icon icon={Maximize2} size="sm" />}
        title={immersiveMode ? '退出沉浸模式' : '进入沉浸模式'}
        isActive={immersiveMode}
        glowColor="var(--color-character)"
      />

      <IconButton
        onClick={toggleFocusMode}
        icon={focusModeEnabled ? <Icon icon={EyeOff} size="sm" /> : <Icon icon={Eye} size="sm" />}
        title={focusModeEnabled ? '退出专注模式' : '进入专注模式'}
        isActive={focusModeEnabled}
      />
    </div>
  )
}

function AIStatusIndicator() {
  const { loading } = useAIStore()
  const isAIGenerating = loading.ai

  return (
    <AnimatePresence>
      {isAIGenerating && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse motion-reduce:animate-none"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          />
          <span className="text-[10px] font-medium" style={{ color: 'var(--accent-primary)' }}>
            AI生成中
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TodayProgress() {
  const { getTodayWordCount, targetWordCount } = useWritingStore()
  const todayWordCount = getTodayWordCount()

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 mr-1 px-2 py-1 rounded-lg"
      style={{
        background: 'color-mix(in srgb, var(--color-surface-raised) 60%, transparent)',
        border: '1px solid color-mix(in srgb, var(--border-subtle) 30%, transparent)',
      }}
      title="今日写作进度"
    >
      <Icon icon={BarChart3} size="xs" color="accent" />
      <div className="w-14 h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'var(--accent-primary)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (todayWordCount / Math.max(1, targetWordCount)) * 100)}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
        {todayWordCount}
      </span>
    </div>
  )
}

const Divider = memo(function Divider() {
  return (
    <div
      className="w-px h-5 flex-shrink-0 mx-0.5"
      style={{
        background: 'linear-gradient(to bottom, transparent, var(--border-default) 20%, var(--border-default) 80%, transparent)',
      }}
    />
  )
})

const IconButton = memo(function IconButton({
  onClick,
  icon,
  title,
  isActive,
  glowColor = 'var(--accent-primary)',
}: {
  onClick: () => void
  icon: React.ReactNode
  title: string
  isActive?: boolean
  glowColor?: string
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      title={title}
      className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 flex-shrink-0 touch-target-min ${
        isActive
          ? 'text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-raised)] hover:border-[var(--border-default)]'
      }`}
      style={isActive ? {
        background: `color-mix(in srgb, ${glowColor} 20%, transparent)`,
        border: `1px solid color-mix(in srgb, ${glowColor} 40%, transparent)`,
        boxShadow: `0 0 12px color-mix(in srgb, ${glowColor} 20%, transparent)`,
      } : {
        border: '1px solid transparent',
      }}
    >
      {icon}
    </motion.button>
  )
})
