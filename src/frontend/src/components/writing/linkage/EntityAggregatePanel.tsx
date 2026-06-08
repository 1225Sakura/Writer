/**
 * EntityAggregatePanel - Cross-panel entity relationship aggregation view
 *
 * Displays all related information for a selected entity across panels:
 * - Related chapters
 * - Related characters
 * - Related plot threads (foreshadowing)
 *
 * Floating panel positioned on the right side of the editor.
 * Uses GlassCard styling with framer-motion animations.
 */

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  X,
  Link2,
  MapPin,
  Shield,
  ScrollText,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { Button } from '@/components/ui/Button'
import { useContentStore, useSettingsStore } from '@/store'
import type { EntityType } from '@/shared/types'
import { DURATION, EASE, SLIDE_IN_RIGHT } from '@/components/shared/AnimationConfig'

// ============================================
// Types
// ============================================

export interface SelectedEntity {
  id: number
  name: string
  type: EntityType
}

interface RelatedChapter {
  id: number
  title: string
  summary?: string
  chapterOrder?: number
}

interface RelatedCharacter {
  id: number
  name: string
  tier?: string
}

interface RelatedPlotThread {
  id: number
  title: string
  status: string
  description?: string
}

interface EntityAggregatePanelProps {
  entity: SelectedEntity | null
  onClose: () => void
  onJumpToEntity?: (entityType: EntityType, entityId: number) => void
}

// ============================================
// Helpers
// ============================================

