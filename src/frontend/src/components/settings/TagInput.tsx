import { useState, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/store'
import { Tag, X, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface TagInputProps {
  entityType: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'ifline'
  entityId: number
  tags: string[]
}

// Entity type color mapping
const ENTITY_TYPE_COLORS: Record<string, string> = {
  character: '#e8b87d',
  item: '#9b7ed9',
  location: '#5eb5a6',
  faction: '#d45d5d',
  world: '#5e6ad2',
  rule: '#7eb84a',
  ifline: '#7eb84a',
  outline: '#5b8ee8',
}

// Tag animation variants
const tagVariants = {
  initial: { opacity: 0, scale: 0.6, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.6, x: -10 },
}

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.03 } },
}

function getTagColor(tagName: string, entityType?: string): string {
  // If entity type is provided, use it as base hue influence
  if (entityType && ENTITY_TYPE_COLORS[entityType]) {
    const baseColor = ENTITY_TYPE_COLORS[entityType]
    // Generate variation based on tag name
    let hash = 0
    for (let i = 0; i < tagName.length; i++) {
      hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
    }
    // Return the entity type color with slight opacity variation
    return baseColor
  }

  // Fallback to hash-based color
  const TAG_COLORS = [
    '#e8b87d', '#9b7ed9', '#5eb5a6', '#d45d5d', '#5e6ad2',
    '#7eb84a', '#c45c5c', '#5b8ee8', '#e87d9b', '#8ee85b',
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
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all cursor-default group/tag"
              style={{
                backgroundColor: `${color}18`,
                color: color,
                border: `1px solid ${color}25`,
              }}
              whileHover={{
                backgroundColor: `${color}28`,
                borderColor: `${color}40`,
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
                  className="p-0.5 rounded opacity-0 group-hover/tag:opacity-100 transition-opacity"
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
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

  const entityColor = ENTITY_TYPE_COLORS[entityType] || '#5e6ad2'

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
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
                  className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs transition-all outline-none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${inputValue ? `${entityColor}50` : 'rgba(255,255,255,0.1)'}`,
                    color: '#f7f8f8',
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
                className="p-1.5 rounded transition-colors hover:bg-white/10"
                style={{ color: '#6b7280' }}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Autocomplete suggestions with animation */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  className="absolute top-full left-0 right-0 mt-1 rounded-md overflow-hidden z-10"
                  style={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                  initial={{ opacity: 0, y: -4, scaleY: 0.9 }}
                  animate={{ opacity: 1, y: 0, scaleY: 1 }}
                  exit={{ opacity: 0, y: -4, scaleY: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  {suggestions.map((suggestion, index) => {
                    const color = getTagColor(suggestion, entityType)
                    const isHighlighted = index === highlightedIndex
                    return (
                      <motion.button
                        key={suggestion}
                        onClick={() => handleAdd(suggestion)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
                        style={{
                          color: '#d0d6e0',
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
                  className="absolute top-full left-0 right-0 mt-1 rounded-md p-3 z-10 text-xs text-center"
                  style={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#6b7280',
                  }}
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
            className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
            style={{
              backgroundColor: 'transparent',
              color: '#6b7280',
              border: '1px dashed rgba(255,255,255,0.15)',
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
