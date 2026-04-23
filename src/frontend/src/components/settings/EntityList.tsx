import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Filter, SortAsc, SortDesc } from 'lucide-react'
import { EntityListItem, entityColors } from './EntityCard'
import type { EntityType } from '@/store'

interface EntityListEntity {
  id: number
  name: string
  description?: string
  type: EntityType
  typeLabel: string
  typeColor: string
}

interface EntityListProps {
  entities: EntityListEntity[]
  onEntityClick?: (id: number) => void
  onEntityDelete?: (id: number) => void
  groupByType?: boolean
  showFilter?: boolean
  emptyMessage?: string
}

type SortField = 'name' | 'type'
type SortDirection = 'asc' | 'desc'

export function EntityList({
  entities,
  onEntityClick,
  onEntityDelete,
  groupByType = false,
  showFilter = true,
  emptyMessage = '暂无数据',
}: EntityListProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const filteredEntities = entities.filter(
    (e) => filterType === 'all' || e.type === filterType
  )

  const sortedEntities = [...filteredEntities].sort((a, b) => {
    const modifier = sortDirection === 'asc' ? 1 : -1
    if (sortField === 'name') {
      return a.name.localeCompare(b.name, 'zh-CN') * modifier
    }
    return a.type.localeCompare(b.type) * modifier
  })

  const groupedEntities = groupByType
    ? sortedEntities.reduce((acc, entity) => {
        const key = entity.type
        if (!acc[key]) acc[key] = []
        acc[key].push(entity)
        return acc
      }, {} as Record<string, EntityListEntity[]>)
    : { all: sortedEntities }

  const typeFilters: Array<{ type: EntityType | 'all'; label: string; color: string }> = [
    { type: 'all', label: '全部', color: 'var(--text-tertiary)' },
    { type: 'character', label: '角色', color: entityColors.character.text },
    { type: 'item', label: '物品', color: entityColors.item.text },
    { type: 'location', label: '地点', color: entityColors.location.text },
    { type: 'faction', label: '势力', color: entityColors.faction.text },
    { type: 'world', label: '世界观', color: entityColors.world.text },
    { type: 'rule', label: '规则', color: entityColors.rule.text },
    { type: 'ifline', label: 'IF线', color: entityColors.ifline.text },
  ]

  if (entities.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Filter bar */}
      {showFilter && (
        <div className="flex items-center gap-2 mb-3">
          <motion.button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: showFilters ? 'var(--color-surface-overlay)' : 'transparent',
              color: showFilters ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: '1px solid var(--border-default)',
            }}
            whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
            whileTap={{ scale: 0.95 }}
          >
            <Filter className="w-3 h-3" />
            筛选
            <motion.div
              animate={{ rotate: showFilters ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="w-3 h-3" />
            </motion.div>
          </motion.button>

          <div className="flex-1" />

          {/* Sort buttons */}
          <motion.button
            onClick={() => toggleSort('name')}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: sortField === 'name' ? 'var(--color-surface-overlay)' : 'transparent',
              color: sortField === 'name' ? 'var(--text-primary)' : 'var(--text-tertiary)',
              border: '1px solid var(--border-default)',
            }}
            whileTap={{ scale: 0.95 }}
          >
            名称
            {sortField === 'name' && (
              sortDirection === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
            )}
          </motion.button>
        </div>
      )}

      {/* Filter pills */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            className="flex flex-wrap gap-1.5 mb-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {typeFilters.map(({ type, label, color }) => (
              <motion.button
                key={type}
                onClick={() => setFilterType(type)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  backgroundColor: filterType === type ? `${color}20` : 'transparent',
                  color: filterType === type ? color : 'var(--text-tertiary)',
                  border: `1px solid ${filterType === type ? `${color}40` : 'var(--border-default)'}`,
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entity list */}
      {groupByType ? (
        Object.entries(groupedEntities).map(([type, typeEntities]) => (
          <div key={type} className="space-y-1">
            <div className="flex items-center gap-2 px-3 py-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: typeEntities[0]?.typeColor || 'var(--text-tertiary)' }}
              />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {typeEntities[0]?.typeLabel || type}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${typeEntities[0]?.typeColor || 'var(--text-tertiary)'}15`,
                  color: typeEntities[0]?.typeColor || 'var(--text-tertiary)',
                }}
              >
                {typeEntities.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {typeEntities.map((entity) => (
                <EntityListItem
                  key={`${entity.type}-${entity.id}`}
                  name={entity.name}
                  description={entity.description}
                  type={entity.type}
                  typeColor={entity.typeColor}
                  typeLabel={entity.typeLabel}
                  onClick={() => onEntityClick?.(entity.id)}
                  onDelete={onEntityDelete ? () => onEntityDelete(entity.id) : undefined}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="space-y-0.5">
          {sortedEntities.map((entity) => (
            <EntityListItem
              key={`${entity.type}-${entity.id}`}
              name={entity.name}
              description={entity.description}
              type={entity.type}
              typeColor={entity.typeColor}
              typeLabel={entity.typeLabel}
              onClick={() => onEntityClick?.(entity.id)}
              onDelete={onEntityDelete ? () => onEntityDelete(entity.id) : undefined}
            />
          ))}
        </div>
      )}

      {filteredEntities.length === 0 && (
        <div className="text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
          <p className="text-sm">没有匹配的实体</p>
        </div>
      )}
    </div>
  )
}
