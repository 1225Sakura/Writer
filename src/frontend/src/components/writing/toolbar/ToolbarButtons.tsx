import { useUIStore } from '@/store'
import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  Pen,
  List,
  MessageCircle,
  Users,
  ArrowLeft,
} from 'lucide-react'

export function ToolbarButtons() {
  const {
    currentInterface,
    setCurrentInterface,
    outlineDrawerOpen,
    toggleOutlineDrawer,
    aiDrawerOpen,
    toggleAIDrawer,
    collaborationDrawerOpen,
    toggleCollaborationDrawer,
  } = useUIStore()

  return (
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
  )
}

export function NavButtons() {
  const { setCurrentInterface } = useUIStore()

  return (
    <>
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
    </>
  )
}

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
