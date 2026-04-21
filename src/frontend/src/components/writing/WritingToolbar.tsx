import { useUIStore, useWritingStore } from '@/store'
import { Button } from '@/components/ui/Button'
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
} from 'lucide-react'
import { memo, useCallback } from 'react'
import { showToast } from '@/components/ui/Toast'

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
  const { oocWarnings, powerImbalanceWarnings, wordCount, targetWordCount, getTodayWordCount } = useWritingStore()
  const todayWordCount = getTodayWordCount()

  const handleWarningClick = useCallback(() => {
    const oocMsg = oocWarnings.length > 0 ? `OOC警告:\n${oocWarnings.join('\n')}` : ''
    const powerMsg = powerImbalanceWarnings.length > 0 ? `战力失衡警告:\n${powerImbalanceWarnings.join('\n')}` : ''
    showToast(`${oocMsg}${oocMsg && powerMsg ? '\n\n' : ''}${powerMsg}`, 'warning')
  }, [oocWarnings, powerImbalanceWarnings])

  const hasWarnings = oocWarnings.length > 0 || powerImbalanceWarnings.length > 0

  return (
    <div className="h-12 flex items-center px-4 gap-2"
         style={{
           backgroundColor: 'var(--color-bg-surface)',
           borderBottom: '1px solid var(--color-border)',
         }}>
      {/* 左侧：返回聊天 + 返回设定 - Linear ghost buttons */}
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

      <div className="w-px h-6" style={{ backgroundColor: 'var(--color-border)' }} />

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

      {/* 右侧：字数统计、警告和主题切换 */}
      <div className="ml-auto flex items-center gap-2">
        {/* 今日进度 - gradient fill */}
        <div className="flex items-center gap-1.5 mr-2"
          title="今日写作进度"
        >
          <BarChart3 className="w-3.5 h-3.5 text-[#5e6ad2]" />
          <div className="w-20 h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (todayWordCount / Math.max(1, targetWordCount)) * 100)}%`,
                background: 'linear-gradient(90deg, #5e6ad2 0%, #7eb84a 100%)',
                boxShadow: '0 0 6px rgba(94, 106, 210, 0.3)',
              }}
            />
          </div>
          <span className="text-[10px] text-[#d0d6e0]/70">
            {todayWordCount}/{targetWordCount}
          </span>
        </div>

        <div className="w-px h-5" style={{ backgroundColor: 'var(--color-border)' }} />

        {/* 字数统计 */}
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] rounded-full bg-gradient-to-r from-[#5e6ad2] to-[#7eb84a] opacity-80" />
      )}
      {badge && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#c45c5c] rounded-full" />
      )}
    </Button>
  )
})
