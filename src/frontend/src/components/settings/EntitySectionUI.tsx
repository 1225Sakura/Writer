/**
 * EntitySectionUI — Section header and empty state components.
 * Extracted from EntityFieldGroup.tsx.
 */

import { Plus, Sparkles, type LucideIcon } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { motion } from 'framer-motion'
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'

// ============================================
// SectionHeader
// ============================================

export function SectionHeader({
  title,
  count,
  onAdd,
  onGenerate,
}: {
  title: string
  count: number
  onAdd: () => void
  onGenerate?: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>
        <motion.span
          key={count}
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--color-surface-overlay)', color: 'var(--text-tertiary)' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING.BADGE}
        >
          {count}
        </motion.span>
      </div>
      <div className="flex items-center gap-2">
        {onGenerate && (
          <motion.button
            onClick={onGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              backgroundColor: 'var(--accent-muted)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)30',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)25'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-muted)'
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Icon icon={Sparkles} size="xs" color="accent" />
            AI生成
          </motion.button>
        )}
        <motion.button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: 'var(--color-surface-raised)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-overlay)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-raised)'
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Icon icon={Plus} size="xs" color="secondary" />
          新增
        </motion.button>
      </div>
    </div>
  )
}

// ============================================
// EmptyState
// ============================================

export function EmptyState({
  icon: IconComponent,
  title,
  subtitle,
  color = 'var(--text-tertiary)',
}: {
  icon: LucideIcon
  title: string
  subtitle?: string
  color?: string
}) {
  return (
    <motion.div
      className="text-center py-10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      <motion.div
        className="relative w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${color}12, ${color}06)`,
          border: `1px solid ${color}15`,
        }}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <Icon icon={IconComponent} size="lg" color="inherit" style={{ color, opacity: 0.6 }} />
      </motion.div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
