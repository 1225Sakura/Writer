import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Users, MapPin, Swords, ScrollText, Settings, PenTool, Search, X, ChevronRight, CheckCircle, Circle, CheckSquare, Square, Check, XCircle, Pencil } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import { typeColors } from '@/lib/entityColors'
import type { ExtractedEntityLocal } from '@/store/chatStore'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

/* ============================================================
   TYPE LABELS & ICONS
   ============================================================ */

const typeLabels: Record<string, string> = {
  world: '世界观',
  character: '角色',
  item: '物品',
  location: '地点',
  faction: '势力',
  rule: '规则',
  ifline: 'IF线',
}

const typeIcons: Record<string, React.ElementType> = {
  world: BookOpen,
  character: Users,
  item: ScrollText,
  location: MapPin,
  faction: Swords,
  rule: Settings,
  ifline: PenTool,
}

const allTypes = ['world', 'character', 'item', 'location', 'faction', 'rule', 'ifline']

/* ============================================================
   HIGHLIGHTED TEXT
   ============================================================ */

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>

  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return <>{text}</>

  return (
    <>
      {text.slice(0, index)}
      <span className="bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] rounded px-0.5">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  )
}

/* ============================================================
   WELCOME PANEL - Left sidebar entity overview + quick navigation
   ============================================================ */

