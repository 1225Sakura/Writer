/**
 * CollectedInfoPanel - Main collected information panel
 *
 * Displays extracted entities grouped by category.
 * Sub-components are split into:
 *   - EntityItem.tsx       — Single entity card with confirm
 *   - CategorySection.tsx  — Collapsible entity category group
 *   - ChatEmptyState.tsx   — Empty list placeholder with tips
 */

import { useState, useCallback } from 'react'
import { ExtractedEntity } from '@/store'
import { CategorySection } from './CategorySection'
import { EmptyState } from './ChatEmptyState'
import { Sparkles, X, CheckCheck, FileText, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { sessionApi } from '@/api/chat'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export interface CollectedInfoPanelProps {
  entities: ExtractedEntity[]
  sessionId?: number | null
  onConfirmEntity?: (id: string) => void
  onConfirmAll?: () => void
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

export function CollectedInfoPanel({ entities, sessionId, onConfirmEntity, onConfirmAll, onClose }: CollectedInfoPanelProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryText, setSummaryText] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const handleViewSummary = useCallback(async () => {
    if (!sessionId) return
    setSummaryOpen(true)
    setSummaryLoading(true)
    setSummaryError(null)
    setSummaryText(null)
    try {
      const res = await sessionApi.getSummary(sessionId)
      setSummaryText(res.summary)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : '获取摘要失败')
    } finally {
      setSummaryLoading(false)
    }
  }, [sessionId])
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
        {/* Batch confirm button */}
        {onConfirmAll && entities.length - confirmedCount > 0 && (
          <motion.button
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'var(--accent-primary)',
              color: 'var(--color-surface-raised)',
            }}
            onClick={onConfirmAll}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            确认全部 ({entities.length - confirmedCount})
          </motion.button>
        )}
        {/* View summary button */}
        {sessionId && (
          <motion.button
            className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
            style={{
              background: 'var(--color-surface-base)',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-default)',
            }}
            onClick={handleViewSummary}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <FileText className="w-3.5 h-3.5" />
            查看摘要
          </motion.button>
        )}
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

      {/* Summary dialog */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>会话摘要</DialogTitle>
            <DialogDescription>已收集设定的文字摘要</DialogDescription>
          </DialogHeader>
          <div className="mt-2 text-sm" style={{ color: 'var(--text-primary)', lineHeight: '1.75' }}>
            {summaryLoading && (
              <div className="flex items-center justify-center gap-2 py-8 text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在获取摘要...</span>
              </div>
            )}
            {summaryError && (
              <div className="py-4 text-center" style={{ color: 'var(--color-faction)' }}>
                {summaryError}
              </div>
            )}
            {summaryText && (
              <div className="whitespace-pre-wrap">{summaryText}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
