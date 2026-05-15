/**
 * SearchHistory - Search history hook and history list component for EntitySearch
 */

import { useState, useCallback } from 'react'
import { Search, Clock, X, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'

const SEARCH_HISTORY_KEY = 'entity-search-history'
const MAX_HISTORY_ITEMS = 8

export function useSearchHistory() {
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

interface SearchHistoryListProps {
  history: string[]
  selectedIndex: number
  onSelect: (query: string) => void
  onRemove: (query: string) => void
  onClear: () => void
  onHoverIndex: (index: number) => void
}

export function SearchHistoryList({
  history,
  selectedIndex,
  onSelect,
  onRemove,
  onClear,
  onHoverIndex,
}: SearchHistoryListProps) {
  if (history.length === 0) {
    return (
      <div className="py-8 text-center">
        <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-disabled)]" />
        <p className="text-sm text-[var(--text-tertiary)]">
          输入关键词开始搜索
        </p>
        <p className="text-xs mt-1 text-[var(--text-disabled)]">
          支持角色、物品、地点、势力等实体
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-tertiary)]">
          搜索历史
        </span>
        <motion.button
          onClick={onClear}
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
          onClick={() => onSelect(historyQuery)}
          onMouseEnter={() => onHoverIndex(index)}
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
              onRemove(historyQuery)
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] hover:scale-110 active:scale-90"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label={`删除搜索记录: ${historyQuery}`}
          >
            <X className="w-3 h-3" />
          </motion.button>
        </motion.button>
      ))}
    </>
  )
}
