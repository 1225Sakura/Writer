import { useState, useRef, useEffect, useCallback } from 'react'
import { useSettingsStore, type EntityType } from '@/store'
import { Search, X, Users, Package, MapPin, Shield, Globe, BookOpen, GitBranch, FileText, Clock, ArrowRight, Trash2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

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
  outline: { label: '大纲', icon: FileText, color: '#5b8ee8' },
}

// Search history storage key
const SEARCH_HISTORY_KEY = 'entity-search-history'
const MAX_HISTORY_ITEMS = 8

function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  const addToHistory = useCallback((query: string) => {
    if (!query.trim()) return
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.toLowerCase() !== query.toLowerCase())
      const updated = [query, ...filtered].slice(0, MAX_HISTORY_ITEMS)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const removeFromHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h !== query)
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  }, [])

  return { history, addToHistory, removeFromHistory, clearHistory }
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
        className="rounded px-0.5 font-medium"
        style={{ backgroundColor: 'rgba(94,106,210,0.35)', color: '#f7f8f8' }}
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

// Result item animation variants
const resultVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.03, type: 'spring' as const, stiffness: 400, damping: 30 },
  }),
}

export function EntitySearch({ onResultClick }: EntitySearchProps) {
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [_showHistory, setShowHistory] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchEntities = useSettingsStore((state) => state.searchEntities)
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory()

  const results = query.trim() ? searchEntities(query, filterType) : []
  const hasQuery = query.trim().length > 0

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
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
    setShowHistory(!hasQuery)
  }, [query, filterType, hasQuery])

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
    if (hasQuery) addToHistory(query)
    setIsOpen(false)
    setQuery('')
  }

  const handleHistorySelect = (historyQuery: string) => {
    setQuery(historyQuery)
    setShowHistory(false)
    inputRef.current?.focus()
  }

  // Keyboard navigation within modal
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = hasQuery ? results.length : history.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hasQuery && results[selectedIndex]) {
        const r = results[selectedIndex]
        handleSelect(r.type, r.id)
      } else if (!hasQuery && history[selectedIndex]) {
        handleHistorySelect(history[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search trigger */}
      <motion.button
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
        whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.08)' }}
        whileTap={{ scale: 0.98 }}
      >
        <Search className="w-3.5 h-3.5" />
        <span>搜索实体</span>
        <kbd
          className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ml-1"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#6b7280' }}
        >
          Ctrl+K
        </kbd>
      </motion.button>

      {/* Search modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-lg overflow-hidden shadow-2xl"
              style={{
                backgroundColor: '#0f1011',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
                  onKeyDown={handleModalKeyDown}
                  placeholder="搜索角色、物品、地点..."
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: '#f7f8f8' }}
                />
                {query && (
                  <motion.button
                    onClick={() => {
                      setQuery('')
                      inputRef.current?.focus()
                    }}
                    className="p-1 rounded transition-colors hover:bg-white/10"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-4 h-4" style={{ color: '#6b7280' }} />
                  </motion.button>
                )}
              </div>

              {/* Type filter tabs */}
              <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {(Object.keys(entityTypeConfig) as Array<EntityType | 'all'>).map((type) => {
                  const config = entityTypeConfig[type]
                  const Icon = config.icon
                  const isActive = filterType === type
                  return (
                    <motion.button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all"
                      style={{
                        backgroundColor: isActive ? `${config.color}15` : 'transparent',
                        color: isActive ? config.color : '#9ca3af',
                        border: isActive ? `1px solid ${config.color}30` : '1px solid transparent',
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <motion.div
                        animate={isActive ? { rotate: [0, -10, 10, 0] } : { rotate: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <Icon className="w-3 h-3" />
                      </motion.div>
                      {config.label}
                    </motion.button>
                  )
                })}
              </div>

              {/* Results or History */}
              <div className="max-h-[320px] overflow-y-auto">
                <AnimatePresence mode="wait">
                  {hasQuery ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {results.length === 0 ? (
                        <motion.div
                          className="py-8 text-center"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Search className="w-8 h-8 mx-auto mb-2" style={{ color: '#4b5563' }} />
                          <p className="text-sm" style={{ color: '#6b7280' }}>
                            未找到匹配结果
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#4b5563' }}>
                            尝试其他关键词或切换分类
                          </p>
                        </motion.div>
                      ) : (
                        results.map((result, index) => {
                          const config = entityTypeConfig[result.type]
                          const Icon = config.icon
                          const isSelected = index === selectedIndex
                          return (
                            <motion.button
                              key={`${result.type}-${result.id}`}
                              custom={index}
                              variants={resultVariants}
                              initial="hidden"
                              animate="visible"
                              onClick={() => handleSelect(result.type, result.id)}
                              onMouseEnter={() => setSelectedIndex(index)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group"
                              style={{
                                backgroundColor: isSelected ? `${config.color}10` : 'transparent',
                                borderLeft: isSelected ? `2px solid ${config.color}` : '2px solid transparent',
                              }}
                              whileHover={{ x: 2 }}
                            >
                              <motion.div
                                className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${config.color}20` }}
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ type: 'spring', stiffness: 400 }}
                              >
                                <Icon className="w-4 h-4" style={{ color: config.color }} />
                              </motion.div>
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
                              <motion.span
                                className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                                style={{
                                  backgroundColor: `${config.color}15`,
                                  color: config.color,
                                }}
                                whileHover={{ scale: 1.05 }}
                              >
                                {config.label}
                              </motion.span>
                              <motion.div
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                initial={false}
                              >
                                <ArrowRight className="w-3.5 h-3.5" style={{ color: config.color }} />
                              </motion.div>
                            </motion.button>
                          )
                        })
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {history.length > 0 ? (
                        <>
                          <div className="flex items-center justify-between px-4 py-2">
                            <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: '#6b7280' }}>
                              搜索历史
                            </span>
                            <motion.button
                              onClick={clearHistory}
                              className="text-[10px] flex items-center gap-1"
                              style={{ color: '#6b7280' }}
                              whileHover={{ color: '#d45d5d' }}
                            >
                              <Trash2 className="w-3 h-3" />
                              清除
                            </motion.button>
                          </div>
                          {history.map((historyQuery, index) => (
                            <motion.button
                              key={historyQuery}
                              onClick={() => handleHistorySelect(historyQuery)}
                              onMouseEnter={() => setSelectedIndex(index)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group"
                              style={{
                                backgroundColor: index === selectedIndex ? 'rgba(255,255,255,0.04)' : 'transparent',
                              }}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.03 }}
                              whileHover={{ x: 4 }}
                            >
                              <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#6b7280' }} />
                              <span className="text-sm flex-1" style={{ color: '#d0d6e0' }}>
                                {historyQuery}
                              </span>
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFromHistory(historyQuery)
                                }}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <X className="w-3 h-3" style={{ color: '#6b7280' }} />
                              </motion.button>
                            </motion.button>
                          ))}
                        </>
                      ) : (
                        <div className="py-8 text-center">
                          <Search className="w-8 h-8 mx-auto mb-2" style={{ color: '#4b5563' }} />
                          <p className="text-sm" style={{ color: '#6b7280' }}>
                            输入关键词开始搜索
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#4b5563' }}>
                            支持角色、物品、地点、势力等实体
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
                  <span>
                    <kbd className="px-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>Esc</kbd> 关闭
                  </span>
                </div>
                {hasQuery && results.length > 0 && (
                  <motion.span
                    key={results.length}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    {results.length} 个结果
                  </motion.span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
