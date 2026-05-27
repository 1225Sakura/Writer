import { useRef, useState, useEffect } from 'react'
import { Tag, X, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING } from '@/components/shared/AnimationConfig'
import { TagSuggestions } from './TagSuggestions'
import { getTagColor } from './TagList'

interface TagInputFieldProps {
  entityType: string
  entityId: number
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  suggestions: string[]
  onInputChange?: (value: string) => void
}

export function TagInputField({
  entityType,
  tags,
  onAdd,
  suggestions,
  onInputChange,
}: TagInputFieldProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

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
    onAdd(trimmed)
    setInputValue('')
    setShowSuggestions(false)
    inputRef.current?.focus()
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

  const entityColor = getTagColor('', entityType)

  return (
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
                  onInputChange?.(e.target.value)
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder="输入标签..."
                aria-label="添加标签"
                className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs transition-all outline-none bg-white/5 text-[var(--text-primary)] border border-white/10 focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--accent-muted)]"
                style={{
                  borderColor: inputValue ? `color-mix(in srgb, ${entityColor} 31%, transparent)` : 'rgba(255,255,255,0.1)',
                  boxShadow: inputValue ? `0 0 0 2px color-mix(in srgb, ${entityColor} 8%, transparent)` : 'none',
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

          <TagSuggestions
            suggestions={suggestions}
            showSuggestions={showSuggestions}
            highlightedIndex={highlightedIndex}
            inputValue={inputValue}
            entityType={entityType}
            onSelect={handleAdd}
            onHighlight={setHighlightedIndex}
          />
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
            backgroundColor: `color-mix(in srgb, ${entityColor} 6%, transparent)`,
            borderColor: `color-mix(in srgb, ${entityColor} 25%, transparent)`,
            color: entityColor,
          }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-3 h-3" />
          添加标签
        </motion.button>
      )}
    </AnimatePresence>
  )
}
