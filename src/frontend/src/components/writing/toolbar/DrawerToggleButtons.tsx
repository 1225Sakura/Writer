import { useUIStore } from '@/store'
import { memo } from 'react'
import { motion } from 'framer-motion'
import {
  List,
  MessageCircle,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'

export function ToolbarButtons() {
  const {
    outlineDrawerOpen,
    toggleOutlineDrawer,
    aiDrawerOpen,
    toggleAIDrawer,
    collaborationDrawerOpen,
    toggleCollaborationDrawer,
    checkerDrawerOpen,
    toggleCheckerDrawer,
  } = useUIStore()

  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      <ToolbarButton
        icon={<Icon icon={List} size="sm" />}
        label="大纲"
        shortcut="Ctrl+2"
        isActive={outlineDrawerOpen}
        onClick={toggleOutlineDrawer}
      />
      <ToolbarButton
        icon={<Icon icon={MessageCircle} size="sm" />}
        label="AI操作"
        shortcut="Ctrl+3"
        isActive={aiDrawerOpen}
        onClick={toggleAIDrawer}
        badge={aiDrawerOpen ? undefined : ' '}
      />
      <ToolbarButton
        icon={<Icon icon={Users} size="sm" />}
        label="协作"
        shortcut="Ctrl+4"
        isActive={collaborationDrawerOpen}
        onClick={toggleCollaborationDrawer}
      />
      <ToolbarButton
        icon={<Icon icon={ShieldCheck} size="sm" />}
        label="检查"
        shortcut="Ctrl+5"
        isActive={checkerDrawerOpen}
        onClick={toggleCheckerDrawer}
      />
    </div>
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
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 overflow-hidden flex-shrink-0 group touch-target-min toolbar-btn-glow ${
        isActive
          ? 'text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-raised)] hover:border-[var(--border-default)] hover:shadow-[0_0_12px_color-mix(in_srgb,var(--accent-primary)_12%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--paper-100)_5%,transparent)]'
      }`}
      style={isActive ? {
        background: 'var(--accent-primary)',
        border: '1px solid color-mix(in srgb, var(--accent-primary) 60%, transparent)',
        boxShadow: '0 0 16px color-mix(in srgb, var(--accent-primary) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 8%, transparent)',
      } : {
        border: '1px solid transparent',
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
            background: isActive ? 'color-mix(in srgb, var(--paper-100) 15%, transparent)' : 'var(--color-surface-hover)',
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
