/**
 * SearchResults - Search result list and empty state for EntitySearch
 */

import { Search, ArrowRight } from 'lucide-react'
import { EntityIcon } from '@/components/ui/Icon'
import type { EntityType } from '@/shared/types'
import { motion } from 'framer-motion'
import { entityTypeConfig } from './SearchFilters'

export const resultVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, type: 'spring' as const, stiffness: 400, damping: 30 },
  }),
}

export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const q = query.toLowerCase()
  const lower = text.toLowerCase()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let index = lower.indexOf(q)

  while (index !== -1) {
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index))
    }
    parts.push(
      <mark
        key={index}
        className="rounded px-0.5 font-medium bg-[var(--selection-bg)] text-[var(--selection-color)]"
      >
        {text.slice(index, index + q.length)}
      </mark>
    )
    lastIndex = index + q.length
    index = lower.indexOf(q, lastIndex)
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : text
}

interface SearchResult {
  type: EntityType
  id: number
  name: string
  description?: string
}

interface SearchResultsProps {
  results: SearchResult[]
  query: string
  selectedIndex: number
  onSelect: (type: EntityType, id: number) => void
  onHoverIndex: (index: number) => void
  onSuggestionClick: (tag: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

export function SearchResults({
  results,
  query,
  selectedIndex,
  onSelect,
  onHoverIndex,
  onSuggestionClick,
  inputRef,
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <motion.div
        className="py-10 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div
          className="relative w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-surface-raised)] flex items-center justify-center"
          initial={{ rotate: -10, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
        >
          <Search className="w-7 h-7 text-[var(--text-disabled)]" />
          <motion.div
            className="absolute inset-0 rounded-full opacity-20"
            style={{ backgroundColor: 'var(--accent-primary)' }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.1, 0.2] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">
          未找到匹配结果
        </p>
        <p className="text-xs text-[var(--text-disabled)]">
          尝试其他关键词或切换分类筛选
        </p>
        <motion.div
          className="mt-4 flex items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {['角色', '物品', '地点'].map((tag) => (
            <motion.button
              key={tag}
              className="px-2 py-1 text-[10px] rounded-full bg-[var(--color-surface-raised)] text-[var(--text-tertiary)] cursor-pointer hover:bg-[var(--color-surface-overlay)]"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onSuggestionClick(tag)
                inputRef.current?.focus()
              }}
              aria-label={`搜索${tag}`}
            >
              {tag}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    )
  }

  return (
    <>
      {results.map((result, index) => {
        const config = entityTypeConfig[result.type]
        const isSelected = index === selectedIndex
        return (
          <motion.button
            key={`${result.type}-${result.id}`}
            custom={index}
            variants={resultVariants}
            initial="hidden"
            animate="visible"
            onClick={() => onSelect(result.type, result.id)}
            onMouseEnter={() => onHoverIndex(index)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group relative overflow-hidden"
            style={{
              backgroundColor: isSelected ? `color-mix(in srgb, ${config.color} 7%, transparent)` : 'transparent',
            }}
            whileHover={{ x: 2, backgroundColor: `color-mix(in srgb, ${config.color} 3%, transparent)` }}
          >
            {isSelected && (
              <motion.div
                className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full"
                style={{ backgroundColor: config.color }}
                layoutId="selectedIndicator"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <motion.div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ backgroundColor: `color-mix(in srgb, ${config.color} 9%, transparent)` }}
              whileHover={{ scale: 1.1, rotate: 3 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {config.iconType === 'search' ? (
                <Search className="w-4 h-4" style={{ color: config.color }} />
              ) : (
                <EntityIcon type={config.iconType} size="sm" style={{ color: config.color }} />
              )}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-[var(--text-primary)]">
                {highlightMatch(result.name, query)}
              </div>
              {result.description && (
                <p className="text-xs truncate text-[var(--text-tertiary)] mt-0.5">
                  {highlightMatch(result.description, query)}
                </p>
              )}
            </div>
            <motion.span
              className="text-[10px] px-2 py-1 rounded-md flex-shrink-0 font-medium"
              style={{
                backgroundColor: `color-mix(in srgb, ${config.color} 8%, transparent)`,
                color: config.color,
                border: `1px solid color-mix(in srgb, ${config.color} 15%, transparent)`,
              }}
              whileHover={{ scale: 1.05 }}
            >
              {config.label}
            </motion.span>
            <motion.div
              className="opacity-0 group-hover:opacity-100 transition-all"
              whileHover={{ x: 3 }}
            >
              <ArrowRight className="w-4 h-4" style={{ color: config.color }} />
            </motion.div>
          </motion.button>
        )
      })}
    </>
  )
}
