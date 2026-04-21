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
  const { oocWarnings, powerImbalanceWarnings, wordCount, targetWordCount } = useWritingStore()

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
        {/* 字数统计 */}
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {wordCount} / {targetWordCount} 字
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
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#c45c5c] rounded-full" />
      )}
    </Button>
  )
})
