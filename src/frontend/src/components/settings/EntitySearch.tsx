import { useState, useRef, useEffect, useCallback } from 'react'
import { useSettingsStore, type EntityType } from '@/store'
import { Search, X, Users, Package, MapPin, Shield, Globe, BookOpen, GitBranch } from 'lucide-react'

interface EntitySearchProps {
  onResultClick?: (type: EntityType, id: number) => void
}

const entityTypeConfig: Record<EntityType | 'all', { label: string; icon: typeof Users; color: string }> = {
  all: { label: '全部', icon: Search, color: '#5e6ad2' },
  character: { label: '角色', icon: Users, color: '#e8b87d' },
  item: { label: '物品', icon: Package, color: '#9b7ed9' },
  location: { label: '地点', icon: MapPin, color: '#5eb5a6' },
  faction: { label: '势力', icon: Shield, color: '#d45d5d' },
  world: { label: '世界观', icon: Globe, color: '#5e6ad2' },
  rule: { label: '规则', icon: BookOpen, color: '#7eb84a' },
  ifline: { label: 'IF线', icon: GitBranch, color: '#7eb84a' },
  outline: { label: '大纲', icon: BookOpen, color: '#5e6ad2' },
}

function highlightMatch(text: string, query: string): React.ReactNode {
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
        className="rounded px-0.5"
        style={{ backgroundColor: 'rgba(94,106,210,0.4)', color: '#f7f8f8' }}
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

export function EntitySearch({ onResultClick }: EntitySearchProps) {
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchEntities = useSettingsStore((state) => state.searchEntities)

  const results = query.trim() ? searchEntities(query, filterType) : []

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(true)
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    },
    []
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, filterType])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (type: EntityType, id: number) => {
    onResultClick?.(type, id)
    setIsOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger */}
      <button
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#9ca3af',
        }}
      >
        <Search className="w-3.5 h-3.5" />
        <span>搜索实体</span>
        <kbd
          className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ml-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#6b7280' }}
        >
          Ctrl+K
        </kbd>
      </button>

      {/* Search modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg overflow-hidden shadow-2xl"
            style={{
              backgroundColor: '#0f1011',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input area */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Search className="w-5 h-5 flex-shrink-0" style={{ color: '#6b7280' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedIndex((i) => Math.max(i - 1, 0))
                  } else if (e.key === 'Enter' && results[selectedIndex]) {
                    const r = results[selectedIndex]
                    handleSelect(r.type, r.id)
                  } else if (e.key === 'Escape') {
                    setIsOpen(false)
                    setQuery('')
                  }
                }}
                placeholder="搜索角色、物品、地点..."
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#f7f8f8' }}
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('')
                    inputRef.current?.focus()
                  }}
                  className="p-1 rounded transition-colors hover:bg-white/10"
                >
                  <X className="w-4 h-4" style={{ color: '#6b7280' }} />
                </button>
              )}
            </div>

            {/* Type filter tabs */}
            <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {(Object.keys(entityTypeConfig) as Array<EntityType | 'all'>).map((type) => {
                const config = entityTypeConfig[type]
                const Icon = config.icon
                const isActive = filterType === type
                return (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all"
                    style={{
                      backgroundColor: isActive ? 'rgba(94,106,210,0.15)' : 'transparent',
                      color: isActive ? '#5e6ad2' : '#9ca3af',
                      border: isActive ? '1px solid rgba(94,106,210,0.3)' : '1px solid transparent',
                    }}
                  >
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </button>
                )
              })}
            </div>

            {/* Results */}
            <div className="max-h-[320px] overflow-y-auto">
              {results.length === 0 && query.trim() && (
                <div className="py-8 text-center">
                  <Search className="w-8 h-8 mx-auto mb-2" style={{ color: '#4b5563' }} />
                  <p className="text-sm" style={{ color: '#6b7280' }}>
                    未找到匹配结果
                  </p>
                </div>
              )}
              {results.map((result, index) => {
                const config = entityTypeConfig[result.type]
                const Icon = config.icon
                const isSelected = index === selectedIndex
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result.type, result.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'rgba(94,106,210,0.1)' : 'transparent',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${config.color}20` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: '#f7f8f8' }}>
                        {highlightMatch(result.name, query)}
                      </div>
                      {result.description && (
                        <p className="text-xs truncate" style={{ color: '#6b7280' }}>
                          {highlightMatch(result.description, query)}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: `${config.color}15`,
                        color: config.color,
                      }}
                    >
                      {config.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-4 py-2 text-xs"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                color: '#6b7280',
              }}
            >
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="px-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>↑↓</kbd> 选择
                </span>
                <span>
                  <kbd className="px-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>Enter</kbd> 确认
                </span>
              </div>
              {results.length > 0 && (
                <span>{results.length} 个结果</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
