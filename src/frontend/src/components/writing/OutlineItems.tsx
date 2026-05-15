/**
 * OutlineItems - Supporting components for the outline sidebar
 *
 * Contains EmptyState, PlotThreadItem, and IFLineItem components
 * used in the outline sidebar's tab panels.
 */

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { PlotThreadIcon, EntityIcon, Icon } from '@/components/ui/Icon'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/* ============================================================
   Empty State
   ============================================================ */

export function EmptyState({
  icon: EmptyIcon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-outline) 8%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 5%, transparent) 100%)',
          border: '1px solid color-mix(in srgb, var(--color-outline) 12%, transparent)',
        }}
      >
        <EmptyIcon className="w-6 h-6 text-[var(--color-outline)] opacity-50" />
      </div>
      <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{title}</p>
      <p className="text-xs text-[var(--text-tertiary)] mb-4 max-w-[200px]">{description}</p>
      {action}
    </motion.div>
  )
}

/* ============================================================
   Plot Thread Item
   ============================================================ */

export function PlotThreadItem({
  thread,
  onReveal,
}: {
  thread: { id: number; title: string; description?: string }
  onReveal: (id: number) => void
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="
        flex items-start gap-2.5 p-3 rounded-xl
        bg-[var(--color-surface-base)] border border-[var(--border-default)]
        hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]/50
        group transition-all duration-200
      "
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: 'color-mix(in srgb, var(--color-ifline) 10%, transparent)',
        }}
      >
        <PlotThreadIcon size="sm" className="text-[var(--color-ifline)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-[var(--text-primary)] truncate">{thread.title}</div>
        {thread.description && (
          <div className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{thread.description}</div>
        )}
      </div>
      <button
        onClick={() => onReveal(thread.id)}
        className="
          opacity-0 group-hover:opacity-100
          w-7 h-7 flex items-center justify-center rounded-lg
          hover:bg-[var(--color-ifline)]/10
          transition-all duration-150
        "
        aria-label={`标记 ${thread.title} 为已揭示`}
        title="标记为已揭示"
      >
        <Icon icon={Check} size="sm" color="success" />
      </button>
    </motion.div>
  )
}

/* ============================================================
   IF Line Item
   ============================================================ */

export function IFLineItem({
  line,
}: {
  line: { id: number; title: string; description?: string; progress?: number; sync_mode: string }
}) {
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="
        p-3 rounded-xl
        bg-[var(--color-surface-base)] border border-[var(--border-default)]
        hover:border-[var(--border-strong)] hover:bg-[var(--color-surface-hover)]/50
        transition-all duration-200
      "
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'color-mix(in srgb, var(--color-ifline) 10%, transparent)',
          }}
        >
          <EntityIcon type="ifline" size="xs" className="text-[var(--color-ifline)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{line.title}</div>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: line.sync_mode === 'auto' ? 'color-mix(in srgb, var(--color-ifline) 12%, transparent)' : 'color-mix(in srgb, var(--color-character) 12%, transparent)',
            color: line.sync_mode === 'auto' ? 'var(--color-ifline)' : 'var(--color-character)',
          }}
        >
          {line.sync_mode === 'auto' ? '自动' : '手动'}
        </span>
      </div>
      {line.description && (
        <div className="text-xs text-[var(--text-tertiary)] truncate mb-2 pl-9">{line.description}</div>
      )}
      {/* Progress */}
      <div className="pl-9 space-y-1">
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
          <span>进度</span>
          <span className="font-medium tabular-nums">{line.progress || 0}%</span>
        </div>
        <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--color-ifline)' }}
            initial={{ width: 0 }}
            animate={{ width: `${line.progress || 0}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </motion.div>
  )
}
