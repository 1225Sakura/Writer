/**
 * ChapterEntityLinker — Link characters, locations, factions to a chapter.
 * US-016: Chapter-Entity Association
 */

import { useState, useMemo, useCallback } from 'react'
import { Search, Link2, X, Users, MapPinned, ShieldAlert } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { Icon } from '@/components/ui/Icon'
import { ENTITY_TYPE_COLORS } from './TagList'
import { useSettingsStore } from '@/store/settingsStore'

// ============================================
// Types
// ============================================

export interface LinkedEntity {
  type: string
  id: number
  name: string
}

export interface ChapterEntityLinkerProps {
  chapterId: number
  linkedEntities: LinkedEntity[]
  onLink: (entityType: string, entityId: number) => void
  onUnlink: (entityType: string, entityId: number) => void
}

// ============================================
// Constants
// ============================================

const SUPPORTED_TYPES = [
  { key: 'character', label: '角色', icon: Users },
  { key: 'location', label: '地点', icon: MapPinned },
  { key: 'faction', label: '势力', icon: ShieldAlert },
] as const

type EntityTypeKey = typeof SUPPORTED_TYPES[number]['key']

// ============================================
// Tag chip animation variants
// ============================================

const chipVariants = {
  initial: { opacity: 0, scale: 0.7, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.5, x: -12, transition: { duration: 0.15 } },
}

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}

// ============================================
// EntityChip — single linked entity chip
// ============================================

function EntityChip({
  entity,
  onRemove,
}: {
  entity: LinkedEntity
  onRemove: () => void
}) {
  const color = ENTITY_TYPE_COLORS[entity.type] || 'var(--accent-primary)'

  return (
    <motion.span
      variants={chipVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      layout
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium cursor-default group/chip"
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 7%, transparent)`,
        color: color,
        border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
        boxShadow: `0 1px 3px color-mix(in srgb, var(--ink-100) 10%, transparent), inset 0 1px 0 color-mix(in srgb, var(--paper-100) 3%, transparent)`,
      }}
      whileHover={{
        backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 27%, transparent)`,
        boxShadow: `0 4px 14px color-mix(in srgb, ${color} 19%, transparent), 0 1px 4px color-mix(in srgb, var(--ink-100) 15%, transparent)`,
        y: -2,
      }}
    >
      <Link2 className="w-3 h-3 opacity-70" />
      {entity.name}
      <motion.button
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="p-0.5 rounded-full opacity-0 group-hover/chip:opacity-100 transition-all"
        whileHover={{ scale: 1.3, backgroundColor: `color-mix(in srgb, ${color} 19%, transparent)` }}
        whileTap={{ scale: 0.85, rotate: 90 }}
        style={{ color }}
        aria-label={`取消关联: ${entity.name}`}
      >
        <X className="w-3 h-3" />
      </motion.button>
    </motion.span>
  )
}

// ============================================
// EntitySearchResult — single search result item
// ============================================

