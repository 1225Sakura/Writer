/**
 * VersionDiffView - Side-by-side diff display for version snapshots
 *
 * Shows entity changes between two snapshots:
 * - Added entities (green)
 * - Removed entities (red)
 * - Modified entities (yellow)
 */

import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { Plus, Minus, Pencil, ArrowLeftRight } from 'lucide-react'
import type { EntityDiffItem } from '@/services/versionService'

interface VersionDiffViewProps {
  diff: EntityDiffItem[]
  oldTimestamp?: number
  newTimestamp?: number
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

export function VersionDiffView({ diff, oldTimestamp, newTimestamp }: VersionDiffViewProps) {
  if (diff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-secondary">
        <ArrowLeftRight className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">两个版本之间无变更</p>
      </div>
    )
  }

  const added = diff.filter((d) => d.type === 'added')
  const removed = diff.filter((d) => d.type === 'removed')
  const modified = diff.filter((d) => d.type === 'modified')

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      {(oldTimestamp || newTimestamp) && (
        <div className="flex items-center gap-2 text-xs text-secondary px-1">
          {oldTimestamp && (
            <span>旧版本: {formatTime(oldTimestamp)}</span>
          )}
          {oldTimestamp && newTimestamp && <span>→</span>}
          {newTimestamp && (
            <span>新版本: {formatTime(newTimestamp)}</span>
          )}
        </div>
      )}

      {/* Summary badges */}
      <div className="flex gap-2 px-1">
        {added.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--color-diff-added-bg, rgba(34,197,94,0.15))', color: 'var(--color-diff-added)' }}>
            <Plus className="w-3 h-3" /> +{added.length} 新增
          </span>
        )}
        {removed.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--color-diff-removed-bg, rgba(239,68,68,0.15))', color: 'var(--color-diff-removed)' }}>
            <Minus className="w-3 h-3" /> -{removed.length} 删除
          </span>
        )}
        {modified.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--color-diff-modified-bg, rgba(234,179,8,0.15))', color: 'var(--color-diff-modified)' }}>
            <Pencil className="w-3 h-3" /> ~{modified.length} 修改
          </span>
        )}
      </div>

      {/* Diff items */}
      <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {diff.map((item) => (
            <DiffItemRow key={item.id} item={item} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

function DiffItemRow({ item }: { item: EntityDiffItem }) {
  const colorMap = {
    added: {
      bg: 'var(--color-diff-added-bg, rgba(34,197,94,0.08))',
      border: 'var(--color-diff-added)',
      icon: Plus,
      label: '新增',
    },
    removed: {
      bg: 'var(--color-diff-removed-bg, rgba(239,68,68,0.08))',
      border: 'var(--color-diff-removed)',
      icon: Minus,
      label: '删除',
    },
    modified: {
      bg: 'var(--color-diff-modified-bg, rgba(234,179,8,0.08))',
      border: 'var(--color-diff-modified)',
      icon: Pencil,
      label: '修改',
    },
  }

  const config = colorMap[item.type]
  const Icon = config.icon
  const categoryLabel = categoryLabels[item.entityType] ?? item.entityType

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="flex items-start gap-2.5 px-3 py-2 rounded-lg text-xs"
      style={{
        background: config.bg,
        borderLeft: `3px solid ${config.border}`,
      }}
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: config.border }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-primary truncate">{item.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--color-surface-base)', color: 'var(--ink-300)' }}>
            {categoryLabel}
          </span>
          <span className="text-[10px] opacity-60">{config.label}</span>
        </div>
        {item.type === 'modified' && item.oldEntity && item.newEntity && (
          <ModifiedDetails oldEntity={item.oldEntity} newEntity={item.newEntity} />
        )}
        {item.type === 'removed' && item.oldEntity?.description && (
          <p className="mt-0.5 text-secondary truncate">{item.oldEntity.description}</p>
        )}
        {item.type === 'added' && item.newEntity?.description && (
          <p className="mt-0.5 text-secondary truncate">{item.newEntity.description}</p>
        )}
      </div>
    </motion.div>
  )
}

function ModifiedDetails({
  oldEntity,
  newEntity,
}: {
  oldEntity: NonNullable<EntityDiffItem['oldEntity']>
  newEntity: NonNullable<EntityDiffItem['newEntity']>
}) {
  const changes: { field: string; old: string; new: string }[] = []

  if (oldEntity.name !== newEntity.name) {
    changes.push({ field: '名称', old: oldEntity.name, new: newEntity.name })
  }
  if (oldEntity.description !== newEntity.description) {
    changes.push({
      field: '描述',
      old: oldEntity.description ?? '(空)',
      new: newEntity.description ?? '(空)',
    })
  }
  if (oldEntity.confirmed !== newEntity.confirmed) {
    changes.push({
      field: '确认',
      old: oldEntity.confirmed ? '已确认' : '待确认',
      new: newEntity.confirmed ? '已确认' : '待确认',
    })
  }

  return (
    <div className="mt-1 space-y-0.5">
      {changes.map((c) => (
        <div key={c.field} className="flex items-center gap-1 text-[11px]">
          <span className="text-secondary">{c.field}:</span>
          <span className="line-through opacity-60">{c.old}</span>
          <span>→</span>
          <span className="font-medium">{c.new}</span>
        </div>
      ))}
    </div>
  )
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