export function WelcomePanel({ entities }: { entities: ExtractedEntityLocal[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Filter entities based on search query and type filter
  const filteredEntities = useMemo(() => {
    let result = entities

    if (activeTypeFilter) {
      result = result.filter((e) => e.type === activeTypeFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          (e.description && e.description.toLowerCase().includes(query))
      )
    }

    return result
  }, [entities, searchQuery, activeTypeFilter])

  // Group filtered entities by type
  const groupedEntities = useMemo(() => {
    return filteredEntities.reduce(
      (acc, entity) => {
        const key = entity.type
        if (!acc[key]) acc[key] = []
        acc[key].push(entity)
        return acc
      },
      {} as Record<string, ExtractedEntityLocal[]>
    )
  }, [filteredEntities])

  // Flat list of visible entities for keyboard navigation
  const flatEntities = filteredEntities

  const confirmedCount = entities.filter((e) => e.confirmed).length
  const progressPercent = entities.length > 0 ? (confirmedCount / entities.length) * 100 : 0

  // Count entities per type for filter badges
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    entities.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1
    })
    return counts
  }, [entities])

  // Multi-select helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(flatEntities.map((e) => e.id)))
  }, [flatEntities])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const toggleMultiSelectMode = useCallback(() => {
    setMultiSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set())
        setFocusedIndex(-1)
      }
      return !prev
    })
  }, [])

  // Batch confirm/unconfirm (callback prop pattern - parent handles state)
  const batchConfirm = useCallback(() => {
    // Dispatch custom event for parent to handle
    const event = new CustomEvent('entity-batch-confirm', {
      detail: { ids: Array.from(selectedIds), confirmed: true },
    })
    window.dispatchEvent(event)
    setSelectedIds(new Set())
    setMultiSelectMode(false)
  }, [selectedIds])

  const batchUnconfirm = useCallback(() => {
    const event = new CustomEvent('entity-batch-confirm', {
      detail: { ids: Array.from(selectedIds), confirmed: false },
    })
    window.dispatchEvent(event)
    setSelectedIds(new Set())
    setMultiSelectMode(false)
  }, [selectedIds])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (flatEntities.length === 0) return

      switch (e.key) {
        case 'Tab': {
          e.preventDefault()
          const direction = e.shiftKey ? -1 : 1
          const nextIndex = Math.max(0, Math.min(flatEntities.length - 1, focusedIndex + direction))
          setFocusedIndex(nextIndex)
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const nextDown = Math.min(flatEntities.length - 1, focusedIndex + 1)
          setFocusedIndex(nextDown)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const nextUp = Math.max(0, focusedIndex - 1)
          setFocusedIndex(nextUp)
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < flatEntities.length) {
            const entity = flatEntities[focusedIndex]
            if (multiSelectMode) {
              toggleSelect(entity.id)
            } else {
              // Dispatch confirm event
              const event = new CustomEvent('entity-confirm', {
                detail: { id: entity.id },
              })
              window.dispatchEvent(event)
            }
          }
          break
        }
        case 'Escape': {
          e.preventDefault()
          if (multiSelectMode) {
            setMultiSelectMode(false)
            setSelectedIds(new Set())
          }
          setFocusedIndex(-1)
          break
        }
        case ' ': {
          // Space to toggle select in multi-select mode
          if (multiSelectMode && focusedIndex >= 0) {
            e.preventDefault()
            toggleSelect(flatEntities[focusedIndex].id)
          }
          break
        }
      }
    },
    [flatEntities, focusedIndex, multiSelectMode, toggleSelect]
  )

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && focusedIndex < flatEntities.length) {
      const entityId = flatEntities[focusedIndex].id
      const el = itemRefs.current.get(entityId)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedIndex, flatEntities])

  const hasSelection = selectedIds.size > 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm text-[var(--text-primary)]">
              已收集信息
            </h2>
            <p className="text-[11px] mt-1 text-[var(--text-tertiary)]">
              {confirmedCount}/{entities.length} 项已确认
            </p>
          </div>

          {/* Multi-select toggle */}
          <button
            onClick={toggleMultiSelectMode}
            className={`p-1.5 rounded-lg transition-colors text-xs ${
              multiSelectMode
                ? 'bg-[var(--accent-primary)] text-white'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)]'
            }`}
            title={multiSelectMode ? '退出多选' : '多选模式'}
          >
            {multiSelectMode ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <CheckSquare className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Batch action bar */}
        <AnimatePresence>
          {multiSelectMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border-subtle)]">
                <motion.button
                  onClick={selectAll}
                  className="text-[10px] px-2 py-1 rounded bg-[var(--color-surface-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  全选
                </motion.button>
                <motion.button
                  onClick={clearSelection}
                  className="text-[10px] px-2 py-1 rounded bg-[var(--color-surface-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  清除
                </motion.button>
                <span className="text-[10px] text-[var(--text-tertiary)] ml-auto">
                  {selectedIds.size} 项选中
                </span>
              </div>

              {hasSelection && (
                <div className="flex gap-2 mt-2">
                  <motion.button
                    onClick={batchConfirm}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] px-2 py-1.5 rounded-lg
                               bg-[var(--color-ifline)] text-white hover:opacity-90 transition-opacity"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Check className="w-3 h-3" />
                    批量确认
                  </motion.button>
                  <motion.button
                    onClick={batchUnconfirm}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] px-2 py-1.5 rounded-lg
                               bg-[var(--color-surface-base)] text-[var(--text-secondary)] border border-[var(--border-default)]
                               hover:text-[var(--text-primary)] transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <X className="w-3 h-3" />
                    取消确认
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        {entities.length > 0 && (
          <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-[var(--color-surface-base)]">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: progressPercent === 100
                  ? 'linear-gradient(90deg, var(--color-ifline), color-mix(in srgb, var(--color-ifline) 70%, var(--accent-primary)))'
                  : 'linear-gradient(90deg, var(--accent-primary), var(--accent-hover))',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: EASE.SMOOTH }}
            />
          </div>
        )}
      </div>

      {/* Search box */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索实体..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg
                       bg-[var(--color-surface-base)] border border-[var(--border-default)]
                       text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]
                       focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20
                       transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Type filter tags */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveTypeFilter(null)}
          className={`px-2 py-0.5 rounded-full text-[10px] transition-colors ${
            activeTypeFilter === null
              ? 'bg-[var(--accent-primary)] text-white'
              : 'bg-[var(--color-surface-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          全部
        </button>
        {allTypes.map((type) => {
          const count = typeCounts[type] || 0
          if (count === 0) return null
          const color = typeColors[type] || 'var(--color-character)'
          return (
            <button
              key={type}
              onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
              className={`px-2 py-0.5 rounded-full text-[10px] transition-colors flex items-center gap-1 ${
                activeTypeFilter === type
                  ? 'text-white'
                  : 'bg-[var(--color-surface-base)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={{
                backgroundColor: activeTypeFilter === type ? color : undefined,
              }}
            >
              {typeLabels[type] || type}
              <span className="opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Entity list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto scrollbar-thin py-2"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label="实体列表"
        aria-multiselectable={multiSelectMode}
      >
        {entities.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              开始对话后，这里将显示收集到的设定信息
            </p>
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-xs text-[var(--text-tertiary)]">
              没有找到匹配的实体
            </p>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {/* Keyboard navigation hint */}
            {focusedIndex >= 0 && (
              <div className="text-[9px] text-[var(--text-tertiary)] text-center mb-1">
                Tab/方向键导航 · Enter 确认 · Escape 清除焦点
              </div>
            )}
            <AnimatePresence mode="popLayout">
              {Object.entries(groupedEntities).map(([type, typeEntities]) => {
                const Icon = typeIcons[type] || BookOpen
                const color = typeColors[type] || 'var(--color-character)'
                const confirmed = typeEntities.filter((e) => e.confirmed).length
                return (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    layout
                    transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                  >
                    {/* Type header */}
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-[var(--text-primary)]">
                          {typeLabels[type] || type}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                        {confirmed}/{typeEntities.length}
                      </span>
                    </div>

                    {/* Entity items as cards */}
                    <div className="ml-3 space-y-1">
                      {typeEntities.map((entity) => {
                        const globalIndex = flatEntities.indexOf(entity)
                        return (
                          <EntityCard
                            key={entity.id}
                            entity={entity}
                            color={color}
                            searchQuery={searchQuery}
                            multiSelectMode={multiSelectMode}
                            isSelected={selectedIds.has(entity.id)}
                            isFocused={globalIndex === focusedIndex}
                            onToggleSelect={() => toggleSelect(entity.id)}
                            refCallback={(el) => {
                              if (el) itemRefs.current.set(entity.id, el)
                              else itemRefs.current.delete(entity.id)
                            }}
                          />
                        )
                      })}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   ENTITY CARD - Expandable card for each entity
   ============================================================ */

function EntityCard({
  entity,
  color,
  searchQuery,
  multiSelectMode = false,
  isSelected = false,
  isFocused = false,
  onToggleSelect,
  refCallback,
}: {
  entity: ExtractedEntityLocal
  color: string
  searchQuery: string
  multiSelectMode?: boolean
  isSelected?: boolean
  isFocused?: boolean
  onToggleSelect?: () => void
  refCallback?: (el: HTMLDivElement | null) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(entity.name)
  const [editDescription, setEditDescription] = useState(entity.description || '')
  const updateExtractedEntity = useChatStore((state) => state.updateExtractedEntity)

  const handleStartEdit = useCallback(() => {
    setEditName(entity.name)
    setEditDescription(entity.description || '')
    setIsEditing(true)
    setExpanded(true)
  }, [entity.name, entity.description])

  const handleSaveEdit = useCallback(() => {
    if (editName.trim()) {
      updateExtractedEntity(entity.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      })
    }
    setIsEditing(false)
  }, [entity.id, editName, editDescription, updateExtractedEntity])

  const handleCancelEdit = useCallback(() => {
    setEditName(entity.name)
    setEditDescription(entity.description || '')
    setIsEditing(false)
  }, [entity.name, entity.description])

  return (
    <motion.div
      ref={refCallback}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      layout
      role="option"
      aria-selected={isSelected}
      className={`rounded-lg overflow-hidden transition-shadow ${
        isFocused ? 'ring-2 ring-[var(--accent-primary)] ring-offset-1 ring-offset-[var(--color-surface-base)]' : ''
      }`}
      style={{
        backgroundColor: 'var(--color-surface-base)',
        border: `1px solid ${
          isSelected
            ? 'var(--accent-primary)'
            : entity.confirmed
              ? 'color-mix(in srgb, var(--color-ifline) 20%, transparent)'
              : 'var(--border-default)'
        }`,
      }}
    >
      {/* Card header */}
      <div className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs">
        {/* Multi-select checkbox */}
        {multiSelectMode && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect?.()
            }}
            className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-[var(--color-surface-hover)]"
            aria-label={isSelected ? `取消选择 ${entity.name}` : `选择 ${entity.name}`}
          >
            {isSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            ) : (
              <Square className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            )}
          </button>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-[var(--color-surface-hover)] cursor-pointer"
        >
          <motion.div
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
          </motion.div>
        </button>

        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: entity.confirmed ? 'var(--color-ifline)' : color }}
        />
        <span className={`flex-1 text-left truncate ${entity.confirmed ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
          <HighlightedText text={entity.name} query={searchQuery} />
        </span>
        {!isEditing && !multiSelectMode && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleStartEdit()
            }}
            className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-[var(--color-surface-hover)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            aria-label={`编辑 ${entity.name}`}
            title="编辑"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {entity.confirmed ? (
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <CheckCircle className="w-3.5 h-3.5 text-[var(--color-ifline)]" />
          </motion.div>
        ) : (
          <Circle className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE.SMOOTH }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-1 border-t border-[var(--border-subtle)]">
              {isEditing ? (
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded bg-[var(--color-surface-input)] border border-[var(--border-default)]
                               text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20"
                    placeholder="实体名称"
                    autoFocus
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-2 py-1 text-[11px] rounded bg-[var(--color-surface-input)] border border-[var(--border-default)]
                               text-[var(--text-primary)] resize-none min-h-[40px] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]/20"
                    placeholder="描述（可选）"
                    rows={2}
                  />
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 text-[10px] rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-2 py-0.5 text-[10px] rounded bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {entity.description && (
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mb-1">
                      {entity.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                        color: color,
                      }}
                    >
                      {typeLabels[entity.type] || entity.type}
                    </span>
                    {entity.confirmed && (
                      <span className="text-[9px] text-[var(--color-ifline)]">已确认</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