function EntitySearchResult({
  name,
  type,
  isLinked,
  onToggle,
}: {
  name: string
  type: string
  isLinked: boolean
  onToggle: () => void
}) {
  const color = ENTITY_TYPE_COLORS[type] || 'var(--accent-primary)'
  const typeDef = SUPPORTED_TYPES.find((t) => t.key === type)
  const TypeIcon = typeDef?.icon || Users

  return (
    <motion.button
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-left transition-colors"
      style={{
        backgroundColor: isLinked ? `color-mix(in srgb, ${color} 10%, transparent)` : 'transparent',
        color: isLinked ? color : 'var(--text-primary)',
      }}
      whileHover={{
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon icon={TypeIcon} size="xs" color="inherit" />
      <span className="flex-1 text-xs font-medium truncate">{name}</span>
      {isLinked && (
        <motion.span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          已关联
        </motion.span>
      )}
    </motion.button>
  )
}

// ============================================
// ChapterEntityLinker — main component
// ============================================

export function ChapterEntityLinker({
  chapterId: _chapterId,
  linkedEntities,
  onLink,
  onUnlink,
}: ChapterEntityLinkerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<EntityTypeKey | 'all'>('all')

  const { characters, locations, factions } = useSettingsStore()

  // Build linked entity lookup set for fast checks
  const linkedSet = useMemo(() => {
    const set = new Set<string>()
    for (const e of linkedEntities) {
      set.add(`${e.type}:${e.id}`)
    }
    return set
  }, [linkedEntities])

  // Build searchable entity list
  const allEntities = useMemo(() => {
    const result: Array<{ type: EntityTypeKey; id: number; name: string }> = []
    for (const c of characters) {
      result.push({ type: 'character', id: c.id, name: c.name })
    }
    for (const l of locations) {
      result.push({ type: 'location', id: l.id, name: l.name })
    }
    for (const f of factions) {
      result.push({ type: 'faction', id: f.id, name: f.name })
    }
    return result
  }, [characters, locations, factions])

  // Filter by search and type
  const filteredEntities = useMemo(() => {
    let list = allEntities
    if (activeFilter !== 'all') {
      list = list.filter((e) => e.type === activeFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((e) => e.name.toLowerCase().includes(q))
    }
    return list
  }, [allEntities, activeFilter, searchQuery])

  const handleToggle = useCallback(
    (entityType: string, entityId: number) => {
      const key = `${entityType}:${entityId}`
      if (linkedSet.has(key)) {
        onUnlink(entityType, entityId)
      } else {
        onLink(entityType, entityId)
      }
    },
    [linkedSet, onLink, onUnlink],
  )

  // Count linked by type
  const linkedCounts = useMemo(() => {
    const counts: Record<string, number> = { character: 0, location: 0, faction: 0 }
    for (const e of linkedEntities) {
      if (counts[e.type] !== undefined) counts[e.type]++
    }
    return counts
  }, [linkedEntities])

  return (
    <div className="space-y-3">
      {/* Linked entities chips display */}
      <div className="flex items-center gap-2">
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all"
          style={{
            backgroundColor: isExpanded
              ? 'color-mix(in srgb, var(--color-outline) 15%, transparent)'
              : 'var(--color-surface-overlay)',
            color: isExpanded ? 'var(--color-outline)' : 'var(--text-tertiary)',
            border: `1px solid ${isExpanded ? 'color-mix(in srgb, var(--color-outline) 25%, transparent)' : 'var(--border-subtle)'}`,
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <Icon icon={Link2} size="xs" color="inherit" />
          <span>实体关联</span>
          {linkedEntities.length > 0 && (
            <span
              className="text-[10px] px-1 py-0 rounded-full"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-outline) 20%, transparent)' }}
            >
              {linkedEntities.length}
            </span>
          )}
        </motion.button>

        {/* Type count badges */}
        {SUPPORTED_TYPES.map((t) => {
          const count = linkedCounts[t.key] || 0
          if (count === 0) return null
          const color = ENTITY_TYPE_COLORS[t.key]
          return (
            <motion.span
              key={t.key}
              className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              {count} {t.label}
            </motion.span>
          )
        })}
      </div>

      {/* Linked chips */}
      {linkedEntities.length > 0 && (
        <motion.div
          className="flex flex-wrap gap-1.5"
          variants={containerVariants}
          initial="initial"
          animate="animate"
        >
          <AnimatePresence mode="popLayout">
            {linkedEntities.map((entity) => (
              <EntityChip
                key={`${entity.type}:${entity.id}`}
                entity={entity}
                onRemove={() => onUnlink(entity.type, entity.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Expanded search panel */}
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
            {/* Search input */}
            <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-md"
                style={{
                  backgroundColor: 'var(--color-surface-base)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <Icon icon={Search} size="xs" color="muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索实体名称..."
                  className="flex-1 bg-transparent text-xs outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
                {searchQuery && (
                  <motion.button
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 rounded-full"
                    style={{ color: 'var(--text-tertiary)' }}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-3 h-3" />
                  </motion.button>
                )}
              </div>

              {/* Type filter tabs */}
              <div className="flex gap-1">
                <motion.button
                  onClick={() => setActiveFilter('all')}
                  className="px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: activeFilter === 'all'
                      ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)'
                      : 'transparent',
                    color: activeFilter === 'all' ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  全部
                </motion.button>
                {SUPPORTED_TYPES.map((t) => {
                  const color = ENTITY_TYPE_COLORS[t.key]
                  const isActive = activeFilter === t.key
                  return (
                    <motion.button
                      key={t.key}
                      onClick={() => setActiveFilter(t.key)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
                      style={{
                        backgroundColor: isActive ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
                        color: isActive ? color : 'var(--text-tertiary)',
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Icon icon={t.icon} size="xs" color="inherit" />
                      {t.label}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Results list */}
            <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
              {filteredEntities.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
                  {searchQuery ? '未找到匹配实体' : '暂无可用实体'}
                </p>
              ) : (
                filteredEntities.map((entity) => (
                  <EntitySearchResult
                    key={`${entity.type}:${entity.id}`}
                    name={entity.name}
                    type={entity.type}
                    isLinked={linkedSet.has(`${entity.type}:${entity.id}`)}
                    onToggle={() => handleToggle(entity.type, entity.id)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
