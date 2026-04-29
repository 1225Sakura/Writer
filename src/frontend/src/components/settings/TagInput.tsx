import { useState, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/store'
import { Tag, X, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING } from '@/components/shared/AnimationConfig'


interface TagInputProps {
  entityType: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'ifline'
  entityId: number
  tags: string[]
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  world: 'var(--color-world)',
  rule: 'var(--color-rule)',
  ifline: 'var(--color-ifline)',
  outline: 'var(--color-outline)',
}

const tagVariants = {
  initial: { opacity: 0, scale: 0.7, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.5, x: -12, transition: { duration: 0.15 } },
}

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}

function getTagColor(tagName: string, entityType?: string): string {
  if (entityType && ENTITY_TYPE_COLORS[entityType]) {
    return ENTITY_TYPE_COLORS[entityType]
  }

  const TAG_COLORS = [
    'var(--color-character)', 'var(--color-item)', 'var(--color-location)',
    'var(--color-faction)', 'var(--color-outline)', 'var(--color-ifline)',
    'var(--color-vermillion-red)', 'var(--color-outline)', '#e87d9b', '#8ee85b',
  ]
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export function TagChips({
  tags,
  onRemove,
  entityType,
}: {
  tags: string[]
  onRemove?: (tag: string) => void
  entityType?: string
}) {
  if (!tags || tags.length === 0) return null

  return (
    <motion.div
      className="flex flex-wrap gap-1.5 mt-2"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <AnimatePresence mode="popLayout">
        {tags.map((tag) => {
          const color = getTagColor(tag, entityType)
          return (
            <motion.span
              key={tag}
              variants={tagVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition-all cursor-default group/tag"
              style={{
                backgroundColor: `${color}12`,
                color: color,
                border: `1px solid ${color}25`,
                boxShadow: `0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.03)`,
              }}
              whileHover={{
                backgroundColor: `${color}18`,
                borderColor: `${color}45`,
                boxShadow: `0 4px 14px ${color}30, 0 1px 4px rgba(0,0,0,0.15)`,
                y: -2,
              }}
            >
              <Tag className="w-3 h-3 opacity-70" />
              {tag}
              {onRemove && (
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(tag)
                  }}
                  className="p-0.5 rounded-full opacity-0 group-hover/tag:opacity-100 transition-all"
                  whileHover={{ scale: 1.3, backgroundColor: `${color}30` }}
                  whileTap={{ scale: 0.85, rotate: 90 }}
                  style={{ color }}
                >
                  <X className="w-3 h-3" />
                </motion.button>
              )}
            </motion.span>
          )
        })}
      </AnimatePresence>
    </motion.div>
  )
}

export function TagInput({ entityType, entityId, tags }: TagInputProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const addTagToEntity = useSettingsStore((state) => state.addTagToEntity)
  const removeTagFromEntity = useSettingsStore((state) => state.removeTagFromEntity)
  const allTags = useSettingsStore((state) => state.tags)

  const existingTagNames = allTags.map((t) => t.name)
  const suggestions = inputValue.trim()
    ? existingTagNames.filter(
        (name) =>
          name.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.includes(name)
      )
    : existingTagNames.filter((name) => !tags.includes(name)).slice(0, 6)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setIsAdding(false)
        setInputValue('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus()
    }
  }, [isAdding])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [inputValue])

  const handleAdd = (tagName: string) => {
    const trimmed = tagName.trim()
    if (!trimmed || tags.includes(trimmed)) return
    addTagToEntity(entityType, entityId, trimmed)
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleRemove = (tag: string) => {
    removeTagFromEntity(entityType, entityId, tag)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0 && highlightedIndex < suggestions.length) {
        handleAdd(suggestions[highlightedIndex])
      } else if (inputValue.trim()) {
        handleAdd(inputValue)
      }
    } else if (e.key === 'Escape') {
      setIsAdding(false)
      setInputValue('')
      setShowSuggestions(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    }
  }

  const entityColor = ENTITY_TYPE_COLORS[entityType] || 'var(--accent-primary)'

  return (
    <div ref={containerRef} className="relative">
      <TagChips tags={tags} onRemove={handleRemove} entityType={entityType} />

      <AnimatePresence mode="wait">
        {isAdding ? (
          <motion.div
            key="input"
            className="mt-2 relative"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={SPRING.SNAPPY}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 500 }}
                >
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: entityColor }} />
                </motion.div>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="输入标签..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs transition-all outline-none bg-white/5 text-[var(--text-primary)] border border-white/10 focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--accent-muted)]"
                  style={{
                    borderColor: inputValue ? `${entityColor}50` : 'rgba(255,255,255,0.1)',
                    boxShadow: inputValue ? `0 0 0 2px ${entityColor}15` : 'none',
                  }}
                />
              </div>
              <motion.button
                onClick={() => {
                  setIsAdding(false)
                  setInputValue('')
                  setShowSuggestions(false)
                }}
                className="p-1.5 rounded transition-colors hover:bg-white/10 text-[var(--text-tertiary)] hover:rotate-90 active:scale-90"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

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
                        onClick={() => handleAdd(suggestion)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors text-[var(--text-secondary)] hover:translate-x-1"
                        style={{
                          backgroundColor: isHighlighted ? `${color}15` : 'transparent',
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
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
          </motion.div>
        ) : (
          <motion.button
            key="add-button"
            onClick={() => setIsAdding(true)}
            className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-all border border-dashed border-white/15 text-[var(--text-tertiary)] hover:border-[var(--border-strong)]"
            style={{
              backgroundColor: 'transparent',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{
              backgroundColor: `${entityColor}10`,
              borderColor: `${entityColor}40`,
              color: entityColor,
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-3 h-3" />
            添加标签
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
