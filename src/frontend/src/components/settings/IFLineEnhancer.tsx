/**
 * IFLineEnhancer — Enhanced IF line editor with chapter range linking
 * and sync mode visualization.
 * US-016: IF line chapter range association
 */

import { useState, useMemo, useCallback } from 'react'
import { GitFork, Play, Pause, Hand, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EntitySchema } from '@/shared/entitySchema'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { Icon } from '@/components/ui/Icon'
// EntityCard styles used by SchemaDrivenEditor internally
import { SchemaDrivenEditor } from './SchemaDrivenEditor'
import { useSettingsStore } from '@/store/settingsStore'
import type { IFLineSyncMode } from '@/shared/types'

// ============================================
// Sync Mode Config
// ============================================

const SYNC_MODE_CONFIG: Record<IFLineSyncMode, {
  label: string
  icon: typeof Play
  color: string
  description: string
}> = {
  auto: {
    label: '自动同步',
    icon: Play,
    color: 'var(--color-ifline)',
    description: 'IF线随主线自动推进',
  },
  manual: {
    label: '手动同步',
    icon: Hand,
    color: 'var(--accent-primary)',
    description: '手动控制IF线推进',
  },
  paused: {
    label: '已暂停',
    icon: Pause,
    color: 'var(--text-tertiary)',
    description: 'IF线暂停同步',
  },
}

// ============================================
// SyncModeIndicator — visual sync mode badge
// ============================================

