import { useUIStore, useWritingStore } from '@/store'
import { Button } from '@/components/ui/Button'
import { Slider } from '@/components/ui/slider'
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
  Maximize2,
  Minimize2,
  Eye,
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
} from 'lucide-react'
import { memo, useCallback, useState } from 'react'
import { showToast } from '@/components/ui/Toast'
import { getEditorInstance } from '@/store/editorRegistry'

export function WritingToolbar() {
  const {
    theme,
    toggleTheme,
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
    shrink,
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
    operation: 'optimize' | 'expand' | 'shrink' | 'rewrite' | 'continue' | 'polish'
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
        case 'shrink':
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
    { key: 'shrink', label: '缩写', icon: <Shrink className="w-3.5 h-3.5" />, shortcut: 'S', color: 'var(--color-character)' },
    { key: 'rewrite', label: '改写', icon: <RefreshCw className="w-3.5 h-3.5" />, shortcut: 'R', color: 'var(--color-item)' },
    { key: 'continue', label: '续写', icon: <ArrowRight className="w-3.5 h-3.5" />, shortcut: 'W', color: 'var(--color-location)' },
    { key: 'polish', label: '润色', icon: <Paintbrush className="w-3.5 h-3.5" />, shortcut: 'P', color: 'var(--color-vermillion)' },
  ] as const

  return (
    <div className="h-[44px] flex items-center px-4 gap-2"
         style={{
           backgroundColor: 'var(--color-surface-base)',
           borderBottom: '1px solid var(--border-default)',
         }}>
      {/* 左侧：返回聊天 + 返回设定 */}
      <Button
        onClick={() => setCurrentInterface('chat')}
        variant="ghost"
        size="sm"
      >
        <MessageCircle className="w-4 h-4" />
        <span>返回聊天</span>
      </Button>

      <Button
        onClick={() => setCurrentInterface('settings')}
        variant="ghost"
        size="sm"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回设定</span>
      </Button>

      <div className="w-px h-6" style={{ backgroundColor: 'var(--border-default)' }} />

      {/* 中间：工具按钮 */}
      <div className="flex items-center gap-1">
        <ToolbarButton
          icon={<Pen className="w-4 h-4" />}
          label="写作"
          isActive={currentInterface === 'writing'}
          onClick={() => setCurrentInterface('writing')}
        />
        <ToolbarButton
          icon={<List className="w-4 h-4" />}
          label="大纲"
          isActive={outlineDrawerOpen}
          onClick={toggleOutlineDrawer}
        />
        <ToolbarButton
          icon={<MessageCircle className="w-4 h-4" />}
          label="AI操作"
          isActive={aiDrawerOpen}
          onClick={toggleAIDrawer}
          badge={aiDrawerOpen ? undefined : ' '}
        />
        <ToolbarButton
          icon={<Users className="w-4 h-4" />}
          label="协作"
          isActive={collaborationDrawerOpen}
          onClick={toggleCollaborationDrawer}
        />
      </div>

      {/* 中间偏右：人机比例快捷滑块 + 快捷AI操作 */}
      <div className="flex items-center gap-2 ml-2">
        <div className="w-px h-6" style={{ backgroundColor: 'var(--border-default)' }} />

        {/* Human-AI ratio mini control */}
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)]">
          <Bot className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          <div className="w-16">
            <Slider
              value={[humanAIRatio]}
              min={0}
              max={100}
              step={10}
              onValueChange={(value) => setHumanAIRatio(value[0])}
              className="w-full"
            />
          </div>
          <User className="w-3.5 h-3.5" style={{ color: 'var(--color-ifline)' }} />
          <span className="text-[10px] text-[#d0d6e0]/70 w-8 text-center">
            {humanAIRatio < 30 ? 'AI' : humanAIRatio < 70 ? '协作' : '用户'}
          </span>
        </div>

        {/* Quick AI operations dropdown */}
        <div className="relative">
          <Button
            onClick={() => setShowQuickAIOps(!showQuickAIOps)}
            variant={showQuickAIOps ? 'primary' : 'ghost'}
            size="sm"
            className="relative"
            disabled={isAIGenerating}
          >
            {isAIGenerating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>快捷AI</span>
            {isAIGenerating && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse motion-reduce:animate-none" style={{ backgroundColor: 'var(--accent-primary)' }} />
            )}
          </Button>

          <AnimatePresence>
            {showQuickAIOps && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-1 z-50 p-1.5 rounded-xl bg-[#191a1b] border border-[rgba(255,255,255,0.08)] shadow-xl min-w-[200px]"
              >
                <div className="text-[10px] text-[#d0d6e0]/50 px-2 py-1 uppercase tracking-wider">
                  选中文字后执行
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {quickAIOperations.map((op) => (
                    <button
                      key={op.key}
                      onClick={() => {
                        handleQuickAIOp(op.key)
                        setShowQuickAIOps(false)
                      }}
                      disabled={quickOpLoading !== null}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all
                        ${quickOpLoading === op.key
                          ? 'bg-[var(--accent-primary)]/20' : ''}
                          : 'text-[#d0d6e0] hover:bg-[rgba(255,255,255,0.06)]'
                        }
                        ${quickOpLoading !== null && quickOpLoading !== op.key ? 'opacity-40' : ''}
                      `}
                    >
                      <span style={{ color: op.color }}>{op.icon}</span>
                      <span className="flex-1 text-left">{op.label}</span>
                      <span className="text-[10px] text-[#d0d6e0]/40">⇧{op.shortcut}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 右侧：字数统计、警告和主题切换 */}
      <div className="ml-auto flex items-center gap-2">
        {/* AI生成状态指示 */}
        <AnimatePresence>
          {isAIGenerating && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-primary) 20%, transparent)',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <Sparkles className="w-3 h-3" style={{ color: 'var(--accent-primary)' }} />
              </motion.div>
              <span className="text-[10px] font-medium" style={{ color: 'var(--accent-primary)' }}>AI生成中</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 今日进度 - gradient fill */}
        <div className="flex items-center gap-1.5 mr-2"
          title="今日写作进度"
        >
          <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
          <div className="w-20 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--color-ifline) 100%)',
                boxShadow: '0 0 6px rgba(94, 106, 210, 0.3)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (todayWordCount / Math.max(1, targetWordCount)) * 100)}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
            {todayWordCount}/{targetWordCount}
          </span>
        </div>

        <div className="w-px h-5" style={{ backgroundColor: 'var(--border-default)' }} />

        {/* 字数统计 */}
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {wordCount} 字
        </span>

        {/* OOC/战力警告 */}
        {hasWarnings && (
          <Button
            onClick={handleWarningClick}
            variant="destructive"
            size="sm"
            title={`OOC: ${oocWarnings.length}, 战力: ${powerImbalanceWarnings.length}`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>警告 {oocWarnings.length + powerImbalanceWarnings.length}</span>
          </Button>
        )}

        {/* 主题切换 - Linear icon button with rounded-full */}
        <Button
          onClick={toggleTheme}
          variant="ghost"
          size="icon"
          title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
          className="!rounded-full"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>

        {/* 沉浸模式切换 */}
        <Button
          onClick={toggleImmersiveMode}
          variant={immersiveMode ? 'primary' : 'ghost'}
          size="icon"
          title={immersiveMode ? '退出沉浸模式' : '进入沉浸模式'}
          className="!rounded-full"
        >
          {immersiveMode ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>

        {/* 专注模式切换 */}
        <Button
          onClick={toggleFocusMode}
          variant={focusModeEnabled ? 'primary' : 'ghost'}
          size="icon"
          title={focusModeEnabled ? '退出专注模式' : '进入专注模式'}
          className="!rounded-full"
        >
          {focusModeEnabled ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

const ToolbarButton = memo(function ToolbarButton({
  icon,
  label,
  isActive,
  onClick,
  badge,
}: {
  icon: React.ReactNode
  label: string
  isActive?: boolean
  onClick?: () => void
  badge?: string
}) {
  return (
    <Button
      onClick={onClick}
      variant={isActive ? 'primary' : 'ghost'}
      size="sm"
      className={`relative overflow-hidden transition-all duration-200 ${
        isActive
          ? ''
          : 'hover:scale-[1.03] hover:bg-gradient-to-b hover:from-[rgba(255,255,255,0.06)] hover:to-[rgba(255,255,255,0.02)]'
      }`}
    >
      {icon}
      <span>{label}</span>
      {isActive && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--ifline)] opacity-80" />
      )}
      {badge && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--vermillion)' }} />
      )}
    </Button>
  )
})