const ENTITY_TYPE_CONFIG: Record<EntityType, { label: string; color: string; icon: React.ReactNode }> = {
  character: { label: '角色', color: 'var(--color-character)', icon: <Users className="w-3.5 h-3.5" /> },
  item: { label: '物品', color: 'var(--color-item)', icon: <ScrollText className="w-3.5 h-3.5" /> },
  location: { label: '地点', color: 'var(--color-location)', icon: <MapPin className="w-3.5 h-3.5" /> },
  faction: { label: '势力', color: 'var(--color-faction)', icon: <Shield className="w-3.5 h-3.5" /> },
  world: { label: '世界观', color: 'var(--color-world)', icon: <BookOpen className="w-3.5 h-3.5" /> },
  rule: { label: '规则', color: 'var(--color-rule)', icon: <ScrollText className="w-3.5 h-3.5" /> },
  outline: { label: '大纲', color: 'var(--color-outline)', icon: <BookOpen className="w-3.5 h-3.5" /> },
  chapter: { label: '章节', color: 'var(--color-outline)', icon: <BookOpen className="w-3.5 h-3.5" /> },
  plot_thread: { label: '伏笔', color: 'var(--color-ifline)', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  ifline: { label: 'IF线', color: 'var(--color-ifline)', icon: <Link2 className="w-3.5 h-3.5" /> },
}

function getEntityConfig(type: EntityType) {
  return ENTITY_TYPE_CONFIG[type] ?? { label: type, color: 'var(--text-tertiary)', icon: <Link2 className="w-3.5 h-3.5" /> }
}

// ============================================
// Sub-components
// ============================================

interface SectionProps {
  title: string
  icon: React.ReactNode
  count: number
  accentColor: string
  children: React.ReactNode
  defaultExpanded?: boolean
}

function AggregateSection({ title, icon, count, accentColor, children, defaultExpanded = true }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="rounded-lg overflow-hidden border transition-all duration-200" style={{ borderColor: 'var(--border-default)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 active:scale-[0.99] transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
      >
        <span className="transition-transform duration-200 group-hover:scale-110" style={{ color: accentColor }}>
          {icon}
        </span>
        <span className="flex-1 text-left text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        {count > 0 && (
          <span
            className="px-1.5 py-0.5 text-[10px] rounded-full font-medium"
            style={{
              background: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
              color: accentColor,
            }}
          >
            {count}
          </span>
        )}
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 space-y-1.5">
              {count === 0 ? (
                <div className="text-xs py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  暂无关联
                </div>
              ) : (
                children
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface RelationItemProps {
  label: string
  sublabel?: string
  accentColor: string
  onClick?: () => void
}

function RelationItem({ label, sublabel, accentColor, onClick }: RelationItemProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all duration-200 hover:bg-[var(--color-surface-hover)] group cursor-pointer"
      disabled={!onClick}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-200 group-hover:scale-150"
        style={{ backgroundColor: accentColor }}
      />
      <div className="flex-1 min-w-0">
        <div
          className="text-xs truncate transition-colors group-hover:text-[var(--text-primary)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </div>
        {sublabel && (
          <div className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
            {sublabel}
          </div>
        )}
      </div>
      {onClick && (
        <ChevronRight
          className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          style={{ color: accentColor }}
        />
      )}
    </motion.button>
  )
}

// ============================================
// Main Component
// ============================================

export function EntityAggregatePanel({ entity, onClose, onJumpToEntity }: EntityAggregatePanelProps) {
  const { chapters } = useContentStore()
  const { characters, relations } = useSettingsStore()

  // Find related entities via relations table
  const relatedChapters = useMemo<RelatedChapter[]>(() => {
    if (!entity) return []
    // Direct chapter relations
    const directChapters = relations
      .filter(
        (r) =>
          (r.source_type === entity.type && r.source_id === entity.id && r.target_type === 'chapter') ||
          (r.target_type === entity.type && r.target_id === entity.id && r.source_type === 'chapter')
      )
      .map((r) => {
        const chapterId = r.source_type === 'chapter' ? r.source_id : r.target_id
        return chapters.find((c) => c.id === chapterId)
      })
      .filter(Boolean)
      .map((c) => ({
        id: c!.id,
        title: c!.title ?? `章节 ${c!.chapter_order ?? c!.id}`,
        summary: c!.summary,
        chapterOrder: c!.chapter_order,
      }))

    // If entity IS a chapter, include it
    if (entity.type === 'chapter') {
      const self = chapters.find((c) => c.id === entity.id)
      if (self) {
        directChapters.unshift({
          id: self.id,
          title: self.title ?? `章节 ${self.chapter_order ?? self.id}`,
          summary: self.summary,
          chapterOrder: self.chapter_order,
        })
      }
    }

    // Deduplicate
    const seen = new Set<number>()
    return directChapters.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [entity, relations, chapters])

  const relatedCharacters = useMemo<RelatedCharacter[]>(() => {
    if (!entity) return []
    const charRelations = relations
      .filter(
        (r) =>
          (r.source_type === entity.type && r.source_id === entity.id && r.target_type === 'character') ||
          (r.target_type === entity.type && r.target_id === entity.id && r.source_type === 'character')
      )
      .map((r) => {
        const charId = r.source_type === 'character' ? r.source_id : r.target_id
        return characters.find((c) => c.id === charId)
      })
      .filter(Boolean)
      .map((c) => ({
        id: c!.id,
        name: c!.name,
        tier: c!.tier,
      }))

    if (entity.type === 'character') {
      const self = characters.find((c) => c.id === entity.id)
      if (self) {
        charRelations.unshift({ id: self.id, name: self.name, tier: self.tier })
      }
    }

    const seen = new Set<number>()
    return charRelations.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }, [entity, relations, characters])

  const relatedPlotThreads = useMemo<RelatedPlotThread[]>(() => {
    if (!entity) return []
    // Plot threads reference entities via created_chapter_id or reveal_chapter_id
    // Also check relations for plot_thread type
    const { plotThreads } = useContentStore.getState()
    const threadRelations = relations
      .filter(
        (r) =>
          (r.source_type === entity.type && r.source_id === entity.id && r.target_type === 'plot_thread') ||
          (r.target_type === entity.type && r.target_id === entity.id && r.source_type === 'plot_thread')
      )
      .map((r) => {
        const threadId = r.source_type === 'plot_thread' ? r.source_id : r.target_id
        return plotThreads.find((t) => t.id === threadId)
      })
      .filter(Boolean)
      .map((t) => ({
        id: t!.id,
        title: t!.title,
        status: t!.status,
        description: t!.description,
      }))

    // If entity is a chapter, also include plot threads created/revealed in this chapter
    if (entity.type === 'chapter') {
      const chapterThreads = plotThreads
        .filter((t) => t.created_chapter_id === entity.id || t.reveal_chapter_id === entity.id)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          description: t.description,
        }))
      threadRelations.push(...chapterThreads)
    }

    if (entity.type === 'plot_thread') {
      const self = plotThreads.find((t) => t.id === entity.id)
      if (self) {
        threadRelations.unshift({ id: self.id, title: self.title, status: self.status, description: self.description })
      }
    }

    const seen = new Set<number>()
    return threadRelations.filter((t) => {
      if (seen.has(t.id)) return false
      seen.add(t.id)
      return true
    })
  }, [entity, relations])

  const handleJump = useCallback(
    (targetType: EntityType, targetId: number) => {
      onJumpToEntity?.(targetType, targetId)
    },
    [onJumpToEntity]
  )

  if (!entity) return null

  const config = getEntityConfig(entity.type)

  return (
    <AnimatePresence>
      <motion.div
        variants={SLIDE_IN_RIGHT}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-72 max-h-[calc(100vh-120px)] overflow-hidden flex flex-col"
      >
        <GlassCard
          variant="elevated"
          intensity="medium"
          rounded="xl"
          className="flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 border-b"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{
                backgroundColor: `color-mix(in srgb, ${config.color} 18%, transparent)`,
                color: config.color,
              }}
            >
              {config.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {entity.name}
              </div>
              <div className="text-[10px]" style={{ color: config.color }}>
                {config.label}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="!h-6 !w-6"
              title="关闭聚合面板"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto scrollbar-ink p-2.5 space-y-2">
            <AggregateSection
              title="关联章节"
              icon={<BookOpen className="w-3.5 h-3.5" />}
              count={relatedChapters.length}
              accentColor="var(--color-outline)"
            >
              {relatedChapters.map((ch) => (
                <RelationItem
                  key={`ch-${ch.id}`}
                  label={ch.title}
                  sublabel={ch.summary ? ch.summary.slice(0, 50) : undefined}
                  accentColor="var(--color-outline)"
                  onClick={() => handleJump('chapter', ch.id)}
                />
              ))}
            </AggregateSection>

            <AggregateSection
              title="关联角色"
              icon={<Users className="w-3.5 h-3.5" />}
              count={relatedCharacters.length}
              accentColor="var(--color-character)"
            >
              {relatedCharacters.map((char) => (
                <RelationItem
                  key={`char-${char.id}`}
                  label={char.name}
                  sublabel={char.tier}
                  accentColor="var(--color-character)"
                  onClick={() => handleJump('character', char.id)}
                />
              ))}
            </AggregateSection>

            <AggregateSection
              title="关联伏笔"
              icon={<AlertCircle className="w-3.5 h-3.5" />}
              count={relatedPlotThreads.length}
              accentColor="var(--color-ifline)"
            >
              {relatedPlotThreads.map((thread) => (
                <RelationItem
                  key={`thread-${thread.id}`}
                  label={thread.title}
                  sublabel={thread.status === 'open' ? '进行中' : thread.status === 'revealed' ? '已揭示' : thread.status}
                  accentColor="var(--color-ifline)"
                  onClick={() => handleJump('plot_thread', thread.id)}
                />
              ))}
            </AggregateSection>
          </div>

          {/* Footer */}
          <div
            className="px-3 py-2 border-t text-center"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              共 {relatedChapters.length + relatedCharacters.length + relatedPlotThreads.length} 条关联
            </span>
          </div>
        </GlassCard>
      </motion.div>
    </AnimatePresence>
  )
}
