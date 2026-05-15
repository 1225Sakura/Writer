import { Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING } from '@/components/shared/AnimationConfig'
import { getTagColor } from './TagList'

interface TagSuggestionsProps {
  suggestions: string[]
  showSuggestions: boolean
  highlightedIndex: number
  inputValue: string
  entityType: string
  onSelect: (tag: string) => void
  onHighlight: (index: number) => void
}

export function TagSuggestions({
  suggestions,
  showSuggestions,
  highlightedIndex,
  inputValue,
  entityType,
  onSelect,
  onHighlight,
}: TagSuggestionsProps) {
  return (
    <>
      {/* Autocomplete suggestions */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-1 rounded-md overflow-hidden z-10 bg-[var(--color-surface-base)] border border-[var(--border-default)]"
            initial={{ opacity: 0, y: -4, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.9 }}
            transition={SPRING.SNAPPY}
          >
            {suggestions.map((suggestion, index) => {
              const color = getTagColor(suggestion, entityType)
              const isHighlighted = index === highlightedIndex
              return (
                <motion.button
                  key={suggestion}
                  onClick={() => onSelect(suggestion)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors text-[var(--text-secondary)] hover:translate-x-1"
                  style={{
                    backgroundColor: isHighlighted ? `${color}15` : 'transparent',
                  }}
                  onMouseEnter={() => onHighlight(index)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  whileHover={{ x: 4 }}
                >
                  <Tag className="w-3 h-3" style={{ color }} />
                  {suggestion}
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      <AnimatePresence>
        {showSuggestions && suggestions.length === 0 && inputValue.trim() && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-1 rounded-md p-3 z-10 text-xs text-center bg-[var(--color-surface-base)] border border-[var(--border-default)] text-[var(--text-tertiary)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            按 Enter 创建新标签 &quot;{inputValue.trim()}&quot;
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
