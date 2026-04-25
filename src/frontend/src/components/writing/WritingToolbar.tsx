import { useUIStore, useWritingStore } from '@/store'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pen,
  List,
  MessageCircle,
  Users,
  ArrowLeft,
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
  BarChart3,
  Zap,
  Expand,
  Shrink,
  RefreshCw,
  ArrowRight,
  Paintbrush,
  Bot,
  User,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import React, { memo, useCallback, useState } from 'react'
import { showToast } from '@/components/ui/Toast'
import { getEditorInstance } from '@/store/editorRegistry'
import { useThemeContext } from '@/components/shared/ThemeProvider'
import type { Theme } from '@/hooks/useTheme'

const themeIconMap: Record<Theme, React.ReactNode> = {
  dark: <Moon className="w-4 h-4" />,
  light: <Sun className="w-4 h-4" />,
  'eye-care': <Eye className="w-4 h-4" />,
  'midnight-blue': <Palette className="w-4 h-4" />,
  'warm-paper': <Coffee className="w-4 h-4" />,
  'forest-green': <TreePine className="w-4 h-4" />,
}

export function WritingToolbar() {
  const { theme, toggleTheme } = useThemeContext()
  const {
    aiDrawerOpen,
    collaborationDrawerOpen,
    outlineDrawerOpen,
    toggleAIDrawer,
    toggleCollaborationDrawer,
    toggleOutlineDrawer,
    setCurrentInterface,
    currentInterface,
    immersiveMode,
    toggleImmersiveMode,
    focusModeEnabled,
    toggleFocusMode,
  } = useUIStore()
  const {
    oocWarnings,
    powerImbalanceWarnings,
    wordCount,
    targetWordCount,
    getTodayWordCount,
    humanAIRatio,
    setHumanAIRatio,
    optimize,
    expand,
    condense: shrink,
    rewrite,
    continue: continueWriting,
    polish,
    loading,
  } = useWritingStore()
  const todayWordCount = getTodayWordCount()

  const [showQuickAIOps, setShowQuickAIOps] = useState(false)
  const [quickOpLoading, setQuickOpLoading] = useState<string | null>(null)

  const handleWarningClick = useCallback(() => {
    const oocMsg = oocWarnings.length > 0 ? `OOC警告:\n${oocWarnings.join('\n')}` : ''
    const powerMsg = powerImbalanceWarnings.length > 0 ? `战力失衡警告:\n${powerImbalanceWarnings.join('\n')}` : ''
    showToast(`${oocMsg}${oocMsg && powerMsg ? '\n\n' : ''}${powerMsg}`, 'warning')
  }, [oocWarnings, powerImbalanceWarnings])

  const hasWarnings = oocWarnings.length > 0 || powerImbalanceWarnings.length > 0
  const isAIGenerating = loading.ai

  const handleQuickAIOp = async (
    operation: 'optimize' | 'expand' | 'condense' | 'rewrite' | 'continue' | 'polish'
  ) => {
    const editor = getEditorInstance()
    const selectedText = editor
      ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')
      : ''

    if (!selectedText) {
      showToast('请先选中需要操作的文字', 'warning')
      return
    }

    setQuickOpLoading(operation)
    try {
      let result: string
      switch (operation) {
        case 'optimize':
          result = await optimize(selectedText)
          break
        case 'expand':
          result = await expand(selectedText)
          break
        case 'condense':
          result = await shrink(selectedText)
          break
        case 'rewrite':
          result = await rewrite(selectedText)
          break
        case 'continue':
          result = await continueWriting(selectedText)
          break
        case 'polish':
          result = await polish(selectedText)
          break
        default:
          throw new Error(`Unknown operation: ${operation}`)
      }

      if (editor && result) {
        editor.commands.insertContent(result)
        showToast(`${operation}完成`, 'success')
      }
    } catch (error) {
      console.error(`[快捷AI操作] ${operation} failed:`, error)
      showToast(`${operation}失败`, 'error')
    } finally {
      setQuickOpLoading(null)
    }
  }

  const quickAIOperations = [
    { key: 'optimize', label: '优化', icon: <Zap className="w-3.5 h-3.5" />, shortcut: 'O', color: 'var(--accent-primary)' },
    { key: 'expand', label: '扩写', icon: <Expand className="w-3.5 h-3.5" />, shortcut: 'E', color: 'var(--color-ifline)' },
    { key: 'condense', label: '缩写', icon: <Shrink className="w-3.5 h-3.5" />, shortcut: 'S', color: 'var(--color-character)' },
    { key: 'rewrite', label: '改写', icon: <RefreshCw className="w-3.5 h-3.5" />, shortcut: 'R', color: 'var(--color-item)' },
    { key: 'continue', label: '续写', icon: <ArrowRight className="w-3.5 h-3.5" />, shortcut: 'W', color: 'var(--color-location)' },
    { key: 'polish', label: '润色', icon: <Paintbrush className="w-3.5 h-3.5" />, shortcut: 'P', color: 'var(--color-vermillion)' },
  ] as const

  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-center px-3 sm:px-4 gap-1.5 sm:gap-2 layout-topbar overflow-x-auto writing-toolbar writing-toolbar--glass ${toolbarCollapsed ? 'h-0 opacity-0 overflow-hidden' : 'h-[var(--layout-topbar-height)]'}`}
      style={{
        boxShadow: '0 1px 0 0 var(--border-subtle), 0 4px 20px color-mix(in srgb, var(--ink-100) 10%, transparent)',
      }}
    >
      {/* 左侧：返回聊天 + 返回设定 */}
      <NavButton
        onClick={() => setCurrentInterface('chat')}
        icon={<MessageCircle className="w-4 h-4" />}
        label="返回聊天"
        mobileLabel="聊天"
      />

      <NavButton
        onClick={() => setCurrentInterface('settings')}
        icon={<ArrowLeft className="w-4 h-4" />}
        label="返回设定"
        mobileLabel="设定"
      />

      <Divider />

      {/* 中间：工具按钮 */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <ToolbarButton
          icon={<Pen className="w-4 h-4" />}
          label="写作"
          shortcut="Ctrl+1"
          isActive={currentInterface === 'writing'}
          onClick={() => setCurrentInterface('writing')}
        />
        <ToolbarButton
          icon={<List className="w-4 h-4" />}
          label="大纲"
          shortcut="Ctrl+2"
          isActive={outlineDrawerOpen}
          onClick={toggleOutlineDrawer}
        />
        <ToolbarButton
          icon={<MessageCircle className="w-4 h-4" />}
          label="AI操作"
          shortcut="Ctrl+3"
          isActive={aiDrawerOpen}
          onClick={toggleAIDrawer}
          badge={aiDrawerOpen ? undefined : ' '}
        />
        <ToolbarButton
          icon={<Users className="w-4 h-4" />}
          label="协作"
          shortcut="Ctrl+4"
          isActive={collaborationDrawerOpen}
          onClick={toggleCollaborationDrawer}
        />
      </div>

      {/* 中间偏右：人机比例快捷滑块 + 快捷AI操作 */}
      <div className="hidden lg:flex items-center gap-2 ml-2 flex-shrink-0">
        <Divider />

        {/* Human-AI ratio mini control - refined visual with glow track */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
          style={{
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--border-default)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2), 0 1px 0 color-mix(in srgb, var(--paper-100) 3%, transparent)',
          }}
        >
          <motion.div
            whileHover={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          </motion.div>
          <div className="w-28">
            <RatioSlider
              value={[humanAIRatio]}
              min={0}
              max={100}
              step={10}
              onValueChange={(value) => setHumanAIRatio(value[0])}
            />
          </div>
          <motion.div
            whileHover={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <User className="w-3.5 h-3.5 text-[var(--icon-secondary)]" />
          </motion.div>
          <span
            className="text-[10px] w-9 text-center font-semibold tracking-wide tabular-nums"
            style={{
              color: humanAIRatio < 30
                ? 'var(--accent-primary)'
                : humanAIRatio < 70
                  ? 'var(--color-ifline)'
                  : 'var(--color-character)',
            }}
          >
            {humanAIRatio < 30 ? 'AI' : humanAIRatio < 70 ? '协作' : '用户'}
          </span>
        </div>

        {/* Quick AI operations dropdown */}
        <div className="relative">
          <QuickAIButton
            onClick={() => setShowQuickAIOps(!showQuickAIOps)}
            isActive={showQuickAIOps}
            isLoading={isAIGenerating}
          />

          <AnimatePresence>
            {showQuickAIOps && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1.5 z-50 p-1.5 rounded-xl shadow-2xl min-w-[200px]"
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--border-default)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px var(--border-subtle)',
                }}
              >
                <div
                  className="text-[10px] px-2 py-1 uppercase tracking-wider font-medium"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  选中文字后执行
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {quickAIOperations.map((op) => (
                    <QuickOpButton
                      key={op.key}
                      op={op}
                      isLoading={quickOpLoading === op.key}
                      isDisabled={quickOpLoading !== null}
                      onClick={() => {
                        handleQuickAIOp(op.key)
                        setShowQuickAIOps(false)
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Toolbar collapse toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setToolbarCollapsed(!toolbarCollapsed)}
        className="hidden md:flex items-center justify-center w-6 h-6 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0"
        title={toolbarCollapsed ? '展开工具栏' : '收起工具栏'}
      >
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${toolbarCollapsed ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* 右侧：字数统计、警告和主题切换 */}
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* AI生成状态指示 - enhanced with glow animation */}
        <AnimatePresence>
          {isAIGenerating && (
            <motion.div
              initial={{ opacity: 0, x: 8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-primary) 30%, transparent)',
                boxShadow: '0 0 12px color-mix(in srgb, var(--accent-primary) 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Sparkles className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
              </motion.div>
              <motion.span
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-[10px] font-semibold"
                style={{ color: 'var(--accent-primary)' }}
              >
                AI生成中
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 今日进度 - gradient fill */}
        <div
          className="hidden sm:flex items-center gap-1.5 mr-1 px-2 py-1 rounded-lg"
          style={{ background: 'var(--color-surface-raised)' }}
          title="今日写作进度"
        >
          <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          <div className="w-16 h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--color-ifline) 100%)',
                boxShadow: '0 0 8px color-mix(in srgb, var(--accent-100) 35%, transparent)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (todayWordCount / Math.max(1, targetWordCount)) * 100)}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {todayWordCount}/{targetWordCount}
          </span>
        </div>

        <Divider />

        {/* 字数统计 */}
        <span
          className="text-xs font-medium tabular-nums px-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          {wordCount} 字
        </span>

        {/* OOC/战力警告 */}
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
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{oocWarnings.length + powerImbalanceWarnings.length}</span>
          </motion.button>
        )}

        {/* 主题切换 */}
        <IconButton
          onClick={toggleTheme}
          icon={themeIconMap[theme] || themeIconMap.dark}
          title={`当前主题: ${theme}`}
        />

        {/* 沉浸模式切换 */}
        <IconButton
          onClick={toggleImmersiveMode}
          icon={immersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          title={immersiveMode ? '退出沉浸模式' : '进入沉浸模式'}
          isActive={immersiveMode}
          glowColor="var(--color-character)"
        />

        {/* 专注模式切换 */}
        <IconButton
          onClick={toggleFocusMode}
          icon={focusModeEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          title={focusModeEnabled ? '退出专注模式' : '进入专注模式'}
          isActive={focusModeEnabled}
        />
      </div>
    </motion.div>
  )
}

/* ─── Sub-components ─── */

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

const NavButton = memo(function NavButton({
  onClick,
  icon,
  label,
  mobileLabel,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  mobileLabel?: string
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 flex-shrink-0 touch-target-min"
      style={{
        color: 'var(--text-secondary)',
        background: 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-raised)'
        e.currentTarget.style.borderColor = 'var(--border-default)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {mobileLabel && <span className="sm:hidden">{mobileLabel}</span>}
    </motion.button>
  )
})

const ToolbarButton = memo(function ToolbarButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
  shortcut,
}: {
  icon: React.ReactNode
  label: string
  isActive?: boolean
  onClick?: () => void
  badge?: string
  shortcut?: string
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 overflow-hidden flex-shrink-0 group touch-target-min toolbar-btn-glow"
      style={{
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: isActive ? 'var(--accent-primary)' : 'transparent',
        border: isActive ? '1px solid color-mix(in srgb, var(--accent-primary) 60%, transparent)' : '1px solid transparent',
        boxShadow: isActive ? '0 0 16px color-mix(in srgb, var(--accent-primary) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--color-surface-raised)'
          e.currentTarget.style.borderColor = 'var(--border-default)'
          e.currentTarget.style.color = 'var(--text-primary)'
          e.currentTarget.style.boxShadow = '0 0 12px color-mix(in srgb, var(--accent-primary) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
      title={shortcut ? `${label} (${shortcut})` : label}
    >
      <span className="inline-flex items-center justify-center shrink-0 w-4 h-4 relative">
        {icon}
        {/* Hover glow ring */}
        {!isActive && (
          <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 15%, transparent) 0%, transparent 70%)',
            }}
          />
        )}
      </span>
      <span className="inline-flex items-center">{label}</span>
      {shortcut && (
        <span className="hidden xl:inline-flex text-[9px] px-1 py-px rounded font-mono opacity-0 group-hover:opacity-60 transition-opacity duration-200"
          style={{
            background: isActive ? 'rgba(255,255,255,0.15)' : 'var(--color-surface-hover)',
            color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          {shortcut}
        </span>
      )}
      {isActive && (
        <span className="toolbar-active-indicator" />
      )}
      {badge && (
        <span
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: 'var(--color-vermillion)' }}
        />
      )}
    </motion.button>
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
      className="relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 flex-shrink-0 touch-target-min"
      style={{
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: isActive
          ? `color-mix(in srgb, ${glowColor} 20%, transparent)`
          : 'transparent',
        border: isActive
          ? `1px solid color-mix(in srgb, ${glowColor} 40%, transparent)`
          : '1px solid transparent',
        boxShadow: isActive
          ? `0 0 12px color-mix(in srgb, ${glowColor} 20%, transparent)`
          : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'var(--color-surface-raised)'
          e.currentTarget.style.borderColor = 'var(--border-default)'
          e.currentTarget.style.color = 'var(--text-primary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }
      }}
    >
      {icon}
    </motion.button>
  )
})

const QuickAIButton = memo(function QuickAIButton({
  onClick,
  isActive,
  isLoading,
}: {
  onClick: () => void
  isActive: boolean
  isLoading: boolean
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={isLoading}
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 disabled:opacity-60"
      style={{
        color: isActive ? 'var(--text-primary)' : 'var(--accent-primary)',
        background: isActive
          ? 'var(--accent-primary)'
          : 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
        border: isActive
          ? '1px solid color-mix(in srgb, var(--accent-primary) 50%, transparent)'
          : '1px solid color-mix(in srgb, var(--accent-primary) 25%, transparent)',
        boxShadow: isActive
          ? '0 0 16px color-mix(in srgb, var(--accent-primary) 30%, transparent)'
          : '0 0 8px color-mix(in srgb, var(--accent-primary) 10%, transparent)',
      }}
      onMouseEnter={(e) => {
        if (!isActive && !isLoading) {
          e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 18%, transparent)'
          e.currentTarget.style.boxShadow = '0 0 12px color-mix(in srgb, var(--accent-primary) 20%, transparent)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive && !isLoading) {
          e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
          e.currentTarget.style.boxShadow = '0 0 8px color-mix(in srgb, var(--accent-primary) 10%, transparent)'
        }
      }}
    >
      {isLoading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </motion.div>
      ) : (
        <Zap className="w-3.5 h-3.5" />
      )}
      <span>快捷AI</span>
      {isLoading && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse motion-reduce:animate-none"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        />
      )}
    </motion.button>
  )
})

interface QuickOpDef {
  key: string
  label: string
  icon: React.ReactNode
  shortcut: string
  color: string
}

const QuickOpButton = memo(function QuickOpButton({
  op,
  isLoading,
  isDisabled,
  onClick,
}: {
  op: QuickOpDef
  isLoading: boolean
  isDisabled: boolean
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={isDisabled}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        color: 'var(--text-secondary)',
        background: isLoading
          ? 'color-mix(in srgb, var(--accent-primary) 12%, transparent)'
          : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.background = 'var(--color-surface-base)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isLoading) {
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      <span className="inline-flex items-center justify-center shrink-0" style={{ color: op.color }}>
        {op.icon}
      </span>
      <span className="flex-1 text-left font-medium">{op.label}</span>
      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
        ⇧{op.shortcut}
      </span>
    </motion.button>
  )
})

const RatioSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex w-full touch-none select-none items-center group/slider',
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track
      className="relative h-1.5 w-full grow overflow-hidden rounded-full"
      style={{
        background: 'var(--border-default)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
      }}
    >
      <SliderPrimitive.Range
        className="absolute h-full rounded-full"
        style={{
          background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--color-ifline) 100%)',
          boxShadow: '0 0 8px color-mix(in srgb, var(--accent-primary) 30%, transparent)',
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className="block h-5 w-5 rounded-full border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)] disabled:pointer-events-none disabled:opacity-50
                 hover:scale-110 active:scale-95 group-hover/slider:shadow-[0_0_12px_rgba(94,106,210,0.4)]"
      style={{
        borderColor: 'var(--accent-primary)',
        background: 'var(--color-surface-raised)',
        boxShadow: '0 0 8px color-mix(in srgb, var(--accent-primary) 25%, transparent), 0 2px 4px rgba(0,0,0,0.25)',
      }}
    />
  </SliderPrimitive.Root>
))
RatioSlider.displayName = SliderPrimitive.Root.displayName
