/**
 * GraphControls — Filter, zoom, and search controls for the relation graph.
 * Extracted from RelationGraph.tsx.
 */

import { useState } from 'react'
import { Filter, ZoomIn, ZoomOut, RotateCcw, ChevronRight, Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { ENTITY_TYPE_CONFIG, RELATION_TYPE_LABELS } from './graphTypes'
import type { GraphNode, EntityNodeType } from './graphTypes'

const FilterButton = ({ icon: Icon, title, onClick }: { icon: typeof ZoomIn; title: string; onClick: () => void }) => (
  <button className="p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200 group flex items-center justify-center" aria-label={title} title={title} onClick={onClick}>
    <Icon className="w-4 h-4 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
  </button>
)

// ============================================
// SearchInput
// ============================================

export function SearchInput({
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectResult,
}: {
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResults: GraphNode[]
  onSelectResult: (node: GraphNode) => void
}) {
  const [isFocused, setIsFocused] = useState(false)
  const showResults = isFocused && searchQuery.length > 0 && searchResults.length > 0

  return (
    <div className="relative">
      <div
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all duration-200"
        style={{
          background: 'var(--color-surface-base)',
          border: `1px solid ${isFocused ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
          boxShadow: isFocused ? '0 0 0 2px rgba(201, 169, 110, 0.15)' : 'none',
        }}
      >
        <Search className="w-3 h-3 flex-shrink-0" style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--ink-90)', opacity: isFocused ? 0.8 : 0.4 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => { setTimeout(() => setIsFocused(false), 150); }}
          placeholder="搜索节点..."
          aria-label="搜索图谱节点"
          className="w-full bg-transparent text-[10px] outline-none"
          style={{
            color: 'var(--ink-100)',
            '--tw-placeholder-opacity': '0.4',
          } as React.CSSProperties}
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="p-0.5 rounded hover:bg-[var(--hover-bg)] transition-colors"
            aria-label="清除搜索"
          >
            <X className="w-2.5 h-2.5" style={{ color: 'var(--ink-90)', opacity: 0.4 }} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50 max-h-[160px] overflow-y-auto"
            style={{
              background: 'var(--paper-80)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {searchResults.slice(0, 8).map((node) => {
              const cfg = ENTITY_TYPE_CONFIG[node.type]
              const NodeIcon = cfg.icon
              return (
                <button
                  key={node.id}
                  onClick={() => onSelectResult(node)}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left transition-all duration-150"
                  style={{ color: 'var(--ink-90)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(201, 169, 110, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <NodeIcon className="w-3 h-3 flex-shrink-0" style={{ color: cfg.color, opacity: 0.7 }} />
                  <span className="text-[10px] truncate">{node.name}</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// FilterControls
// ============================================

export function FilterControls({
  activeTypes,
  onToggleType,
  filterRelation,
  onSetRelationFilter,
  onZoomIn,
  onZoomOut,
  onResetView,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectResult,
}: {
  activeTypes: Set<EntityNodeType>
  onToggleType: (type: EntityNodeType) => void
  filterRelation: string
  onSetRelationFilter: (type: string) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  searchResults: GraphNode[]
  onSelectResult: (node: GraphNode) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  const relationTypes = Object.entries(RELATION_TYPE_LABELS)

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
      <SearchInput
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        searchResults={searchResults}
        onSelectResult={onSelectResult}
      />

      <div
        className="flex flex-col gap-0.5 rounded-xl p-1.5"
        style={{
          background: 'var(--paper-80)',
          border: "1px solid var(--border-default)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px var(--border-subtle)",
        }}
      >
        <FilterButton icon={ZoomIn} title="放大 (滚轮上)" onClick={onZoomIn} />
        <FilterButton icon={ZoomOut} title="缩小 (滚轮下)" onClick={onZoomOut} />
        <FilterButton icon={RotateCcw} title="重置视图" onClick={onResetView} />
      </div>

      <div
        className="rounded-xl p-1.5"
        style={{
          background: 'var(--paper-80)',
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px var(--border-subtle)",
        }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--hover-bg)] transition-all duration-200 w-full group"
        >
          <Filter className="w-3 h-3 transition-colors" style={{ color: 'var(--ink-90)', opacity: 0.5 }} />
          <span className="text-[10px] transition-colors font-medium" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
            筛选
          </span>
          <ChevronRight
            className="w-3 h-3 ml-auto transition-transform"
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", color: 'var(--ink-90)', opacity: 0.4 }}
          />
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-0.5">
                {(
                  Object.entries(ENTITY_TYPE_CONFIG) as [
                    EntityNodeType,
                    (typeof ENTITY_TYPE_CONFIG)["character"],
                  ][]
                ).map(([type, config]) => {
                  const isActive = activeTypes.has(type)
                  return (
                    <button
                      key={type}
                      onClick={() => onToggleType(type)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg w-full transition-all duration-200"
                      style={{
                        backgroundColor: isActive
                          ? `color-mix(in srgb, ${config.color} 9%, transparent)`
                          : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          e.currentTarget.style.backgroundColor =
                            "rgba(201, 169, 110, 0.06)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full transition-all duration-200"
                        style={{
                          backgroundColor: isActive
                            ? config.color
                            : "var(--text-disabled)",
                          opacity: isActive ? 1 : 0.3,
                          boxShadow: isActive
                            ? `0 0 6px ${config.glowColor}`
                            : "none",
                        }}
                      />
                      <span
                        className="text-[10px] transition-colors duration-200"
                        style={{
                          color: isActive
                            ? config.color
                            : "var(--ink-90)",
                          opacity: isActive ? 1 : 0.5,
                        }}
                      >
                        {config.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="pt-2 mt-2 border-t border-[var(--border-subtle)]">
                <p className="text-[10px] mb-1.5 px-2 font-medium" style={{ color: 'var(--ink-90)', opacity: 0.5 }}>
                  关系类型
                </p>
                <select
                  value={filterRelation}
                  onChange={(e) => onSetRelationFilter(e.target.value)}
                  aria-label="筛选关系类型"
                  className="w-full text-[10px] px-2 py-1.5 rounded-lg outline-none cursor-pointer transition-colors"
                  style={{
                    background: "var(--paper-100)",
                    color: "var(--ink-100)",
                    border: "1px solid var(--border-subtle)",
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <option value="all">全部关系</option>
                  {relationTypes.map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
