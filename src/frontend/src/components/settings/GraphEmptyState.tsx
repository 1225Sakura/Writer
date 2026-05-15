/**
 * GraphEmptyState — Empty state views for the relation graph.
 * Extracted from GraphCanvas.tsx.
 */

import { LinkIcon, Filter } from 'lucide-react'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { GraphBackground } from './GraphNode'

export function GraphEmptyState({ variant }: { variant: 'no-data' | 'no-results' }) {
  const Icon = variant === 'no-data' ? LinkIcon : Filter
  const title = variant === 'no-data' ? '添加角色后' : '筛选条件过于严格'
  const subtitle = variant === 'no-data' ? '这里将显示关系图谱' : '没有符合条件的节点'

  return (
    <div className="h-full flex items-center justify-center text-center p-4 bg-[var(--ink-100)] relative overflow-hidden rounded-lg border border-[var(--border-subtle)]">
      <GraphBackground />
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        <motion.div
          className="relative mx-auto mb-4 w-14 h-14 rounded-xl flex items-center justify-center"
          style={{
            background: 'var(--paper-80)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'inset 0 1px 0 var(--border-subtle)',
          }}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Icon className="w-5 h-5" style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
        </motion.div>
        <p className="text-sm mb-1 font-medium" style={{ color: 'var(--paper-80)', opacity: 0.75 }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--paper-80)', opacity: 0.4 }}>
          {subtitle}
        </p>
      </motion.div>
    </div>
  )
}