function SyncModeIndicator({
  mode,
  onToggle,
}: {
  mode: IFLineSyncMode
  onToggle: () => void
}) {
  const config = SYNC_MODE_CONFIG[mode] || SYNC_MODE_CONFIG.manual
  const ModeIcon = config.icon

  return (
    <motion.button
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
      style={{
        backgroundColor: `color-mix(in srgb, ${config.color} 12%, transparent)`,
        color: config.color,
        border: `1px solid color-mix(in srgb, ${config.color} 20%, transparent)`,
      }}
      whileHover={{
        backgroundColor: `color-mix(in srgb, ${config.color} 18%, transparent)`,
        borderColor: `color-mix(in srgb, ${config.color} 30%, transparent)`,
        y: -1,
      }}
      whileTap={{ scale: 0.97 }}
      title={config.description}
    >
      <motion.div
        animate={mode === 'auto' ? { rotate: [0, 360] } : {}}
        transition={mode === 'auto' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
      >
        <Icon icon={ModeIcon} size="xs" color="inherit" />
      </motion.div>
      <span>{config.label}</span>
    </motion.button>
  )
}

// ============================================
// ChapterRangeSelector — select chapter range for IF line
// ============================================

function ChapterRangeSelector({
  ifLineId: _ifLineId,
  linkedChapterIds,
  onLinkChapter,
  onUnlinkChapter,
}: {
  ifLineId: number
  linkedChapterIds: Set<number>
  onLinkChapter: (chapterId: number) => void
  onUnlinkChapter: (chapterId: number) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const chapters = useSettingsStore((s) => s.chapters)

  if (chapters.length === 0) return null

  return (
    <div className="space-y-2">
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-medium transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        whileHover={{ color: 'var(--text-primary)' }}
      >
        <Icon icon={GitFork} size="xs" color="inherit" />
        <span>关联章节范围</span>
        {linkedChapterIds.size > 0 && (
          <span
            className="text-[10px] px-1.5 py-0 rounded-full"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-ifline) 15%, transparent)',
              color: 'var(--color-ifline)',
            }}
          >
            {linkedChapterIds.size}
          </span>
        )}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: DURATION.FAST }}
        >
          <ChevronDown className="w-3 h-3" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="rounded-lg overflow-hidden"
            style={{
              backgroundColor: 'var(--color-surface-raised)',
              border: '1px solid var(--border-default)',
            }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
          >
            <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
              {chapters.map((ch) => {
                const isLinked = linkedChapterIds.has(ch.id)
                return (
                  <motion.button
                    key={ch.id}
                    onClick={() => isLinked ? onUnlinkChapter(ch.id) : onLinkChapter(ch.id)}
                    className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left transition-colors"
                    style={{
                      backgroundColor: isLinked
                        ? 'color-mix(in srgb, var(--color-ifline) 10%, transparent)'
                        : 'transparent',
                    }}
                    whileHover={{
                      backgroundColor: `color-mix(in srgb, var(--color-ifline) ${isLinked ? '15%' : '8%'}, transparent)`,
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <motion.div
                      className="w-3 h-3 rounded-sm flex-shrink-0 flex items-center justify-center"
                      style={{
                        backgroundColor: isLinked ? 'var(--color-ifline)' : 'transparent',
                        border: isLinked
                          ? '1px solid var(--color-ifline)'
                          : '1px solid var(--border-default)',
                      }}
                      animate={{ scale: isLinked ? 1 : 0.9 }}
                    >
                      {isLinked && (
                        <motion.svg
                          viewBox="0 0 12 12"
                          className="w-2 h-2"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <motion.path
                            d="M2 6l3 3 5-5"
                            fill="none"
                            stroke="var(--paper-100)"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </motion.svg>
                      )}
                    </motion.div>
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--color-outline)', opacity: 0.7, minWidth: '20px' }}
                    >
                      {String(chapters.indexOf(ch) + 1).padStart(2, '0')}
                    </span>
                    <span
                      className="flex-1 text-xs truncate"
                      style={{ color: isLinked ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                    >
                      {ch.title || '未命名章节'}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// IFLineEnhancer — props and main component
// ============================================

interface IFLineEnhancerProps {
  entities: Array<Record<string, any>>
  accentColor: string
  schema: EntitySchema
  onAdd: (data: Record<string, any>) => void
  onUpdate: (id: number, data: Record<string, any>) => void
  onDelete: (id: number) => void
  onBatchDelete?: (ids: number[]) => void
  onBatchTagUpdate?: (ids: number[], tags: string[]) => void
}

export function IFLineEnhancer({
  entities,
  accentColor,
  schema,
  onAdd,
  onUpdate,
  onDelete,
  onBatchDelete,
  onBatchTagUpdate,
}: IFLineEnhancerProps) {
  const { relations } = useSettingsStore()

  // Build map: ifline_id -> Set<chapter_id> from relations
  const ifLineChapterMap = useMemo(() => {
    const map = new Map<number, Set<number>>()
    for (const r of relations) {
      if (r.relation_type === 'ifline_chapter' || r.relation_type === 'appears_in') {
        // ifline -> chapter
        if (r.source_type === 'ifline' && r.target_type === 'chapter') {
          const set = map.get(r.source_id) || new Set()
          set.add(r.target_id)
          map.set(r.source_id, set)
        }
        // chapter -> ifline (reverse)
        if (r.target_type === 'ifline' && r.source_type === 'chapter') {
          const set = map.get(r.target_id) || new Set()
          set.add(r.source_id)
          map.set(r.target_id, set)
        }
      }
    }
    return map
  }, [relations])

  const handleLinkChapter = useCallback(
    (ifLineId: number, chapterId: number) => {
      useSettingsStore.getState().addRelation({
        source_type: 'ifline',
        source_id: ifLineId,
        target_type: 'chapter',
        target_id: chapterId,
        relation_type: 'ifline_chapter',
      })
    },
    [],
  )

  const handleUnlinkChapter = useCallback(
    (ifLineId: number, chapterId: number) => {
      const rel = relations.find(
        (r) =>
          r.relation_type === 'ifline_chapter' &&
          ((r.source_type === 'ifline' && r.source_id === ifLineId && r.target_type === 'chapter' && r.target_id === chapterId) ||
            (r.target_type === 'ifline' && r.target_id === ifLineId && r.source_type === 'chapter' && r.source_id === chapterId)),
      )
      if (rel) {
        useSettingsStore.getState().deleteRelation(rel.id)
      }
    },
    [relations],
  )

  const handleSyncModeToggle = useCallback(
    (ifLineId: number, currentMode: IFLineSyncMode) => {
      const modeOrder: IFLineSyncMode[] = ['auto', 'manual', 'paused']
      const idx = modeOrder.indexOf(currentMode)
      const nextMode = modeOrder[(idx + 1) % modeOrder.length]
      onUpdate(ifLineId, { sync_mode: nextMode })
    },
    [onUpdate],
  )

  return (
    <div>
      {/* Render standard schema-driven editor */}
      <SchemaDrivenEditor
        schema={schema}
        entities={entities}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onBatchDelete={onBatchDelete}
        onBatchTagUpdate={onBatchTagUpdate}
        accentColor={accentColor}
      />

      {/* Enhanced IF line features: sync mode + chapter range per entity */}
      {entities.length > 0 && (
        <motion.div
          className="mt-4 space-y-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
        >
          <div
            className="flex items-center gap-2 px-1 pb-2"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <Icon icon={GitFork} size="sm" color="accent" />
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              IF线同步与章节关联
            </span>
          </div>

          {entities.map((entity) => {
            const mode: IFLineSyncMode = entity.sync_mode || 'manual'
            const linkedChapters = ifLineChapterMap.get(entity.id) || new Set<number>()
            const entityTitle = entity.title || entity.name || `#${entity.id}`

            return (
              <motion.div
                key={entity.id}
                className="p-3 rounded-lg space-y-2"
                style={{
                  backgroundColor: 'var(--color-surface-raised)',
                  border: '1px solid var(--border-default)',
                }}
                whileHover={{
                  borderColor: 'color-mix(in srgb, var(--color-ifline) 25%, transparent)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {entityTitle}
                  </span>
                  <SyncModeIndicator
                    mode={mode}
                    onToggle={() => handleSyncModeToggle(entity.id, mode)}
                  />
                </div>
                <ChapterRangeSelector
                  ifLineId={entity.id}
                  linkedChapterIds={linkedChapters}
                  onLinkChapter={(chapterId) => handleLinkChapter(entity.id, chapterId)}
                  onUnlinkChapter={(chapterId) => handleUnlinkChapter(entity.id, chapterId)}
                />
              </motion.div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
