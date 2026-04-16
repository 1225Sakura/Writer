import { useUIStore, useWritingStore } from '@/store'
import {
  Pen,
  List,
  MessageCircle,
  Users,
  ArrowLeft,
  AlertTriangle,
  Moon,
  Sun,
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
  } = useUIStore()
  const { oocWarnings, powerImbalanceWarnings } = useWritingStore()

  const handleWarningClick = useCallback(() => {
    const oocMsg = oocWarnings.length > 0 ? `OOC警告:\n${oocWarnings.join('\n')}` : ''
    const powerMsg = powerImbalanceWarnings.length > 0 ? `战力失衡警告:\n${powerImbalanceWarnings.join('\n')}` : ''
    showToast(`${oocMsg}${oocMsg && powerMsg ? '\n\n' : ''}${powerMsg}`, 'warning')
  }, [oocWarnings, powerImbalanceWarnings])

  const hasWarnings = oocWarnings.length > 0 || powerImbalanceWarnings.length > 0

  return (
    <div className="h-12 border-b border-[rgba(255,255,255,0.08)] bg-[#0f1011] flex items-center px-4 gap-2">
      {/* 左侧：返回聊天 + 返回设定 */}
      <button
        onClick={() => setCurrentInterface('chat')}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md
                   hover:bg-[rgba(255,255,255,0.08)] transition-colors text-sm text-[#f7f8f8]"
      >
        <MessageCircle className="w-4 h-4" />
        <span>返回聊天</span>
      </button>

      <button
        onClick={() => setCurrentInterface('settings')}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md
                   hover:bg-[rgba(255,255,255,0.08)] transition-colors text-sm text-[#f7f8f8]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>返回设定</span>
      </button>

      <div className="w-px h-6 bg-[rgba(255,255,255,0.08)]" />

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

      {/* 右侧：警告和主题切换 */}
      <div className="ml-auto flex items-center gap-2">
        {/* OOC/战力警告 */}
        {hasWarnings && (
          <button
            onClick={handleWarningClick}
            className="flex items-center gap-1 px-2 py-1 rounded-md
                       bg-[#c45c5c] text-white text-xs animate-pulse cursor-pointer"
            title={`OOC: ${oocWarnings.length}, 战力: ${powerImbalanceWarnings.length}`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>警告 {oocWarnings.length + powerImbalanceWarnings.length}</span>
          </button>
        )}

        {/* 主题切换 */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-[rgba(255,255,255,0.08)] transition-colors text-[#d0d6e0]"
          title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
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
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-sm text-[#f7f8f8] ${
        isActive
          ? 'bg-[#5e6ad2] text-white'
          : 'hover:bg-[rgba(255,255,255,0.08)]'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#c45c5c] rounded-full" />
      )}
    </button>
  )
})
