/**
 * ChatAutocomplete — # entity mention popup (groups entities by type).
 *
 * Extracted from InputField.tsx (Phase 0b.2 split).
 */
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, MapPin, PenTool, ScrollText, Settings, Swords, Users } from 'lucide-react'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { typeColors } from '@/lib/entityColors'
import type { ExtractedEntityLocal } from '@/store/chatStore'

interface AutocompletePopupProps {
  entities: ExtractedEntityLocal[]
  query: string
  selectedIndex: number
  onSelect: (entity: ExtractedEntityLocal) => void
  visible: boolean
}

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

export function AutocompletePopup({
  entities,
  query,
  selectedIndex,
  onSelect,
  visible,
}: AutocompletePopupProps) {
  // Filter by query (fuzzy match on name)
  const filtered = useMemo(() => {
    if (!query) return entities
    const lower = query.toLowerCase()
    return entities.filter((e) => e.name.toLowerCase().includes(lower))
  }, [entities, query])

  // Group by type, preserving order
  const grouped = useMemo(() => {
    const groups: { type: string; entities: ExtractedEntityLocal[] }[] = []
    for (const type of allTypes) {
      const typeEntities = filtered.filter((e) => e.type === type)
      if (typeEntities.length > 0) {
        groups.push({ type, entities: typeEntities })
      }
    }
    return groups
  }, [filtered])

  // Flatten for keyboard navigation
  const flatList = useMemo(() => {
    return grouped.flatMap((g) => g.entities)
  }, [grouped])

  if (!visible || flatList.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      className="absolute bottom-full left-0 right-0 mb-2 z-50"
    >
      <div
        className="rounded-xl overflow-hidden border border-default shadow-lg"
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
          backgroundColor: 'var(--color-surface-raised)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {grouped.map(({ type, entities: typeEntities }) => {
          const TypeIcon = typeIcons[type] || BookOpen
          const color = typeColors[type] || 'var(--color-character)'
          return (
            <div key={type}>
              {/* Type header */}
              <div
                className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider select-none"
                style={{
                  color: 'var(--text-tertiary)',
                  backgroundColor: 'var(--color-surface-input)',
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span style={{ color }}>{typeLabels[type] || type}</span>
                </span>
              </div>
              {/* Entity items */}
              {typeEntities.map((entity) => {
                const flatIndex = flatList.indexOf(entity)
                const isSelected = flatIndex === selectedIndex
                return (
                  <div
                    key={entity.id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm"
                    style={{
                      backgroundColor: isSelected
                        ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
                        : undefined,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onSelect(entity)
                    }}
                  >
                    <TypeIcon size={14} style={{ color, flexShrink: 0 }} />
                    <span className="font-medium text-primary truncate">{entity.name}</span>
                    {entity.description && (
                      <span className="text-xs text-tertiary truncate flex-1 min-w-0">
                        {entity.description.length > 30
                          ? entity.description.slice(0, 30) + '...'
                          : entity.description}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}