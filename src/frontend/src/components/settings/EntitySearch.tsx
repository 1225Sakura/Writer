/**
 * EntitySearch - Entity search modal with filters, results, and history
 *
 * Sub-components: SearchFilters, SearchResults, SearchHistory
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import type { EntityType } from '@/shared/types'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE, SPRING } from '@/components/shared/AnimationConfig'
import { SearchFilters } from './SearchFilters'
import { SearchResults } from './SearchResults'
import { SearchHistoryList, useSearchHistory } from './SearchHistory'

interface EntitySearchProps {
  onResultClick?: (type: EntityType, id: number) => void
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
          boxShadow: 'var(--shadow-sm)',
        }}
        whileTap={{ scale: 0.98 }}
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [0, 5, 0] }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
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
              transition={SPRING.SNAPPY}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Input area */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)] bg-[var(--color-surface-raised)]">
                <motion.div
                  className="relative"
                  animate={isOpen ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
                >
                  <Search className="w-5 h-5 flex-shrink-0 text-[var(--accent-primary)]" />
                  <motion.div
                    className="absolute inset-0 opacity-30 rounded-full blur-md -z-10"
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isOpen ? 0.3 : 0 }}
                    transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
                  />
                </motion.div>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleModalKeyDown}
                  placeholder="搜索角色、物品、地点..."
                  aria-label="搜索实体"
                  className="flex-1 bg-transparent text-sm outline-none text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all"
                  style={{
                    borderBottom: '2px solid transparent',
                    paddingBottom: '2px',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderBottomColor = 'var(--accent-primary)'
                    e.currentTarget.style.boxShadow = '0 2px 8px var(--accent-glow)'
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
                    className="p-1 rounded transition-colors hover:bg-[var(--color-surface-overlay)] text-[var(--text-tertiary)]"
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
              <SearchFilters filterType={filterType} onFilterChange={setFilterType} />

              {/* Results or History */}
              <div className="max-h-[320px] overflow-y-auto scrollbar-thin">
                <AnimatePresence mode="wait">
                  {hasQuery ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <SearchResults
                        results={results}
                        query={query}
                        selectedIndex={selectedIndex}
                        onSelect={handleSelect}
                        onHoverIndex={setSelectedIndex}
                        onSuggestionClick={setQuery}
                        inputRef={inputRef}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <SearchHistoryList
                        history={history}
                        selectedIndex={selectedIndex}
                        onSelect={handleHistorySelect}
                        onRemove={removeFromHistory}
                        onClear={clearHistory}
                        onHoverIndex={setSelectedIndex}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 text-xs border-t border-[var(--border-default)] text-[var(--text-tertiary)]">
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
