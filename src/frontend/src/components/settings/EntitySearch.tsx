import { useState, useRef, useEffect, useCallback } from 'react'
import { useSettingsStore, type EntityType } from '@/store'
import { Search, X, Clock, ArrowRight, Trash2 } from 'lucide-react'
import { EntityIcon } from '@/components/ui/Icon'
import type { EntityIconType } from '@/components/ui/Icon'
import { motion, AnimatePresence } from 'framer-motion'

interface EntitySearchProps {
  onResultClick?: (type: EntityType, id: number) => void
}

const entityTypeConfig: Record<EntityType | 'all', { label: string; iconType: EntityIconType | 'search'; color: string }> = {
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

const resultVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, type: 'spring' as const, stiffness: 400, damping: 30 },
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all bg-[var(--color-surface-raised)] border border-[var(--border-default)] text-[var(--text-tertiary)]"
        whileHover={{
          scale: 1.02,
          backgroundColor: 'var(--color-surface-overlay)',
          borderColor: 'var(--border-strong)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [0, 5, 0] }}
          transition={{ duration: 0.4 }}
        >
          <Search className="w-3.5 h-3.5" />
        </motion.div>
        <span>搜索实体</span>
        <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ml-1 bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]">
          Ctrl+K
        </kbd>
      </motion.button>

      {/* Search modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-[var(--glass-bg-strong)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-lg overflow-hidden shadow-2xl bg-[var(--color-surface-base)] border border-[var(--border-strong)]"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Input area */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)] bg-[var(--color-surface-raised)]">
                <motion.div
                  className="relative"
                  animate={isOpen ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Search className="w-5 h-5 flex-shrink-0 text-[var(--accent-primary)]" />
                  <motion.div
                    className="absolute inset-0 opacity-30 rounded-full blur-md -z-10"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isOpen ? 0.3 : 0 }}
                    transition={{ duration: 0.2 }}
                  />
                </motion.div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleModalKeyDown}
                  placeholder="搜索角色、物品、地点..."
                  className="flex-1 bg-transparent text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all"
                  style={{
                    borderBottom: '2px solid transparent',
                    paddingBottom: '2px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottomColor = 'var(--accent-primary)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(var(--accent-primary-rgb, 91, 142, 232), 0.15)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderBottomColor = 'transparent'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                {query && (
                  <motion.button
                    onClick={() => {
                      setQuery('')
                      inputRef.current?.focus()
                    }}
                    className="p-1 rounded transition-colors hover:bg-white/10 text-[var(--text-tertiary)]"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              {/* Type filter tabs */}
              <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto border-b border-[var(--border-default)]">
                {(Object.keys(entityTypeConfig) as Array<EntityType | 'all'>).map((type) => {
                  const config = entityTypeConfig[type]
                  const isActive = filterType === type
                  return (
                    <motion.button
                      key={type}
                      onClick={() => setFilterType(type)}
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
                        transition={{ duration: 0.4 }}
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
                              <motion.span
                                key={tag}
                                className="px-2 py-1 text-[10px] rounded-full bg-[var(--color-surface-raised)] text-[var(--text-tertiary)] cursor-pointer hover:bg-[var(--color-surface-overlay)]"
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setQuery(tag)
                                  inputRef.current?.focus()
                                }}
                              >
                                {tag}
                              </motion.span>
                            ))}
                          </motion.div>
                        </motion.div>
                      ) : (
                        results.map((result, index) => {
                          const config = entityTypeConfig[result.type]
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
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group relative overflow-hidden"
                              style={{
                                backgroundColor: isSelected ? `${config.color}12` : 'transparent',
                              }}
                              whileHover={{ x: 2, backgroundColor: `${config.color}08` }}
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
                                style={{ backgroundColor: `${config.color}18` }}
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
                                  backgroundColor: `${config.color}15`,
                                  color: config.color,
                                  border: `1px solid ${config.color}25`,
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
                            <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-tertiary)]">
                              搜索历史
                            </span>
                            <motion.button
                              onClick={clearHistory}
                              className="text-[10px] flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--color-danger)]"
                              whileHover={{ color: 'var(--color-danger)' }}
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
                                backgroundColor: index === selectedIndex ? 'var(--color-surface-raised)' : 'transparent',
                              }}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.03 }}
                              whileHover={{ x: 4 }}
                            >
                              <Clock className="w-4 h-4 flex-shrink-0 text-[var(--text-tertiary)]" />
                              <span className="text-sm flex-1 text-[var(--text-secondary)]">
                                {historyQuery}
                              </span>
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFromHistory(historyQuery)
                                }}
                                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:scale-110 active:scale-90"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <X className="w-3 h-3" />
                              </motion.button>
                            </motion.button>
                          ))}
                        </>
                      ) : (
                        <div className="py-8 text-center">
                          <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-disabled)]" />
                          <p className="text-sm text-[var(--text-tertiary)]">
                            输入关键词开始搜索
                          </p>
                          <p className="text-xs mt-1 text-[var(--text-disabled)]">
                            支持角色、物品、地点、势力等实体
                          </p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 text-xs border-t border-[var(--border-default)] text-[var(--text-tertiary)]"
              >
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="px-1 rounded bg-[var(--color-surface-overlay)]">↑↓</kbd> 选择
                  </span>
                  <span>
                    <kbd className="px-1 rounded bg-[var(--color-surface-overlay)]">Enter</kbd> 确认
                  </span>
                  <span>
                    <kbd className="px-1 rounded bg-[var(--color-surface-overlay)]">Esc</kbd> 关闭
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
