/**
 * CollectedInfoPanel - Main collected information panel
 *
 * Displays extracted entities grouped by category.
 * Sub-components are split into:
 *   - EntityItem.tsx       — Single entity card with confirm
 *   - CategorySection.tsx  — Collapsible entity category group
 *   - ChatEmptyState.tsx   — Empty list placeholder with tips
 */

import { ExtractedEntity } from '@/store'
import { CategorySection } from './CategorySection'
import { EmptyState } from './ChatEmptyState'
import { Sparkles, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

export interface CollectedInfoPanelProps {
  entities: ExtractedEntity[]
  onConfirmEntity?: (id: string) => void
  onClose?: () => void
}

const categoryLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
  ifline: 'IF线',
}

export function CollectedInfoPanel({ entities, onConfirmEntity, onClose }: CollectedInfoPanelProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const groupedEntities = entities.reduce(
    (acc, entity) => {
      const key = entity.type
      if (!acc[key]) acc[key] = []
      acc[key].push(entity)
      return acc
    },
    {} as Record<string, ExtractedEntity[]>
  )

  const confirmedCount = entities.filter((e) => e.confirmed).length
  const progressPercent = entities.length > 0 ? (confirmedCount / entities.length) * 100 : 0

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--color-surface-raised)' }}>
      {/* Header */}
      <div className="p-4 border-b border-default">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-accent-primary" />
          <h2 className="font-medium text-sm text-primary">已收集信息</h2>
          {onClose && (
            <motion.button
              className="ml-auto p-1 rounded-lg text-secondary hover:text-primary hover:bg-surface-base"
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </div>
        <div className="text-xs text-secondary">
          {confirmedCount}/{entities.length} 项已确认
        </div>
        {/* Progress bar */}
        <div className="mt-2.5 h-2 rounded-full overflow-hidden bg-surface-base relative">
          <motion.div
            className="h-full rounded-full relative"
            style={{
              background: progressPercent === 100
                ? 'linear-gradient(90deg, var(--color-ifline), color-mix(in srgb, var(--color-ifline) 70%, var(--accent-primary)))'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {!prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 2, ease: 'easeInOut' }}
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <AnimatePresence mode="wait">
          {entities.length === 0 ? (
            <EmptyState />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            >
              {Object.entries(groupedEntities).map(([type, typeEntities]) => (
                <CategorySection
                  key={type}
                  title={categoryLabels[type] || type}
                  entities={typeEntities}
                  onConfirm={onConfirmEntity}
                  type={type}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
