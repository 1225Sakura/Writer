import { useState, useRef, useEffect } from 'react'
import { useSettingsStore } from '@/store'
import { Tag, X, Plus } from 'lucide-react'

interface TagInputProps {
  entityType: 'character' | 'item' | 'location' | 'faction' | 'world' | 'rule' | 'ifline'
  entityId: number
  tags: string[]
}

const TAG_COLORS = [
  '#e8b87d', '#9b7ed9', '#5eb5a6', '#d45d5d', '#5e6ad2',
  '#7eb84a', '#c45c5c', '#5b8ee8', '#e87d9b', '#8ee85b',
]

function getTagColor(tagName: string): string {
  let hash = 0
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

export function TagChips({ tags, onRemove }: { tags: string[]; onRemove?: (tag: string) => void }) {
  if (!tags || tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {tags.map((tag) => {
        const color = getTagColor(tag)
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all"
            style={{
              backgroundColor: `${color}20`,
              color: color,
              border: `1px solid ${color}30`,
            }}
          >
            <Tag className="w-3 h-3" />
            {tag}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(tag)
                }}
                className="p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}

export function TagInput({ entityType, entityId, tags }: TagInputProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
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

  return (
    <div ref={containerRef} className="relative">
      <TagChips tags={tags} onRemove={handleRemove} />

      {isAdding ? (
        <div className="mt-2 relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#6b7280' }} />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  setShowSuggestions(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue.trim()) {
                    handleAdd(inputValue)
                  } else if (e.key === 'Escape') {
                    setIsAdding(false)
                    setInputValue('')
                    setShowSuggestions(false)
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="输入标签..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs transition-all outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#f7f8f8',
                }}
              />
            </div>
            <button
              onClick={() => {
                setIsAdding(false)
                setInputValue('')
                setShowSuggestions(false)
              }}
              className="p-1.5 rounded transition-colors hover:bg-white/10"
              style={{ color: '#6b7280' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Autocomplete suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-md overflow-hidden z-10"
              style={{
                backgroundColor: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleAdd(suggestion)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                  style={{ color: '#d0d6e0' }}
                >
                  <Tag className="w-3 h-3" style={{ color: getTagColor(suggestion) }} />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-all"
          style={{
            backgroundColor: 'transparent',
            color: '#6b7280',
            border: '1px dashed rgba(255,255,255,0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
          }}
        >
          <Plus className="w-3 h-3" />
          添加标签
        </button>
      )}
    </div>
  )
}
