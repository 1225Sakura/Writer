/**
 * SearchFilters - Entity type filter tabs for EntitySearch
 */

import { Search } from 'lucide-react'
import { EntityIcon } from '@/components/ui/Icon'
import type { EntityIconType } from '@/components/ui/Icon'
import type { EntityType } from '@/shared/types'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'

export const entityTypeConfig: Record<EntityType | 'all', { label: string; iconType: EntityIconType | 'search'; color: string }> = {
  all: { label: '全部', iconType: 'search', color: 'var(--accent-primary)' },
  character: { label: '角色', iconType: 'character', color: 'var(--color-character)' },
  item: { label: '物品', iconType: 'item', color: 'var(--color-item)' },
  location: { label: '地点', iconType: 'location', color: 'var(--color-location)' },
  faction: { label: '势力', iconType: 'faction', color: 'var(--color-faction)' },
  world: { label: '世界观', iconType: 'world', color: 'var(--color-world)' },
  rule: { label: '规则', iconType: 'rule', color: 'var(--color-rule)' },
  ifline: { label: 'IF线', iconType: 'ifline', color: 'var(--color-ifline)' },
  outline: { label: '大纲', iconType: 'outline', color: 'var(--color-outline)' },
  chapter: { label: '章节', iconType: 'outline', color: 'var(--color-outline)' },
  plot_thread: { label: '剧情线', iconType: 'outline', color: 'var(--accent-primary)' },
}

interface SearchFiltersProps {
  filterType: EntityType | 'all'
  onFilterChange: (type: EntityType | 'all') => void
}

export function SearchFilters({ filterType, onFilterChange }: SearchFiltersProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto border-b border-[var(--border-default)]">
      {(Object.keys(entityTypeConfig) as Array<EntityType | 'all'>).map((type) => {
        const config = entityTypeConfig[type]
        const isActive = filterType === type
        return (
          <motion.button
            key={type}
            onClick={() => onFilterChange(type)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all"
            style={{
              backgroundColor: isActive ? `${config.color}15` : 'transparent',
              color: isActive ? config.color : 'var(--text-tertiary)',
              border: isActive ? `1px solid ${config.color}30` : '1px solid transparent',
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Object.keys(entityTypeConfig).indexOf(type) * 0.02 }}
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={isActive ? { rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] } : { rotate: 0, scale: 1 }}
              transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            >
              {config.iconType === 'search' ? (
                <Search className="w-3 h-3" />
              ) : (
                <EntityIcon type={config.iconType} size="xs" />
              )}
            </motion.div>
            <span className="relative">
              {config.label}
              {isActive && (
                <motion.div
                  className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                  style={{ backgroundColor: config.color }}
                  layoutId="filterUnderline"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
