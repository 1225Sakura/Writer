/**
 * ChatCommandPalette — slash-command popup (/世界, /角色, etc).
 *
 * Extracted from InputField.tsx (Phase 0b.2 split).
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { SlashCommand } from './types'

interface CommandPaletteProps {
  commands: SlashCommand[]
  query: string
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
  visible: boolean
}

export function CommandPalette({
  commands,
  query,
  selectedIndex,
  onSelect,
  visible,
}: CommandPaletteProps) {
  const filtered = useMemo(() => {
    if (!query) return commands
    const lower = query.toLowerCase()
    return commands.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.label.toLowerCase().includes(lower) ||
        c.description.toLowerCase().includes(lower),
    )
  }, [commands, query])

  if (!visible || filtered.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="absolute bottom-full left-0 right-0 mb-2 z-50"
    >
      <div
        className="rounded-xl overflow-hidden border border-default shadow-lg"
        style={{
          maxHeight: '240px',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface-raised)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header */}
        <div
          className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider select-none"
          style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--color-surface-input)' }}
        >
          命令
        </div>
        {/* Command items */}
        {filtered.map((command, i) => {
          const CommandIcon = command.icon
          const isSelected = i === selectedIndex
          return (
            <div
              key={command.name}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm"
              style={{
                backgroundColor: isSelected
                  ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
                  : undefined,
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                onSelect(command)
              }}
            >
              <CommandIcon size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
              <span className="font-medium text-primary">{command.label}</span>
              <span className="text-xs text-tertiary flex-1 min-w-0 truncate">
                {command.description}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}